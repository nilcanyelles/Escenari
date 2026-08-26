import { db } from "./db";

export type SongFile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  instrument: string; // partitura etiquetada per instrument ("" = general)
  createdAt: string;
};

export type Song = {
  id: string;
  bandId: string;
  title: string;
  artist: string;
  tempo: number;
  songKey: string;
  duration: string;
  tags: string[];
  notes: string;
  lyrics: string; // format ChordPro: acords [Am] dins de la lletra
  coverUrl: string;
  instruments: string[]; // quins instruments sonen en aquesta cançó
  files: SongFile[];
  updatedAt: string;
};

function iso(v: Date | string): string {
  return typeof v === "string" ? v : v.toISOString();
}

export async function getSongs(bandId: string): Promise<Song[]> {
  const { rows } = await db().query(
    `select s.*, coalesce(json_agg(json_build_object(
        'id', f.id, 'name', f.name, 'mime', f.mime, 'size', f.size, 'instrument', f.instrument, 'createdAt', f.created_at
      ) order by f.created_at) filter (where f.id is not null), '[]') as file_list
     from songs s
     left join files f on f.song_id = s.id
     where s.band_id=$1
     group by s.id
     order by lower(s.title)`,
    [bandId]
  );
  return rows.map((r) => ({
    id: r.id,
    bandId: r.band_id,
    title: r.title,
    artist: r.artist,
    tempo: r.tempo,
    songKey: r.song_key,
    duration: r.duration,
    tags: r.tags || [],
    notes: r.notes,
    lyrics: r.lyrics,
    coverUrl: r.cover_url || "",
    instruments: r.instruments || [],
    files: (r.file_list || []).map((f: Record<string, unknown>) => ({ ...f, instrument: f.instrument || "", createdAt: String(f.createdAt) })) as SongFile[],
    updatedAt: iso(r.updated_at),
  }));
}

export type BandFile = SongFile & { songId: string | null; uploadedBy: string };

export async function getBandFiles(bandId: string): Promise<BandFile[]> {
  const { rows } = await db().query(
    "select id, name, mime, size, song_id, uploaded_by, instrument, created_at from files where band_id=$1 order by created_at desc",
    [bandId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    mime: r.mime,
    size: r.size,
    instrument: r.instrument || "",
    songId: r.song_id,
    uploadedBy: r.uploaded_by,
    createdAt: iso(r.created_at),
  }));
}

// --------- Acords: transposició ChordPro ---------

const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_INDEX: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export function transposeChord(chord: string, semitones: number): string {
  return chord.replace(/([A-G][b#]?)/g, (root) => {
    const idx = NOTE_INDEX[root];
    if (idx === undefined) return root;
    return NOTES_SHARP[(idx + semitones + 120) % 12];
  });
}

// Divideix una línia ChordPro en trossos {chord, text} per pintar els acords
// damunt de la lletra.
export type LyricChunk = { chord: string; text: string };

export function parseChordLine(line: string): LyricChunk[] {
  const chunks: LyricChunk[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let pendingChord = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const text = line.slice(last, m.index);
    if (text || pendingChord) chunks.push({ chord: pendingChord, text });
    pendingChord = m[1];
    last = re.lastIndex;
  }
  chunks.push({ chord: pendingChord, text: line.slice(last) });
  return chunks;
}

export function hasChords(lyrics: string): boolean {
  return /\[[^\]]+\]/.test(lyrics);
}
