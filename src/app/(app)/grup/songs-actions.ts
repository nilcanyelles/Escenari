"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireBandAccess as requirePerm } from "@/lib/band-access";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB per fitxer (backing tracks en WAV poden pesar bastant)

// Repertori i fitxers: el gestor del workspace o un membre del grup amb el
// permís "Cançons" actiu (per defecte el tenen).
async function requireBandAccess(bandId: string): Promise<{ workspaceId: string; who: string }> {
  const access = await requirePerm(bandId, "songs");
  return { workspaceId: access.workspaceId, who: access.profile.name };
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
  coverUrl?: string;
  instruments?: string[];
};

export async function saveSongAction(input: SaveSongInput): Promise<{ id: string }> {
  const { workspaceId } = await requireBandAccess(input.bandId);
  const pool = db();
  if (input.id) {
    await pool.query(
      `update songs set title=$1, artist=$2, tempo=$3, song_key=$4, duration=$5, notes=$6, lyrics=$7, cover_url=$8, instruments=$9
       where id=$10 and band_id=$11`,
      [(input.title || "Sense títol").trim(), input.artist || "", input.tempo || 0, input.songKey || "",
        input.duration || "", input.notes || "", input.lyrics || "", input.coverUrl || "",
        JSON.stringify(input.instruments || []), input.id, input.bandId]
    );
    revalidateSongs(input.bandId);
    return { id: input.id };
  }
  const id = "sg" + Date.now() + Math.floor(Math.random() * 1000);
  await pool.query(
    `insert into songs (id, workspace_id, band_id, title, artist, tempo, song_key, duration, notes, lyrics, cover_url, instruments)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, workspaceId, input.bandId, (input.title || "Sense títol").trim(), input.artist || "",
      input.tempo || 0, input.songKey || "", input.duration || "", input.notes || "", input.lyrics || "", input.coverUrl || "",
      JSON.stringify(input.instruments || [])]
  );
  revalidateSongs(input.bandId);
  return { id };
}

// ---------- Autocompletat amb APIs obertes ----------
// iTunes Search (caràtula, artista, durada) + Deezer (BPM) + LRCLIB (lletra).
// Totes gratuïtes i sense clau. Per als acords no hi ha cap API oberta legal
// (Acords Catalans / Ultimate Guitar no en tenen): la lletra arriba neta i
// els acords s'hi afegeixen a mà amb [claudàtors].
export type SongLookupResult = {
  found: boolean;
  artist?: string;
  title?: string;
  duration?: string;
  coverUrl?: string;
  bpm?: number;
  lyrics?: string;
};

export async function lookupSongAction(bandId: string, title: string, artist: string): Promise<SongLookupResult> {
  await requireBandAccess(bandId);
  const q = `${title} ${artist}`.trim();
  if (!q) return { found: false };
  const out: SongLookupResult = { found: false };

  // iTunes: metadades + caràtula gran.
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1&country=ES`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const t = data.results?.[0];
      if (t) {
        out.found = true;
        out.artist = t.artistName;
        out.title = t.trackName;
        out.coverUrl = (t.artworkUrl100 || "").replace("100x100", "600x600");
        if (t.trackTimeMillis) {
          const secs = Math.round(t.trackTimeMillis / 1000);
          out.duration = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
        }
      }
    }
  } catch { /* segueix amb la resta */ }

  // Deezer: BPM (i caràtula de reserva).
  try {
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const t = data.data?.[0];
      if (t) {
        out.found = true;
        out.artist = out.artist || t.artist?.name;
        out.title = out.title || t.title;
        out.coverUrl = out.coverUrl || t.album?.cover_big || "";
        if (t.id) {
          const det = await fetch(`https://api.deezer.com/track/${t.id}`, { cache: "no-store" });
          if (det.ok) {
            const td = await det.json();
            if (td.bpm && td.bpm > 0) out.bpm = Math.round(td.bpm);
          }
        }
      }
    }
  } catch { /* segueix */ }

  // LRCLIB: lletra completa (sense acords).
  try {
    const params = new URLSearchParams({ track_name: out.title || title });
    if (out.artist || artist) params.set("artist_name", out.artist || artist);
    const res = await fetch(`https://lrclib.net/api/search?${params}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const hit = Array.isArray(data) ? data.find((d: { plainLyrics?: string }) => d.plainLyrics) : null;
      if (hit?.plainLyrics) {
        out.found = true;
        out.lyrics = hit.plainLyrics;
      }
    }
  } catch { /* res */ }

  return out;
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
  const instrument = String(formData.get("instrument") || "");
  const file = formData.get("file") as File | null;
  if (!bandId || !file) return { ok: false, error: "Falta el fitxer" };
  const { workspaceId, who } = await requireBandAccess(bandId);
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Màxim 100 MB per fitxer" };
  const buf = Buffer.from(await file.arrayBuffer());
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  await db().query(
    `insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, instrument)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, workspaceId, bandId, songId, file.name || "fitxer", file.type || "application/octet-stream", file.size, buf, who, instrument]
  );
  revalidateSongs(bandId);
  return { ok: true };
}

export async function deleteFileAction(bandId: string, fileId: string) {
  await requireBandAccess(bandId);
  await db().query("delete from files where id=$1 and band_id=$2", [fileId, bandId]);
  revalidateSongs(bandId);
}
