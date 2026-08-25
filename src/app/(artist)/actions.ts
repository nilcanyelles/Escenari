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
// members del grup (que és la clau amb què es porta l'assistència).
async function addMembership(bandId: string, profile: Profile) {
  const pool = db();
  await pool.query(
    `insert into band_members (band_id, clerk_user_id, member_name)
     values ($1, $2, $3)
     on conflict (band_id, clerk_user_id) do nothing`,
    [bandId, profile.clerkUserId, profile.name]
  );

  const band = (await pool.query("select members from bands where id=$1", [bandId])).rows[0];
  if (!band) return;
  const members: Person[] = band.members || [];
  const exists = members.some((m) => (m.name || "").trim().toLowerCase() === profile.name.trim().toLowerCase());
  if (!exists) {
    members.push({
      name: profile.name,
      role: profile.instruments.join(", "),
      email: profile.email,
      instruments: profile.instruments,
    });
    await pool.query("update bands set members=$1 where id=$2", [JSON.stringify(members), bandId]);
  }
}

export async function respondInvitationAction(invitationId: string, accept: boolean) {
  const profile = await requireArtistAction();
  const pool = db();
  const invitation = (
    await pool.query(
      "select id, band_id from invitations where id=$1 and lower(email)=lower($2) and status='pendent'",
      [invitationId, profile.email]
    )
  ).rows[0];
  if (!invitation) return { ok: false as const, error: "La invitació ja no és vàlida." };

  await pool.query("update invitations set status=$1 where id=$2", [accept ? "acceptada" : "rebutjada", invitationId]);
  if (accept) await addMembership(invitation.band_id, profile);
  revalidateArtist();
  return { ok: true as const };
}

export async function joinByCodeAction(code: string) {
  const profile = await requireArtistAction();
  const cleaned = (code || "").trim().toUpperCase();
  if (!cleaned) return { ok: false as const, error: "Escriu un codi." };
  const band = (await db().query("select id, name from bands where upper(join_code)=$1 and join_code_active", [cleaned])).rows[0];
  if (!band) return { ok: false as const, error: "No hi ha cap grup amb aquest codi." };
  await addMembership(band.id, profile);
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
