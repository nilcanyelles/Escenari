import { randomBytes } from "node:crypto";
import { db } from "./db";
import { normalize } from "./text";
import { today } from "./format";
import { instrumentsFor } from "./tags";
import type { Person, SocialLinks, SocialPlatform, SocialStats, SocialTracking } from "./types";
import { SOCIAL_PLATFORMS, isTracked } from "./social-history";

// Pàgina pública del grup (/g/token): logo, presentació, membres i xifres.

export type PublicMember = {
  name: string;
  instruments: string[];
  role: string;
  photoFileId: string | null;
  igHandle: string;
};

export type BandPublicData = {
  token: string;
  bandId: string;
  workspaceId: string;
  name: string;
  logo: string;
  coverUrl: string;
  color1: string;
  color2: string;
  tags: string[];
  city: string;
  bio: string;
  socialLinks: SocialLinks;
  socialStats: SocialStats;
  trackedPlatforms: SocialPlatform[];
  members: PublicMember[];
  stats: { concertsDone: number; upcoming: number; since: string | null };
};

// Crea (si encara no hi és) l'enllaç compartible del grup i el torna.
export async function getOrCreateBandPublicToken(bandId: string): Promise<string> {
  const pool = db();
  const row = (await pool.query("select public_token from bands where id=$1", [bandId])).rows[0];
  if (!row) throw new Error("Grup no trobat");
  if (row.public_token) return row.public_token;
  const token = "g_" + randomBytes(10).toString("base64url");
  const set = (await pool.query(
    "update bands set public_token=$1 where id=$2 and public_token is null returning public_token",
    [token, bandId]
  )).rows[0];
  if (set) return set.public_token;
  // Una altra petició l'ha creat mentrestant: es reutilitza el seu.
  return (await pool.query("select public_token from bands where id=$1", [bandId])).rows[0].public_token;
}

export async function getBandPublicData(token: string): Promise<BandPublicData | null> {
  const pool = db();
  const b = (await pool.query("select * from bands where public_token=$1", [token])).rows[0];
  if (!b) return null;

  const [profRows, concertRows, accountRows] = await Promise.all([
    pool.query("select person_name, photo_file_id, ig_handle from person_profiles where workspace_id=$1", [b.workspace_id]),
    pool.query(
      `select to_char(date, 'YYYY-MM-DD') as date from concerts
       where band_id=$1 and coalesce(kind, 'bolo')='bolo' and status <> 'cancel·lat'`,
      [b.id]
    ),
    pool.query("select platform from band_social_accounts where band_id=$1", [b.id]),
  ]);
  const photos: Record<string, string> = {};
  const igs: Record<string, string> = {};
  profRows.rows.forEach((r) => {
    if (r.photo_file_id) photos[normalize(r.person_name)] = r.photo_file_id;
    if (r.ig_handle) igs[normalize(r.person_name)] = r.ig_handle;
  });

  const t = today();
  const dates: string[] = concertRows.rows.map((r) => r.date);
  const done = dates.filter((d) => d < t).length;
  const upcoming = dates.filter((d) => d >= t).length;
  const since = dates.length ? dates.slice().sort()[0].slice(0, 4) : null;

  const links: SocialLinks = b.social_links || {};
  const tracking: SocialTracking = b.social_tracking || {};
  const connected = new Set<string>(accountRows.rows.map((r) => r.platform));
  const trackedPlatforms = SOCIAL_PLATFORMS.filter((p) => isTracked(p, tracking, links, connected.has(p)));

  const members: PublicMember[] = ((b.members || []) as Person[]).map((m) => ({
    name: m.name,
    instruments: instrumentsFor(m),
    role: m.role || "",
    photoFileId: photos[normalize(m.name)] || null,
    igHandle: igs[normalize(m.name)] || "",
  }));

  return {
    token,
    bandId: b.id,
    workspaceId: b.workspace_id,
    name: b.name,
    logo: b.logo || "",
    coverUrl: b.cover_url || "",
    color1: b.color1 || "",
    color2: b.color2 || "",
    tags: b.tags || [],
    city: b.city || "",
    bio: b.bio || "",
    socialLinks: links,
    socialStats: b.social_stats || {},
    trackedPlatforms,
    members,
    stats: { concertsDone: done, upcoming, since },
  };
}
