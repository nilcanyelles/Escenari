import { db } from "./db";
import type { SocialLinks, SocialPlatform, SocialStats, SocialTracking } from "./types";
import { SOCIAL_PLATFORMS, SOCIAL_STAT_KEYS, isTracked, previousMonthValue, type SocialSnapshot } from "./social-history";
import { fetchYoutubeStats, fetchSpotifyFollowers, fetchSpotifyMonthlyListeners, youtubeConfigured, spotifyConfigured } from "./social-stats";
import { fetchInstagramProfile, fetchTiktokProfile, refreshTokens, type OAuthPlatform, type OAuthTokens } from "./social-oauth";

// Comptes connectats, instantànies diàries i el refresc de totes les xifres
// d'un grup (el mateix camí que fan servir la pàgina de xarxes, la
// redirecció OAuth i el cron diari).

export type SocialAccount = {
  platform: OAuthPlatform;
  externalId: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
  connectedAt: string;
};

function iso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.toISOString();
}

export async function getSocialAccounts(bandId: string): Promise<SocialAccount[]> {
  const { rows } = await db().query("select * from band_social_accounts where band_id=$1 order by platform", [bandId]);
  return rows.map((r) => ({
    platform: r.platform,
    externalId: r.external_id || "",
    username: r.username || "",
    accessToken: r.access_token || "",
    refreshToken: r.refresh_token || "",
    expiresAt: iso(r.expires_at),
    connectedAt: iso(r.connected_at) || "",
  }));
}

export async function saveSocialAccount(bandId: string, platform: OAuthPlatform, t: OAuthTokens) {
  await db().query(
    `insert into band_social_accounts (band_id, platform, external_id, username, access_token, refresh_token, expires_at, connected_at)
     values ($1,$2,$3,$4,$5,$6,$7, now())
     on conflict (band_id, platform) do update set
       external_id=excluded.external_id, username=excluded.username, access_token=excluded.access_token,
       refresh_token=excluded.refresh_token, expires_at=excluded.expires_at, connected_at=now()`,
    [bandId, platform, t.externalId, t.username, t.accessToken, t.refreshToken, t.expiresAt]
  );
}

export async function deleteSocialAccount(bandId: string, platform: OAuthPlatform) {
  await db().query("delete from band_social_accounts where band_id=$1 and platform=$2", [bandId, platform]);
}

// Renova el token si està a punt de caducar (o ja ho ha fet) i el desa; si
// la renovació falla, es prova igualment amb el que hi ha.
async function ensureFreshAccount(bandId: string, acc: SocialAccount): Promise<SocialAccount> {
  const exp = acc.expiresAt ? new Date(acc.expiresAt).getTime() : 0;
  const margin = acc.platform === "instagram" ? 15 * 86400e3 : 10 * 60e3;
  if (exp && exp - Date.now() > margin) return acc;
  const t = await refreshTokens(acc.platform, acc);
  if (!t?.accessToken) return acc;
  await db().query(
    "update band_social_accounts set access_token=$1, refresh_token=coalesce(nullif($2,''), refresh_token), expires_at=$3 where band_id=$4 and platform=$5",
    [t.accessToken, t.refreshToken || "", t.expiresAt || null, bandId, acc.platform]
  );
  return { ...acc, accessToken: t.accessToken, refreshToken: t.refreshToken || acc.refreshToken, expiresAt: t.expiresAt ? t.expiresAt.toISOString() : acc.expiresAt };
}

// Instantània d'avui (una per dia i grup: si ja n'hi ha, s'actualitza).
export async function saveSocialSnapshot(bandId: string, stats: SocialStats) {
  await db().query(
    `insert into band_social_snapshots (band_id, taken_on, stats) values ($1, current_date, $2)
     on conflict (band_id, taken_on) do update set stats=excluded.stats`,
    [bandId, JSON.stringify(stats || {})]
  );
}

export async function getSocialSnapshots(bandId: string, months = 13): Promise<SocialSnapshot[]> {
  const { rows } = await db().query(
    `select to_char(taken_on, 'YYYY-MM-DD') as taken_on, stats from band_social_snapshots
     where band_id=$1 and taken_on >= (current_date - ($2 || ' months')::interval)
     order by taken_on`,
    [bandId, String(months)]
  );
  return rows.map((r) => ({ takenOn: r.taken_on, stats: r.stats || {} }));
}

// Xifres de referència del mes passat (per als "+123" de la targeta d'Inici).
export async function getSocialPrevMonth(bandId: string, today: string): Promise<Partial<SocialStats>> {
  const snapshots = await getSocialSnapshots(bandId, 3);
  const out: Partial<SocialStats> = {};
  SOCIAL_STAT_KEYS.forEach((k) => {
    const v = previousMonthValue(snapshots, k, today);
    if (v != null) out[k] = v;
  });
  return out;
}

export type RefreshResult = {
  stats: SocialStats;
  updated: SocialPlatform[];
  errors: Partial<Record<SocialPlatform, string>>;
};

// Llegeix totes les xifres que es poden llegir soles de les xarxes amb
// seguiment actiu, les desa al grup i en guarda la instantània d'avui
// (encara que no s'hagi pogut llegir res: així les xifres manuals també
// deixen rastre mes a mes).
export async function refreshBandSocialStats(bandId: string): Promise<RefreshResult> {
  const row = (await db().query("select social_links, social_stats, social_tracking from bands where id=$1", [bandId])).rows[0];
  if (!row) throw new Error("Grup no trobat");
  const links: SocialLinks = row.social_links || {};
  const tracking: SocialTracking = row.social_tracking || {};
  const next: SocialStats = { ...(row.social_stats || {}) };
  const accounts = await getSocialAccounts(bandId);
  const updated: SocialPlatform[] = [];
  const errors: Partial<Record<SocialPlatform, string>> = {};

  for (const p of SOCIAL_PLATFORMS) {
    const acc = accounts.find((a) => a.platform === p);
    if (!isTracked(p, tracking, links, !!acc)) continue;
    try {
      if (p === "youtube") {
        if (!links.youtube) continue;
        if (!youtubeConfigured()) { errors.youtube = "Falta YOUTUBE_API_KEY al servidor"; continue; }
        const r = await fetchYoutubeStats(links.youtube);
        if (!r) { errors.youtube = "No s'ha pogut llegir el canal (comprova l'enllaç)"; continue; }
        if (r.views != null) next.youtubeViews = r.views;
        if (r.subscribers != null) next.youtubeSubscribers = r.subscribers;
        updated.push("youtube");
      } else if (p === "spotify") {
        if (!links.spotify) continue;
        let any = false;
        if (spotifyConfigured()) {
          const f = await fetchSpotifyFollowers(links.spotify);
          if (f != null) { next.spotifyFollowers = f; any = true; }
        } else {
          errors.spotify = "Falten SPOTIFY_CLIENT_ID/SECRET al servidor (seguidors)";
        }
        const ml = await fetchSpotifyMonthlyListeners(links.spotify);
        if (ml != null) { next.spotifyMonthlyListeners = ml; any = true; }
        if (any) updated.push("spotify");
        else if (!errors.spotify) errors.spotify = "No s'ha pogut llegir l'artista (comprova l'enllaç)";
      } else {
        // Instagram i TikTok: només amb el compte connectat; si no, manual.
        if (!acc) continue;
        const fresh = await ensureFreshAccount(bandId, acc);
        const prof = p === "instagram" ? await fetchInstagramProfile(fresh.accessToken) : await fetchTiktokProfile(fresh.accessToken);
        if (!prof || prof.followers == null) { errors[p] = "El compte connectat no respon — torna a connectar-lo"; continue; }
        if (p === "instagram") next.instagramFollowers = prof.followers; else next.tiktokFollowers = prof.followers;
        if (prof.username && prof.username !== fresh.username) {
          await db().query("update band_social_accounts set username=$1 where band_id=$2 and platform=$3", [prof.username, bandId, p]);
        }
        updated.push(p);
      }
    } catch (e) {
      errors[p] = e instanceof Error ? e.message : String(e);
    }
  }

  await db().query("update bands set social_stats=$1 where id=$2", [JSON.stringify(next), bandId]);
  await saveSocialSnapshot(bandId, next);
  return { stats: next, updated, errors };
}
