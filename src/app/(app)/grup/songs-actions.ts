"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/current-user";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per fitxer

// Repertori i fitxers: hi pot escriure el gestor del workspace o qualsevol
// membre del grup amb compte d'Escenari.
async function requireBandAccess(bandId: string): Promise<{ workspaceId: string; who: string }> {
  const profile = await getProfile();
  if (!profile) throw new Error("Sessió no vàlida");
  const band = (await db().query("select workspace_id from bands where id=$1", [bandId])).rows[0];
  if (!band) throw new Error("Grup no trobat");
  if (profile.role === "manager" && profile.workspaceId === band.workspace_id) {
    return { workspaceId: band.workspace_id, who: profile.name };
  }
  const member = (await db().query(
    "select 1 from band_members where band_id=$1 and clerk_user_id=$2", [bandId, profile.clerkUserId]
  )).rows[0];
  if (!member) throw new Error("Sense accés a aquest grup");
  return { workspaceId: band.workspace_id, who: profile.name };
}

function revalidateSongs(bandId: string) {
  revalidatePath("/grup");
  revalidatePath("/material/" + bandId);
}

export type SaveSongInput = {
  id: string | null;
  bandId: string;
  title: string;
  artist: string;
  tempo: number;
  songKey: string;
  duration: string;
  notes: string;
  lyrics: string;
};

export async function saveSongAction(input: SaveSongInput): Promise<{ id: string }> {
  const { workspaceId } = await requireBandAccess(input.bandId);
  const pool = db();
  if (input.id) {
    await pool.query(
      `update songs set title=$1, artist=$2, tempo=$3, song_key=$4, duration=$5, notes=$6, lyrics=$7
       where id=$8 and band_id=$9`,
      [(input.title || "Sense títol").trim(), input.artist || "", input.tempo || 0, input.songKey || "",
        input.duration || "", input.notes || "", input.lyrics || "", input.id, input.bandId]
    );
    revalidateSongs(input.bandId);
    return { id: input.id };
  }
  const id = "sg" + Date.now() + Math.floor(Math.random() * 1000);
  await pool.query(
    `insert into songs (id, workspace_id, band_id, title, artist, tempo, song_key, duration, notes, lyrics)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, workspaceId, input.bandId, (input.title || "Sense títol").trim(), input.artist || "",
      input.tempo || 0, input.songKey || "", input.duration || "", input.notes || "", input.lyrics || ""]
  );
  revalidateSongs(input.bandId);
  return { id };
}

export async function deleteSongAction(bandId: string, songId: string) {
  await requireBandAccess(bandId);
  await db().query("delete from songs where id=$1 and band_id=$2", [songId, bandId]);
  revalidateSongs(bandId);
}

// Importació ràpida: una cançó per línia — "Títol; Artista; Durada; To; Tempo".
export async function importSongsAction(bandId: string, raw: string): Promise<{ imported: number }> {
  const { workspaceId } = await requireBandAccess(bandId);
  const pool = db();
  let imported = 0;
  for (const line of (raw || "").split("\n")) {
    const parts = line.split(/[;,\t]/).map((p) => p.trim());
    const title = parts[0];
    if (!title) continue;
    const id = "sg" + Date.now() + Math.floor(Math.random() * 100000) + imported;
    await pool.query(
      `insert into songs (id, workspace_id, band_id, title, artist, duration, song_key, tempo)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, workspaceId, bandId, title, parts[1] || "", parts[2] || "", parts[3] || "", parseInt(parts[4], 10) || 0]
    );
    imported++;
  }
  revalidateSongs(bandId);
  return { imported };
}

// Pujada de fitxers (gravacions, documents, vídeos, memos de veu) via FormData.
export async function uploadFileAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const bandId = String(formData.get("bandId") || "");
  const songId = String(formData.get("songId") || "") || null;
  const file = formData.get("file") as File | null;
  if (!bandId || !file) return { ok: false, error: "Falta el fitxer" };
  const { workspaceId, who } = await requireBandAccess(bandId);
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Màxim 15 MB per fitxer" };
  const buf = Buffer.from(await file.arrayBuffer());
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  await db().query(
    `insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, workspaceId, bandId, songId, file.name || "fitxer", file.type || "application/octet-stream", file.size, buf, who]
  );
  revalidateSongs(bandId);
  return { ok: true };
}

export async function deleteFileAction(bandId: string, fileId: string) {
  await requireBandAccess(bandId);
  await db().query("delete from files where id=$1 and band_id=$2", [fileId, bandId]);
  revalidateSongs(bandId);
}
