"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/current-user";
import { getOrCreatePersonProfile } from "@/lib/person-profile";
import { normalize } from "@/lib/text";

// Qui pot editar un perfil: el músic vinculat (tot el seu) o el gestor del
// workspace (nom, instruments i foto quan el músic no té compte).
async function accessFor(token: string): Promise<{ row: Record<string, unknown>; isOwner: boolean; isManager: boolean }> {
  const me = await getProfile();
  const row = (await db().query("select * from person_profiles where id=$1", [token])).rows[0];
  if (!row) throw new Error("Perfil no trobat");
  const isOwner = !!me && !!row.clerk_user_id && me.clerkUserId === row.clerk_user_id;
  const isManager = !!me && me.role === "manager" && me.workspaceId === row.workspace_id;
  if (!isOwner && !isManager) throw new Error("Sense permís");
  return { row, isOwner, isManager };
}

// El gestor obre (o crea) el perfil d'una persona des de la pàgina del grup.
export async function openPersonProfileAction(personName: string): Promise<{ token: string }> {
  const me = await getProfile();
  if (!me || me.role !== "manager" || !me.workspaceId) throw new Error("Sessió de gestor no vàlida");
  const token = await getOrCreatePersonProfile(me.workspaceId, personName);
  return { token };
}

// Un artista obre el seu propi perfil (primer workspace on és membre).
export async function openMyProfileAction(): Promise<{ token: string | null }> {
  const me = await getProfile();
  if (!me) throw new Error("Sessió no vàlida");
  const membership = (await db().query(
    `select b.workspace_id, bm.member_name from band_members bm
     join bands b on b.id = bm.band_id
     where bm.clerk_user_id=$1 order by bm.joined_at limit 1`,
    [me.clerkUserId]
  )).rows[0];
  if (!membership) return { token: null };
  const token = await getOrCreatePersonProfile(membership.workspace_id, membership.member_name || me.name);
  // Garanteix la vinculació amb el compte.
  await db().query("update person_profiles set clerk_user_id=$1 where id=$2 and clerk_user_id is null", [me.clerkUserId, token]);
  return { token };
}

// Bio, IG i visibilitat de grups: només el músic vinculat (o el gestor si no
// hi ha músic vinculat).
export async function updateProfileInfoAction(token: string, patch: { bio?: string; igHandle?: string; hiddenBands?: string[] }) {
  const { row, isOwner, isManager } = await accessFor(token);
  if (!isOwner && !(isManager && !row.clerk_user_id)) throw new Error("Només el músic pot editar això");
  await db().query(
    `update person_profiles set
       bio = coalesce($1, bio),
       ig_handle = coalesce($2, ig_handle),
       hidden_bands = coalesce($3, hidden_bands)
     where id=$4`,
    [patch.bio ?? null, patch.igHandle?.replace(/^@/, "") ?? null,
      patch.hiddenBands ? JSON.stringify(patch.hiddenBands) : null, token]
  );
  revalidatePath(`/p/${token}`);
}

// Foto de perfil (pujada pel músic o pel gestor).
export async function uploadProfilePhotoAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const token = String(formData.get("token") || "");
  const file = formData.get("file") as File | null;
  if (!token || !file) return { ok: false, error: "Falta el fitxer" };
  const { row } = await accessFor(token);
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Màxim 8 MB" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Ha de ser una imatge" };
  const buf = Buffer.from(await file.arrayBuffer());
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  await db().query(
    "insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by) values ($1,$2,null,null,$3,$4,$5,$6,$7)",
    [id, row.workspace_id, file.name || "foto", file.type, file.size, buf, String(row.person_name)]
  );
  await db().query("update person_profiles set photo_file_id=$1 where id=$2", [id, token]);
  revalidatePath(`/p/${token}`);
  return { ok: true };
}

// Nom i instruments: el gestor (quan el músic no té compte) o el mateix músic.
// Actualitza les entrades de members de tots els grups del workspace.
export async function updatePersonAction(token: string, input: { name: string; instruments: string[] }) {
  const { row, isOwner, isManager } = await accessFor(token);
  if (!isOwner && !isManager) throw new Error("Sense permís");
  if (row.clerk_user_id && !isOwner) throw new Error("Aquest músic gestiona el seu propi perfil");

  const pool = db();
  const newName = (input.name || String(row.person_name)).trim();
  const oldKey = normalize(String(row.person_name));
  const bands = (await pool.query("select id, members from bands where workspace_id=$1", [row.workspace_id])).rows;
  for (const b of bands) {
    let changed = false;
    const members = (b.members || []).map((m: { name: string; role: string; instruments?: string[] }) => {
      if (normalize(m.name) !== oldKey) return m;
      changed = true;
      return { ...m, name: newName, instruments: input.instruments, role: input.instruments.join(", ") || m.role };
    });
    if (changed) await pool.query("update bands set members=$1 where id=$2", [JSON.stringify(members), b.id]);
  }
  await pool.query("update person_profiles set person_name=$1 where id=$2", [newName, token]);
  revalidatePath(`/p/${token}`);
  revalidatePath("/grup");
}
