"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getProfile } from "@/lib/current-user";
import { uploadFileBlob } from "@/lib/blob-storage";
import { NAV_APP_COOKIE, isNavApp } from "@/lib/nav-app";

// Perfil propi d'un artista sense cap grup encara: viu directament a
// `profiles` (workspace_id hi és null, així que person_profiles — que
// sempre necessita un workspace — no es pot fer servir). Quan s'uneixi a un
// grup, aquestes dades es copien al person_profiles nou (vegeu
// prefillPersonProfileFromStandalone a person-profile.ts) perquè no es
// perdi el que ja havia omplert.
export async function updateStandaloneProfileAction(patch: {
  bio?: string; igHandle?: string; phone?: string; whatsapp?: string; instruments?: string[]; navApp?: string;
}) {
  const me = await getProfile();
  if (!me) throw new Error("Sessió no vàlida");
  const navApp = isNavApp(patch.navApp) ? patch.navApp : null;
  await db().query(
    `update profiles set
       bio = coalesce($1, bio),
       ig_handle = coalesce($2, ig_handle),
       phone = coalesce($3, phone),
       whatsapp = coalesce($4, whatsapp),
       instruments = coalesce($5, instruments),
       nav_app = coalesce($6, nav_app)
     where clerk_user_id=$7`,
    [
      patch.bio ?? null,
      patch.igHandle !== undefined ? patch.igHandle.replace(/^@/, "") : null,
      patch.phone ?? null,
      patch.whatsapp ?? null,
      patch.instruments ? JSON.stringify(patch.instruments) : null,
      navApp,
      me.clerkUserId,
    ]
  );
  // Llegible pel navegador (no httpOnly): RouteSheetPreviewDoc (client, usat
  // arreu de l'app) el llegeix directament sense haver-lo de fer arribar
  // per props des de cada pàgina que l'incrusta.
  if (navApp) (await cookies()).set(NAV_APP_COOKIE, navApp, { path: "/", maxAge: 31536000, sameSite: "lax" });
  revalidatePath("/artista/perfil");
}

export async function uploadStandalonePhotoAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const me = await getProfile();
  if (!me) return { ok: false, error: "Sessió no vàlida" };
  const file = formData.get("file") as File | null;
  if (!file) return { ok: false, error: "Falta el fitxer" };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Màxim 8 MB" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Ha de ser una imatge" };
  const buf = Buffer.from(await file.arrayBuffer());
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  const blobUrl = await uploadFileBlob("files/" + id, buf, file.type);
  // Encara no té workspace (no s'ha unit a cap grup): la fila de "files" el
  // porta a null, com band_id/song_id per a qualsevol foto de perfil.
  await db().query(
    `insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, blob_url)
     values ($1,null,null,null,$2,$3,$4,null,$5,$6)`,
    [id, file.name || "foto", file.type, file.size, me.name, blobUrl]
  );
  await db().query("update profiles set photo_file_id=$1 where clerk_user_id=$2", [id, me.clerkUserId]);
  revalidatePath("/artista/perfil");
  return { ok: true };
}
