"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireArtistAction, type Profile } from "@/lib/current-user";
import type { Person } from "@/lib/types";

function revalidateArtist() {
  revalidatePath("/artista");
  revalidatePath("/els-meus-grups");
  // El gestor del grup veu la mateixa dada.
  revalidatePath("/concerts");
  revalidatePath("/resum");
  revalidatePath("/calendari");
  revalidatePath("/grups");
}

// Alta d'un artista en un grup: fila a band_members + entrada al jsonb de
// members (o crew) del grup. Si `claimName` coincideix amb un membre creat a
// mà, la persona el "reclama": mateixa identitat, mateix historial.
async function addMembership(bandId: string, profile: Profile, opts?: { claimName?: string; asCrew?: boolean }) {
  const pool = db();
  const band = (await pool.query("select members, crew from bands where id=$1", [bandId])).rows[0];
  if (!band) return;

  const members: Person[] = band.members || [];
  const crew: Person[] = band.crew || [];
  const claim = (opts?.claimName || "").trim().toLowerCase();
  const existingMember = claim
    ? members.find((m) => (m.name || "").trim().toLowerCase() === claim) ||
      crew.find((m) => (m.name || "").trim().toLowerCase() === claim)
    : members.find((m) => (m.name || "").trim().toLowerCase() === profile.name.trim().toLowerCase()) ||
      crew.find((m) => (m.name || "").trim().toLowerCase() === profile.name.trim().toLowerCase());

  const memberName = existingMember?.name || profile.name;

  await pool.query(
    `insert into band_members (band_id, clerk_user_id, member_name)
     values ($1, $2, $3)
     on conflict (band_id, clerk_user_id) do update set member_name = excluded.member_name`,
    [bandId, profile.clerkUserId, memberName]
  );

  if (!existingMember) {
    if (opts?.asCrew) {
      crew.push({ name: profile.name, role: "Tècnic de so", email: profile.email });
      await pool.query("update bands set crew=$1 where id=$2", [JSON.stringify(crew), bandId]);
    } else {
      members.push({
        name: profile.name,
        role: profile.instruments.join(", "),
        email: profile.email,
        instruments: profile.instruments,
      });
      await pool.query("update bands set members=$1 where id=$2", [JSON.stringify(members), bandId]);
    }
  }

  // Vincula també el perfil públic si existia (creat pel gestor).
  const ws = (await pool.query("select workspace_id from bands where id=$1", [bandId])).rows[0];
  if (ws) {
    await pool.query(
      "update person_profiles set clerk_user_id=$1 where workspace_id=$2 and lower(person_name)=lower($3) and clerk_user_id is null",
      [profile.clerkUserId, ws.workspace_id, memberName]
    );
  }
}

export async function respondInvitationAction(invitationId: string, accept: boolean) {
  const profile = await requireArtistAction();
  const pool = db();
  const invitation = (
    await pool.query(
      "select id, band_id, name from invitations where id=$1 and lower(email)=lower($2) and status='pendent'",
      [invitationId, profile.email]
    )
  ).rows[0];
  if (!invitation) return { ok: false as const, error: "La invitació ja no és vàlida." };

  await pool.query("update invitations set status=$1 where id=$2", [accept ? "acceptada" : "rebutjada", invitationId]);
  if (accept) await addMembership(invitation.band_id, profile, { claimName: invitation.name || undefined });
  revalidateArtist();
  return { ok: true as const };
}

export async function joinByCodeAction(code: string, asCrew = false) {
  const profile = await requireArtistAction();
  const cleaned = (code || "").trim().toUpperCase();
  if (!cleaned) return { ok: false as const, error: "Escriu un codi." };
  const band = (await db().query("select id, name from bands where upper(join_code)=$1 and join_code_active", [cleaned])).rows[0];
  if (!band) return { ok: false as const, error: "No hi ha cap grup amb aquest codi." };
  await addMembership(band.id, profile, { asCrew });
  revalidateArtist();
  return { ok: true as const, bandName: band.name as string };
}

export async function setMyAttendanceAction(concertId: string, value: "yes" | "no") {
  const profile = await requireArtistAction();
  if (value !== "yes" && value !== "no") return;
  const pool = db();
  const membership = (
    await pool.query(
      `select bm.member_name from band_members bm
       join concerts c on c.band_id = bm.band_id
       where c.id = $1 and bm.clerk_user_id = $2`,
      [concertId, profile.clerkUserId]
    )
  ).rows[0];
  if (!membership) return;

  if (value === "yes") {
    // En confirmar, es neteja qualsevol substitut que el gestor hagués posat.
    await pool.query(
      `update concerts set
         attendance = attendance || jsonb_build_object($1::text, 'yes'),
         substitutes = substitutes - $1,
         no_substitute = no_substitute - $1
       where id = $2`,
      [membership.member_name, concertId]
    );
  } else {
    await pool.query(
      `update concerts set attendance = attendance || jsonb_build_object($1::text, 'no')
       where id = $2`,
      [membership.member_name, concertId]
    );
  }
  revalidateArtist();
}

// L'artista que no pot venir proposa un suplent de la llista del grup.
export async function suggestSubstituteAction(concertId: string, subName: string) {
  const profile = await requireArtistAction();
  const pool = db();
  const membership = (
    await pool.query(
      `select bm.member_name from band_members bm
       join concerts c on c.band_id = bm.band_id
       where c.id = $1 and bm.clerk_user_id = $2`,
      [concertId, profile.clerkUserId]
    )
  ).rows[0];
  if (!membership) return;
  if (subName) {
    await pool.query(
      `update concerts set substitutes = substitutes || jsonb_build_object($1::text, $2::text), no_substitute = no_substitute - $1 where id = $3`,
      [membership.member_name, subName, concertId]
    );
  } else {
    await pool.query(
      `update concerts set substitutes = substitutes - $1 where id = $2`,
      [membership.member_name, concertId]
    );
  }
  revalidateArtist();
}

// Sense suplent disponible: l'artista publica una cerca a la borsa de suplències.
export async function publishBackupSearchAction(concertId: string) {
  const profile = await requireArtistAction();
  const pool = db();
  const row = (
    await pool.query(
      `select bm.member_name, c.band_id, c.workspace_id from band_members bm
       join concerts c on c.band_id = bm.band_id
       where c.id = $1 and bm.clerk_user_id = $2`,
      [concertId, profile.clerkUserId]
    )
  ).rows[0];
  if (!row) return { ok: false as const };
  const existing = (
    await pool.query(
      "select id from backup_requests where concert_id=$1 and member_name=$2 and status='oberta'",
      [concertId, row.member_name]
    )
  ).rows[0];
  if (existing) return { ok: true as const };
  await pool.query(
    `insert into backup_requests (id, workspace_id, band_id, concert_id, member_name, instruments)
     values ($1,$2,$3,$4,$5,$6)`,
    ["br" + Date.now(), row.workspace_id, row.band_id, concertId, row.member_name, JSON.stringify(profile.instruments || [])]
  );
  await pool.query(
    `update concerts set no_substitute = no_substitute || jsonb_build_object($1::text, true) where id=$2`,
    [row.member_name, concertId]
  );
  revalidateArtist();
  revalidatePath("/suplencies");
  return { ok: true as const };
}

// Un músic d'Escenari es presenta a una cerca de suplent.
export async function applyToBackupRequestAction(requestId: string, message: string) {
  const profile = await requireArtistAction();
  const pool = db();
  const req = (await pool.query("select id from backup_requests where id=$1 and status='oberta'", [requestId])).rows[0];
  if (!req) return { ok: false as const, error: "Aquesta cerca ja no està oberta." };
  await pool.query(
    `insert into backup_applications (request_id, clerk_user_id, message)
     values ($1,$2,$3)
     on conflict (request_id, clerk_user_id) do update set message = excluded.message`,
    [requestId, profile.clerkUserId, (message || "").slice(0, 500)]
  );
  revalidatePath("/suplencies");
  return { ok: true as const };
}

// Disponibilitat per a suplències: s'aplica a tots els perfils vinculats al
// compte (un per workspace on és membre).
export async function setSubsAvailabilityAction(input: { open?: boolean; visible?: boolean }) {
  const profile = await requireArtistAction();
  await db().query(
    `update person_profiles set
       open_to_subs = coalesce($1, open_to_subs),
       profile_public = coalesce($2, profile_public)
     where clerk_user_id = $3`,
    [input.open ?? null, input.visible ?? null, profile.clerkUserId]
  );
  revalidatePath("/suplencies");
}
