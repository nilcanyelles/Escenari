"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireBandAccess as requirePerm } from "@/lib/band-access";
import { getProfile } from "@/lib/current-user";
import { uploadFileBlob, deleteFileBlob } from "@/lib/blob-storage";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB per fitxer (backing tracks en WAV poden pesar bastant)
const MAX_TRACKS_PER_SONG = 10;
const MAX_TRACKS_PER_BAND = 150;

// Comprova els límits de pistes d'àudio (no compta partitures/imatges/etc.,
// només fitxers d'àudio lligats a una cançó) abans de deixar pujar-ne una
// de nova. Retorna un missatge d'error si s'ha arribat al límit.
export async function checkTrackLimits(bandId: string | null, songId: string | null): Promise<string | null> {
  if (songId) {
    const { rows } = await db().query(
      "select count(*)::int as n from files where song_id=$1 and mime like 'audio%'", [songId]
    );
    if (rows[0].n >= MAX_TRACKS_PER_SONG) {
      return `Aquesta cançó ja té el màxim de ${MAX_TRACKS_PER_SONG} pistes d'àudio. Elimina'n alguna abans d'afegir-ne una de nova.`;
    }
  }
  if (!bandId) return null; // les cançons pròpies només tenen el límit per cançó
  const { rows } = await db().query(
    "select count(*)::int as n from files where band_id=$1 and song_id is not null and mime like 'audio%'", [bandId]
  );
  if (rows[0].n >= MAX_TRACKS_PER_BAND) {
    return `El grup ja té el màxim de ${MAX_TRACKS_PER_BAND} pistes d'àudio en total. Elimina'n algunes abans de continuar.`;
  }
  return null;
}

// Repertori i fitxers: el gestor del workspace o un membre del grup amb el
// permís "Cançons" actiu (per defecte el tenen).
async function requireBandAccess(bandId: string): Promise<{ workspaceId: string; who: string }> {
  const access = await requirePerm(bandId, "songs");
  return { workspaceId: access.workspaceId, who: access.profile.name };
}

// Igual, però també per a les cançons pròpies d'un músic (sense grup): allà
// només hi pot tocar el seu propietari.
async function requireSongAccess(bandId: string | null, songId?: string | null): Promise<{ workspaceId: string | null; who: string; ownerId: string }> {
  if (bandId) {
    const access = await requirePerm(bandId, "songs");
    return { workspaceId: access.workspaceId, who: access.profile.name, ownerId: access.profile.clerkUserId };
  }
  const profile = await getProfile();
  if (!profile) throw new Error("Sessió no vàlida");
  if (songId) {
    const row = (await db().query("select band_id, owner_clerk_user_id from songs where id=$1", [songId])).rows[0];
    if (!row || row.band_id || row.owner_clerk_user_id !== profile.clerkUserId) throw new Error("Sense accés a aquesta cançó");
  }
  return { workspaceId: null, who: profile.name, ownerId: profile.clerkUserId };
}

function revalidateSongs(bandId: string | null) {
  revalidatePath("/grup");
  if (bandId) revalidatePath("/material/" + bandId);
  revalidatePath("/artista/biblioteca");
}

export type SaveSongInput = {
  id: string | null;
  bandId: string | null; // null = cançó pròpia del músic
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
  const bandId = input.bandId || null;
  const { workspaceId, ownerId } = await requireSongAccess(bandId, input.id);
  const pool = db();
  const values = [
    (input.title || "Sense títol").trim(), input.artist || "", input.tempo || 0, input.songKey || "",
    input.duration || "", input.notes || "", input.lyrics || "", input.coverUrl || "",
    JSON.stringify(input.instruments || []),
  ];
  if (input.id) {
    await pool.query(
      `update songs set title=$1, artist=$2, tempo=$3, song_key=$4, duration=$5, notes=$6, lyrics=$7, cover_url=$8, instruments=$9
       where id=$10 and ($11::text is null or band_id=$11::text)`,
      [...values, input.id, bandId]
    );
    revalidateSongs(bandId);
    return { id: input.id };
  }
  const id = "sg" + Date.now() + Math.floor(Math.random() * 1000);
  await pool.query(
    `insert into songs (id, workspace_id, band_id, owner_clerk_user_id, title, artist, tempo, song_key, duration, notes, lyrics, cover_url, instruments)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, workspaceId, bandId, bandId ? null : ownerId, ...values]
  );
  revalidateSongs(bandId);
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

export async function lookupSongAction(bandId: string | null, title: string, artist: string): Promise<SongLookupResult> {
  await requireSongAccess(bandId || null);
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

export async function deleteSongAction(bandId: string | null, songId: string) {
  const b = bandId || null;
  await requireSongAccess(b, songId);
  await db().query("delete from songs where id=$1 and ($2::text is null or band_id=$2::text)", [songId, b]);
  revalidateSongs(b);
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
// El binari va a Vercel Blob, no a Postgres — així no consumeix la quota de
// transferència de la base de dades.
export async function uploadFileAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const bandId = String(formData.get("bandId") || "") || null;
  const songId = String(formData.get("songId") || "") || null;
  const instrument = String(formData.get("instrument") || "");
  const file = formData.get("file") as File | null;
  if ((!bandId && !songId) || !file) return { ok: false, error: "Falta el fitxer" };
  const { workspaceId, who } = await requireSongAccess(bandId, songId);
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Màxim 100 MB per fitxer" };
  const mime = file.type || "application/octet-stream";
  if (mime.startsWith("audio")) {
    const limitError = await checkTrackLimits(bandId, songId);
    if (limitError) return { ok: false, error: limitError };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  const blobUrl = await uploadFileBlob("files/" + id, buf, mime);
  await db().query(
    `insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, instrument, blob_url)
     values ($1,$2,$3,$4,$5,$6,$7,null,$8,$9,$10)`,
    [id, workspaceId, bandId, songId, file.name || "fitxer", mime, file.size, who, instrument, blobUrl]
  );
  revalidateSongs(bandId);
  return { ok: true };
}

export async function deleteFileAction(bandId: string | null, fileId: string) {
  const b = bandId || null;
  let row: { blob_url?: string } | undefined;
  if (b) {
    await requireBandAccess(b);
    row = (await db().query("select blob_url from files where id=$1 and band_id=$2", [fileId, b])).rows[0];
    await db().query("delete from files where id=$1 and band_id=$2", [fileId, b]);
  } else {
    // Fitxer d'una cançó pròpia: només el seu propietari.
    const { ownerId } = await requireSongAccess(null);
    row = (await db().query(
      "select f.blob_url from files f join songs s on s.id = f.song_id where f.id=$1 and s.band_id is null and s.owner_clerk_user_id=$2",
      [fileId, ownerId]
    )).rows[0];
    if (!row) throw new Error("Sense accés a aquest fitxer");
    await db().query("delete from files where id=$1", [fileId]);
  }
  if (row?.blob_url) await deleteFileBlob(row.blob_url).catch(() => { /* orfe al blob, no bloquegem l'esborrat */ });
  revalidateSongs(b);
}

export type BandAudioUsage = {
  totalTracks: number;
  maxTracks: number;
  maxPerSong: number;
  songs: { songId: string; title: string; totalSize: number; tracks: { id: string; name: string; size: number }[] }[];
};

// Resum de totes les pistes d'àudio del grup, per al panell de "gestiona
// l'espai" que apareix quan es toca algun dels límits.
export async function getBandAudioUsageAction(bandId: string): Promise<BandAudioUsage> {
  await requireBandAccess(bandId);
  const { rows } = await db().query(
    `select s.id as song_id, s.title, f.id as file_id, f.name, f.size
     from files f join songs s on s.id = f.song_id
     where f.band_id=$1 and f.mime like 'audio%'
     order by lower(s.title), f.created_at`,
    [bandId]
  );
  const bySong = new Map<string, BandAudioUsage["songs"][number]>();
  let totalTracks = 0;
  rows.forEach((r) => {
    let entry = bySong.get(r.song_id);
    if (!entry) { entry = { songId: r.song_id, title: r.title, totalSize: 0, tracks: [] }; bySong.set(r.song_id, entry); }
    entry.tracks.push({ id: r.file_id, name: r.name, size: r.size });
    entry.totalSize += r.size || 0;
    totalTracks++;
  });
  return {
    totalTracks,
    maxTracks: MAX_TRACKS_PER_BAND,
    maxPerSong: MAX_TRACKS_PER_SONG,
    songs: Array.from(bySong.values()).sort((a, b) => b.tracks.length - a.tracks.length),
  };
}

// Buida totes les pistes d'àudio d'una cançó d'un cop (però no les
// partitures/documents que hi hagi).
export async function deleteSongAudioTracksAction(bandId: string, songId: string): Promise<{ deleted: number }> {
  await requireBandAccess(bandId);
  const { rows } = await db().query(
    "select id, blob_url from files where band_id=$1 and song_id=$2 and mime like 'audio%'", [bandId, songId]
  );
  if (rows.length === 0) return { deleted: 0 };
  await db().query(
    "delete from files where band_id=$1 and song_id=$2 and mime like 'audio%'", [bandId, songId]
  );
  await Promise.all(rows.map((r) => r.blob_url ? deleteFileBlob(r.blob_url).catch(() => {}) : Promise.resolve()));
  revalidateSongs(bandId);
  return { deleted: rows.length };
}
