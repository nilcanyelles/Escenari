"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
import { getOrCreatePersonProfile } from "@/lib/person-profile";
import { normalize } from "@/lib/text";
import { uploadFileBlob } from "@/lib/blob-storage";

// Desa el perfil del gestor des del menú de compte: foto, WhatsApp, telèfon,
// correu de contacte i rol. Sincronitza les entrades d'equip tècnic (crew)
// que porten el seu nom a tots els grups del workspace.
export async function saveManagerProfileAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireManagerAction();
  const pool = db();
  const name = (profile.name || "").trim();
  if (!name) return { ok: false, error: "El teu compte no té nom" };

  const phone = String(formData.get("phone") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const roleLabel = String(formData.get("role") || "").trim() || "Mànager";

  const token = await getOrCreatePersonProfile(profile.workspaceId, name);
  await pool.query("update person_profiles set clerk_user_id=$1 where id=$2 and clerk_user_id is null", [profile.clerkUserId, token]);

  // Foto opcional (mateix circuit que els perfils de músic: taula files).
  const file = formData.get("photo") as File | null;
  if (file && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "La foto pot fer 8 MB com a màxim" };
    if (!file.type.startsWith("image/")) return { ok: false, error: "La foto ha de ser una imatge" };
    const buf = Buffer.from(await file.arrayBuffer());
    const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
    const blobUrl = await uploadFileBlob("files/" + id, buf, file.type);
    await pool.query(
      "insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, blob_url) values ($1,$2,null,null,$3,$4,$5,null,$6,$7)",
      [id, profile.workspaceId, file.name || "foto", file.type, file.size, name, blobUrl]
    );
    await pool.query("update person_profiles set photo_file_id=$1 where id=$2", [id, token]);
  }

  await pool.query(
    "update person_profiles set phone=$1, whatsapp=$2, role_label=$3, contact_email=$4 where id=$5",
    [phone, whatsapp, roleLabel, email, token]
  );

  // Propaga el contacte a totes les entrades amb el seu nom (crew i members).
  const key = normalize(name);
  const bands = (await pool.query("select id, members, crew from bands where workspace_id=$1", [profile.workspaceId])).rows;
  for (const b of bands) {
    let changed = false;
    const patch = (m: { name: string; role: string }, isCrew: boolean) => {
      if (normalize(m.name) !== key) return m;
      changed = true;
      return { ...m, phone, whatsapp, email, role: isCrew ? roleLabel : m.role };
    };
    const members = (b.members || []).map((m: { name: string; role: string }) => patch(m, false));
    const crew = (b.crew || []).map((m: { name: string; role: string }) => patch(m, true));
    if (changed) await pool.query("update bands set members=$1, crew=$2 where id=$3", [JSON.stringify(members), JSON.stringify(crew), b.id]);
  }

  revalidatePath("/grup");
  revalidatePath("/agenda");
  return { ok: true };
}
