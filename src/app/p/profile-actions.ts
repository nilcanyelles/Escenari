"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/current-user";
import { getOrCreatePersonProfile } from "@/lib/person-profile";
import { normalize } from "@/lib/text";
import { uploadFileBlob } from "@/lib/blob-storage";

// person_profiles té un índex únic (workspace_id, lower(person_name)): si
// ja hi ha una altra fila amb aquest nom al mateix workspace (típic quan el
// gestor n'havia creat una a mà amb el mateix nom abans que es reclamés),
// renombrar-hi feia petar tot el desat amb un error de clau duplicada. Amb
// aquesta comprovació, si hi ha xoc es deixa aquesta fila concreta amb el
// nom vell — la resta (bands, band_members, profiles) es desa igualment.
async function renamePersonProfileSafely(pool: ReturnType<typeof db>, id: string, workspaceId: string, newName: string) {
  const clash = (await pool.query(
    "select 1 from person_profiles where workspace_id=$1 and lower(person_name)=lower($2) and id<>$3",
    [workspaceId, newName, id]
  )).rows[0];
  if (clash) return;
  await pool.query("update person_profiles set person_name=$1 where id=$2", [newName, id]);
}

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

// Bio, IG i visibilitat de grups i cançons: només el músic vinculat (o el
// gestor si no hi ha músic vinculat).
export async function updateProfileInfoAction(token: string, patch: { bio?: string; igHandle?: string; hiddenBands?: string[]; hiddenSongs?: string[] }) {
  const { row, isOwner, isManager } = await accessFor(token);
  if (!isOwner && !(isManager && !row.clerk_user_id)) throw new Error("Només el músic pot editar això");
  await db().query(
    `update person_profiles set
       bio = coalesce($1, bio),
       ig_handle = coalesce($2, ig_handle),
       hidden_bands = coalesce($3, hidden_bands),
       hidden_songs = coalesce($4, hidden_songs)
     where id=$5`,
    [patch.bio ?? null, patch.igHandle?.replace(/^@/, "") ?? null,
      patch.hiddenBands ? JSON.stringify(patch.hiddenBands) : null,
      patch.hiddenSongs ? JSON.stringify(patch.hiddenSongs) : null, token]
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
  const blobUrl = await uploadFileBlob("files/" + id, buf, file.type);
  await db().query(
    "insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, blob_url) values ($1,$2,null,null,$3,$4,$5,null,$6,$7)",
    [id, row.workspace_id, file.name || "foto", file.type, file.size, String(row.person_name), blobUrl]
  );
  await db().query("update person_profiles set photo_file_id=$1 where id=$2", [id, token]);
  revalidatePath(`/p/${token}`);
  return { ok: true };
}

// Nom, instruments i contacte (telèfon/correu): el gestor (quan el músic no
// té compte) o el mateix músic.
//
// Compte vinculat (isOwner): la font de veritat de "com et diuen a cada
// grup" és band_members (una fila per grup+compte) — mai person_name de
// person_profiles, que és només l'etiqueta d'UN workspace i es podia haver
// desincronitzat per una edició feta per un altre camí (p. ex. "Edita
// membres" del gestor). Buscar l'entrada a renombrar pel nom vell de
// person_profiles feia que, si ja hi havia hagut cap desincronia, el
// following no trobés res a canviar i semblés que "no es desava" — per
// això ara es fa per band_members.member_name, sempre. El nom es corregeix
// a TOTS els grups on siguis (fins i tot d'altres agències); instruments,
// telèfon i correu només al grup d'aquest perfil (són propis de cada grup).
//
// Sense compte (el gestor gestiona un perfil sense músic vinculat): només
// aquest workspace, i el matching és pel nom perquè no hi ha band_members
// ni res més fiable a què agafar-se.
export async function updatePersonAction(token: string, input: { name: string; instruments: string[]; phone?: string; email?: string }) {
  const { row, isOwner, isManager } = await accessFor(token);
  if (!isOwner && !isManager) throw new Error("Sense permís");
  if (row.clerk_user_id && !isOwner) throw new Error("Aquest músic gestiona el seu propi perfil");

  const pool = db();
  const newName = (input.name || String(row.person_name)).trim();
  const clerkUserId = row.clerk_user_id as string | null;

  if (clerkUserId) {
    const memberships = (await pool.query(
      `select bm.band_id, bm.member_name, b.workspace_id from band_members bm
       join bands b on b.id = bm.band_id
       where bm.clerk_user_id=$1`,
      [clerkUserId]
    )).rows;
    for (const ms of memberships) {
      const b = (await pool.query("select members, crew from bands where id=$1", [ms.band_id])).rows[0];
      if (!b) continue;
      const key = normalize(ms.member_name);
      const sameWorkspace = ms.workspace_id === row.workspace_id;
      let changed = false;
      const members = (b.members || []).map((m: { name: string; role: string; instruments?: string[]; phone?: string; email?: string }) => {
        if (normalize(m.name) !== key) return m;
        changed = true;
        return {
          ...m,
          name: newName,
          instruments: sameWorkspace ? input.instruments : m.instruments,
          role: sameWorkspace ? (input.instruments.join(", ") || m.role) : m.role,
          phone: sameWorkspace && input.phone !== undefined ? input.phone : m.phone,
          email: sameWorkspace && input.email !== undefined ? input.email : m.email,
        };
      });
      const crew = (b.crew || []).map((m: { name: string; role: string; phone?: string; email?: string }) => {
        if (normalize(m.name) !== key) return m;
        changed = true;
        return {
          ...m,
          name: newName,
          phone: sameWorkspace && input.phone !== undefined ? input.phone : m.phone,
          email: sameWorkspace && input.email !== undefined ? input.email : m.email,
        };
      });
      if (changed) await pool.query("update bands set members=$1, crew=$2 where id=$3", [JSON.stringify(members), JSON.stringify(crew), ms.band_id]);
    }
    // band_members.member_name és la clau amb què concerts.attendance sap
    // qui ets — es corregeix a tots els grups, no només el d'aquest perfil.
    await pool.query("update band_members set member_name=$1 where clerk_user_id=$2", [newName, clerkUserId]);
    // person_profiles: un per workspace on ja en tingui — es renombren tots
    // (saltant, sense petar, el/s que xoquin amb una altra fila ja existent).
    const myProfiles = (await pool.query("select id, workspace_id from person_profiles where clerk_user_id=$1", [clerkUserId])).rows;
    for (const pp of myProfiles) await renamePersonProfileSafely(pool, pp.id, pp.workspace_id, newName);
    // profiles.name és el nom del compte, independent de qualsevol grup: el
    // fa servir la barra lateral, "El meu perfil" i el perfil sense grup.
    await pool.query("update profiles set name=$1 where clerk_user_id=$2", [newName, clerkUserId]);
  } else {
    const oldKey = normalize(String(row.person_name));
    const patchPerson = (m: { name: string; role: string; instruments?: string[]; phone?: string; email?: string }, isMemberEntry: boolean) => ({
      ...m,
      name: newName,
      instruments: isMemberEntry ? input.instruments : m.instruments,
      role: isMemberEntry ? (input.instruments.join(", ") || m.role) : m.role,
      phone: input.phone !== undefined ? input.phone : m.phone,
      email: input.email !== undefined ? input.email : m.email,
    });
    const bands = (await pool.query("select id, members, crew from bands where workspace_id=$1", [row.workspace_id])).rows;
    for (const b of bands) {
      let changed = false;
      const members = (b.members || []).map((m: { name: string; role: string }) => {
        if (normalize(m.name) !== oldKey) return m;
        changed = true;
        return patchPerson(m, true);
      });
      const crew = (b.crew || []).map((m: { name: string; role: string }) => {
        if (normalize(m.name) !== oldKey) return m;
        changed = true;
        return patchPerson(m, false);
      });
      if (changed) await pool.query("update bands set members=$1, crew=$2 where id=$3", [JSON.stringify(members), JSON.stringify(crew), b.id]);
    }
    await renamePersonProfileSafely(pool, token, row.workspace_id as string, newName);
  }

  revalidatePath(`/p/${token}`);
  revalidatePath("/grup");
  revalidatePath("/artista");
}
