import { randomBytes } from "node:crypto";
import { db } from "./db";
import { normalize } from "./text";

export type ProfileBand = {
  id: string;
  name: string;
  logo: string;
  color1: string;
  color2: string;
  instruments: string[];
  role: string;
};

export type ProfileConcert = {
  id: string;
  date: string;
  city: string;
  venue: string;
  bandId: string;
  bandName: string;
  bandColor: string;
  status: string;
  answer: "yes" | "no" | "pending";
};

export type ProfileSong = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  songKey: string;
  bandId: string;
  bandName: string;
  bandColor: string;
  coverUrl: string;
  audioFileId: string | null;
};

export type PersonProfileData = {
  token: string;
  workspaceId: string;
  name: string;
  clerkUserId: string | null;
  photoFileId: string | null;
  bio: string;
  igHandle: string;
  hiddenBands: string[];
  bands: ProfileBand[];        // només les visibles
  allBandIds: { id: string; name: string }[]; // totes (per a l'editor de visibilitat)
  instruments: string[];
  concerts: ProfileConcert[];  // dels grups visibles
  songs: ProfileSong[];
  totalConcerts: number;
  since: string | null;
};

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// Crea (o troba) el perfil d'una persona d'un workspace i torna el token.
export async function getOrCreatePersonProfile(workspaceId: string, personName: string): Promise<string> {
  const pool = db();
  const existing = (await pool.query(
    "select id from person_profiles where workspace_id=$1 and lower(person_name)=lower($2)",
    [workspaceId, personName]
  )).rows[0];
  if (existing) return existing.id;

  // Vinculació automàtica amb el compte d'Escenari si n'hi ha (per nom).
  const linked = (await pool.query(
    `select bm.clerk_user_id from band_members bm
     join bands b on b.id = bm.band_id
     where b.workspace_id=$1 and lower(bm.member_name)=lower($2)
     limit 1`,
    [workspaceId, personName]
  )).rows[0];

  const id = "p_" + randomBytes(10).toString("base64url");
  await pool.query(
    "insert into person_profiles (id, workspace_id, person_name, clerk_user_id) values ($1,$2,$3,$4)",
    [id, workspaceId, personName, linked?.clerk_user_id || null]
  );
  return id;
}

export async function getPersonProfileData(token: string): Promise<PersonProfileData | null> {
  const pool = db();
  const row = (await pool.query("select * from person_profiles where id=$1", [token])).rows[0];
  if (!row) return null;

  const nameKey = normalize(row.person_name);
  const hiddenBands: string[] = row.hidden_bands || [];

  const bandsRows = (await pool.query("select * from bands where workspace_id=$1", [row.workspace_id])).rows;
  const memberBands = bandsRows.filter((b) =>
    (b.members || []).some((m: { name: string }) => normalize(m.name) === nameKey)
  );
  const allBandIds = memberBands.map((b) => ({ id: b.id, name: b.name }));
  const visible = memberBands.filter((b) => !hiddenBands.includes(b.id));

  const instruments: string[] = [];
  const seenIns: Record<string, boolean> = {};
  const bands: ProfileBand[] = visible.map((b) => {
    const me = (b.members || []).find((m: { name: string }) => normalize(m.name) === nameKey);
    const ins: string[] = me?.instruments?.length ? me.instruments : String(me?.role || "").split(/[,/]| i /i).map((s: string) => s.trim()).filter(Boolean);
    ins.forEach((i) => { const k = i.toLowerCase(); if (!seenIns[k]) { seenIns[k] = true; instruments.push(i); } });
    return {
      id: b.id, name: b.name, logo: b.logo || "", color1: b.color1 || "", color2: b.color2 || "",
      instruments: ins, role: me?.role || "",
    };
  });

  const visibleIds = visible.map((b) => b.id);
  let concerts: ProfileConcert[] = [];
  let songs: ProfileSong[] = [];
  if (visibleIds.length) {
    const cRows = (await pool.query(
      `select id, date, city, venue, band_id, band_name, status, attendance from concerts
       where workspace_id=$1 and band_id = any($2) and status <> 'cancel·lat'
       order by date`,
      [row.workspace_id, visibleIds]
    )).rows;
    concerts = cRows.map((c) => {
      const att = Object.entries(c.attendance || {}).find(([n]) => normalize(n) === nameKey)?.[1];
      const band = visible.find((b) => b.id === c.band_id);
      return {
        id: c.id,
        date: toDateStr(c.date),
        city: c.city,
        venue: c.venue,
        bandId: c.band_id,
        bandName: c.band_name,
        bandColor: band?.color1 || "#8b7bff",
        status: c.status,
        answer: att === "yes" ? "yes" : att === "no" ? "no" : "pending",
      };
    });

    const sRows = (await pool.query(
      `select s.id, s.title, s.artist, s.duration, s.song_key, s.band_id, s.cover_url,
              (select f.id from files f where f.song_id = s.id and f.mime like 'audio%' order by f.created_at limit 1) as audio_id
       from songs s where s.band_id = any($1) order by lower(s.title)`,
      [visibleIds]
    )).rows;
    songs = sRows.map((s) => {
      const band = visible.find((b) => b.id === s.band_id);
      return {
        id: s.id, title: s.title, artist: s.artist, duration: s.duration, songKey: s.song_key,
        bandId: s.band_id, bandName: band?.name || "", bandColor: band?.color1 || "#8b7bff",
        coverUrl: s.cover_url || "",
        audioFileId: s.audio_id || null,
      };
    });
  }

  const past = concerts.filter((c) => c.answer === "yes");
  return {
    token: row.id,
    workspaceId: row.workspace_id,
    name: row.person_name,
    clerkUserId: row.clerk_user_id,
    photoFileId: row.photo_file_id,
    bio: row.bio || "",
    igHandle: row.ig_handle || "",
    hiddenBands,
    bands,
    allBandIds,
    instruments,
    concerts,
    songs,
    totalConcerts: past.length,
    since: concerts.length ? concerts[0].date.slice(0, 4) : null,
  };
}
