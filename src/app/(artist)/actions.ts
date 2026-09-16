"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireArtistAction, getProfile, type Profile } from "@/lib/current-user";
import { createBandWithPeople, type CreateGroupInput, type CreateGroupResult } from "@/lib/group-create";
import type { Person } from "@/lib/types";
import { normalize } from "@/lib/text";
import { createUnavailabilityEvent, deleteUnavailabilityEvent } from "@/lib/unavailability";

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
// "instruments"/"role": què hi toca (o quina funció hi fa) en AQUEST grup —
// pot ser diferent del perfil general; si no es diuen, s'agafen del perfil.
async function addMembership(bandId: string, profile: Profile, opts?: { claimName?: string; asCrew?: boolean; instruments?: string[]; role?: string }) {
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
  const instruments = (opts?.instruments || []).map((s) => s.trim()).filter(Boolean);
  const crewRole = (opts?.role || "").trim();

  await pool.query(
    `insert into band_members (band_id, clerk_user_id, member_name)
     values ($1, $2, $3)
     on conflict (band_id, clerk_user_id) do update set member_name = excluded.member_name`,
    [bandId, profile.clerkUserId, memberName]
  );

  if (!existingMember) {
    if (opts?.asCrew) {
      crew.push({ name: profile.name, role: crewRole || "Tècnic de so", email: profile.email, phone: profile.phone, whatsapp: profile.whatsapp });
      await pool.query("update bands set crew=$1 where id=$2", [JSON.stringify(crew), bandId]);
    } else {
      const ins = instruments.length ? instruments : profile.instruments;
      members.push({
        name: profile.name,
        role: ins.join(", "),
        email: profile.email,
        phone: profile.phone,
        whatsapp: profile.whatsapp,
        instruments: ins,
      });
      await pool.query("update bands set members=$1 where id=$2", [JSON.stringify(members), bandId]);
    }
  } else if (instruments.length || crewRole) {
    // Reclama un membre ja creat pel gestor: es queda amb el que la persona
    // diu que hi toca (o hi fa), si ho ha dit.
    const inMembers = members.some((m) => m === existingMember);
    if (inMembers && instruments.length) {
      const next = members.map((m) => (m === existingMember ? { ...m, instruments, role: instruments.join(", ") } : m));
      await pool.query("update bands set members=$1 where id=$2", [JSON.stringify(next), bandId]);
    } else if (!inMembers && crewRole) {
      const next = crew.map((m) => (m === existingMember ? { ...m, role: crewRole } : m));
      await pool.query("update bands set crew=$1 where id=$2", [JSON.stringify(next), bandId]);
    }
  }

  // Si es reclama algú que el gestor ja havia creat amb un nom diferent del
  // del compte (p. ex. et vas registrar com a "Musicat Memes" però et
  // reclames com a "Iker Salido"), el nom del compte també es corregeix —
  // si no, la barra lateral i el menú de dalt a la dreta es queden amb el
  // nom vell mentre "El meu perfil" ja mostra el nou.
  if (memberName.trim().toLowerCase() !== profile.name.trim().toLowerCase()) {
    await pool.query("update profiles set name=$1 where clerk_user_id=$2", [memberName, profile.clerkUserId]);
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

// Un músic crea el seu propi grup: hi entra com a membre amb el permís
// "Admin" (vegeu createBandWithPeople — qui crea el grup hi mana des del
// primer moment), amb el mateix accés que un gestor DINS d'aquest grup
// (vegeu requireBandAccess(bandId, "admin") i isAdminLike a GroupHomeView).
// El compte es queda com a artista: no es toca ni el rol ni el workspace
// del perfil, així que segueix veient i podent accedir a la resta de grups
// on ja fos (amb els permisos que hi tingués) — abans això convertia el
// compte en gestor de la seva pròpia agència, cosa que el desconnectava de
// qualsevol altre grup on ja fos membre. Es pot fer servir més d'un cop:
// cada crida crea un grup (workspace) nou i independent.
export async function createGroupAsMusicianAction(input: CreateGroupInput, myInstruments: string[]): Promise<CreateGroupResult> {
  const profile = await requireArtistAction();
  if (profile.role !== "artist") throw new Error("Només els músics poden crear el seu grup des d'aquí.");
  const name = (input.name || "").trim();
  if (!name) throw new Error("Cal el nom del grup");
  const pool = db();
  const wsId = "ws" + Date.now();
  const logo = input.logo && input.logo.startsWith("data:image/") && input.logo.length < 400_000 ? input.logo : "";
  // Workspace només per allotjar aquest grup (bands.workspace_id és
  // obligatori) — no hi ha cap gestor que en depengui, hi mana qui l'ha
  // creat gràcies al permís d'Admin.
  await pool.query("insert into workspaces (id, name, logo, trial_ends_at) values ($1, $2, $3, now() + interval '14 days')", [wsId, name, logo]);
  await pool.query("insert into company_info (workspace_id) values ($1) on conflict do nothing", [wsId]);
  const instruments = (myInstruments || []).filter(Boolean).length ? myInstruments.filter(Boolean) : profile.instruments;
  const res = await createBandWithPeople({
    workspaceId: wsId,
    creatorName: profile.name,
    input,
    self: { clerkUserId: profile.clerkUserId, name: profile.name, email: profile.email, instruments },
  });
  revalidateArtist();
  revalidatePath("/artista/grup");
  return { bandId: res.bandId, invites: res.invites };
}

// Reclama un perfil de grup des de l'enllaç d'invitació (/i/token): queda
// vinculat exactament al membre creat pel gestor, sigui músic o crew, i
// no cal que el correu coincideixi.
export async function claimBandInvitationAction(token: string) {
  const profile = await requireArtistAction();
  const pool = db();
  const inv = (await pool.query("select id, band_id, name, as_crew, status from invitations where token=$1", [token])).rows[0];
  if (!inv) return { ok: false as const, error: "Aquest enllaç no és vàlid." };
  if (inv.status !== "pendent") return { ok: false as const, error: "Aquesta invitació ja s'ha fet servir." };
  await pool.query("update invitations set status='acceptada' where id=$1", [inv.id]);
  await addMembership(inv.band_id, profile, { claimName: inv.name || undefined, asCrew: !!inv.as_crew });
  revalidateArtist();
  return { ok: true as const, bandId: inv.band_id as string };
}

// "extra": què hi toca en aquest grup (instruments) o quina funció hi fa
// (crew) — es demana en unir-s'hi amb el codi. "claimName": si és algú que
// el gestor ja havia creat a mà (vist a previewBandByCodeAction), reclama
// aquesta identitat en comptes de crear-se'n una de nova.
export async function joinByCodeAction(code: string, asCrew = false, extra?: { instruments?: string[]; role?: string }, claimName?: string) {
  const profile = await requireArtistAction();
  const cleaned = (code || "").trim().toUpperCase();
  if (!cleaned) return { ok: false as const, error: "Escriu un codi." };
  const band = (await db().query("select id, name from bands where upper(join_code)=$1 and join_code_active", [cleaned])).rows[0];
  if (!band) return { ok: false as const, error: "No hi ha cap grup amb aquest codi." };
  if (claimName && claimName.trim()) {
    // Repetit de la comprovació que ja fa la llista de previewBandByCodeAction
    // (perfils ja vinculats no es poden triar) — aquí per si algú l'esquiva
    // trucant l'action directament amb un nom que ja és d'un altre compte.
    const already = (await db().query(
      "select 1 from band_members where band_id=$1 and lower(member_name)=lower($2) and clerk_user_id<>$3",
      [band.id, claimName.trim(), profile.clerkUserId]
    )).rows[0];
    if (already) return { ok: false as const, error: "Aquest perfil ja està vinculat a un altre compte." };
  }
  await addMembership(band.id, profile, { asCrew, instruments: extra?.instruments, role: extra?.role, claimName });
  revalidateArtist();
  return { ok: true as const, bandName: band.name as string };
}

export type PreviewPerson = { name: string; kind: "member" | "crew"; instruments: string[]; role: string; claimed: boolean };

// Llista de músics i crew que el gestor ja ha creat a mà en aquest grup, per
// deixar triar "qui ets" en unir-te amb el codi — els ja reclamats (amb
// compte vinculat) surten marcats i no es poden triar.
export async function previewBandByCodeAction(code: string): Promise<{ bandName: string; people: PreviewPerson[] } | null> {
  await requireArtistAction();
  const cleaned = (code || "").trim().toUpperCase();
  if (!cleaned) return null;
  const band = (await db().query(
    "select id, name, members, crew from bands where upper(join_code)=$1 and join_code_active",
    [cleaned]
  )).rows[0];
  if (!band) return null;
  const linkedRows = (await db().query("select member_name from band_members where band_id=$1", [band.id])).rows;
  const linked = new Set(linkedRows.map((r) => normalize(r.member_name)));
  const members: Person[] = band.members || [];
  const crew: Person[] = band.crew || [];
  const people: PreviewPerson[] = [
    ...members.map((m) => ({ name: m.name, kind: "member" as const, instruments: m.instruments || [], role: m.role || "", claimed: linked.has(normalize(m.name)) })),
    ...crew.map((m) => ({ name: m.name, kind: "crew" as const, instruments: [], role: m.role || "", claimed: linked.has(normalize(m.name)) })),
  ];
  return { bandName: band.name, people };
}

// "value" null = treu la resposta (torna a "pendent") — clicar la mateixa
// que ja tenies marcada la dessel·lecciona.
export async function setMyAttendanceAction(concertId: string, value: "yes" | "no" | "potser" | null) {
  const profile = await requireArtistAction();
  if (value !== null && value !== "yes" && value !== "no" && value !== "potser") return;
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
  } else if (value === null) {
    await pool.query(
      `update concerts set attendance = attendance - $1 where id = $2`,
      [membership.member_name, concertId]
    );
  } else {
    // "no" o "potser": no toquen el substitut que el gestor hagi posat.
    await pool.query(
      `update concerts set attendance = attendance || jsonb_build_object($1::text, $3::text)
       where id = $2`,
      [membership.member_name, concertId, value]
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

// Un dia del calendari de disponibilitat: disponible (true), no disponible
// (false) o sense marcar (null). Qualsevol compte pot marcar el seu.
// Preferències de suplències (per compte): fins a quina distància se'l pot
// contactar i des d'on, i per a quins instruments.
const SUBS_KM_OPTIONS = [0, 25, 50, 100, 150, 250];
export async function setSubsPrefsAction(input: { maxKm: number; homeCity: string; anyInstrument: boolean; instruments: string[] }) {
  const profile = await getProfile();
  if (!profile) throw new Error("Sessió no vàlida");
  const maxKm = SUBS_KM_OPTIONS.includes(Number(input.maxKm)) ? Number(input.maxKm) : 0;
  const instruments = (input.instruments || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  await db().query(
    "update profiles set subs_max_km=$1, subs_home_city=$2, subs_any_instrument=$3, subs_instruments=$4 where clerk_user_id=$5",
    [maxKm, (input.homeCity || "").trim().slice(0, 120), !!input.anyInstrument, JSON.stringify(instruments), profile.clerkUserId]
  );
  revalidatePath("/suplencies");
  revalidatePath("/suplents");
}

export async function setDayAvailabilityAction(day: string, available: boolean | null) {
  const profile = await getProfile();
  if (!profile) throw new Error("Sessió no vàlida");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Data no vàlida");
  if (available === null) {
    await db().query("delete from subs_availability where clerk_user_id=$1 and day=$2", [profile.clerkUserId, day]);
  } else {
    await db().query(
      `insert into subs_availability (clerk_user_id, day, available) values ($1,$2,$3)
       on conflict (clerk_user_id, day) do update set available=excluded.available`,
      [profile.clerkUserId, day, available]
    );
  }
  revalidatePath("/suplencies");
  revalidatePath("/suplents");
  revalidatePath("/artista/perfil");
}

// Esdeveniments de "no disponible" (vacances, etc.) al perfil personal —
// vegeu src/lib/unavailability.ts. Qualsevol compte (músic o crew) en pot
// crear i esborrar els seus.
export async function createUnavailabilityAction(input: {
  title: string; startDate: string; startTime: string; endDate: string; endTime: string; allDay: boolean;
}) {
  const profile = await getProfile();
  if (!profile) throw new Error("Sessió no vàlida");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error("Data d'inici no vàlida");
  const created = await createUnavailabilityEvent(profile.clerkUserId, input);
  revalidateArtist();
  return created;
}

export async function deleteUnavailabilityAction(id: string) {
  const profile = await getProfile();
  if (!profile) throw new Error("Sessió no vàlida");
  await deleteUnavailabilityEvent(profile.clerkUserId, id);
  revalidateArtist();
}
