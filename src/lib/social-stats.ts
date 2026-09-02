// Lectura automàtica de xifres de xarxes socials a partir dels enllaços
// desats al grup — les que la plataforma dona sense que el grup hagi
// d'iniciar sessió enlloc:
//   · YouTube: subscriptors i visites totals del canal (API oficial de
//     dades v3, només cal una clau d'API).
//   · Spotify: seguidors de l'artista (API oficial, credencials d'aplicació)
//     i oients mensuals llegits de la pàgina pública de l'artista — cap API
//     els dona (només surten al web i a Spotify for Artists); si Spotify
//     canvia la pàgina, la xifra es queda com estava i es pot escriure a mà.
// Instagram i TikTok només donen els seguidors amb el compte connectat per
// OAuth (vegeu social-oauth.ts); sense connexió, s'introdueixen a mà.

export function youtubeConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}
export function spotifyConfigured(): boolean {
  return !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET;
}

// Accepta qualsevol forma d'URL de canal (/channel/UC..., /@handle, /c/Nom,
// /user/Nom) i en torna el paràmetre de cerca de l'API.
function youtubeChannelParam(channelUrl: string): string | null {
  try {
    const u = new URL(channelUrl.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "channel" && parts[1]) return `id=${encodeURIComponent(parts[1])}`;
    if (parts[0]?.startsWith("@")) return `forHandle=${encodeURIComponent(parts[0])}`;
    if (parts[0] === "c" && parts[1]) return `forHandle=${encodeURIComponent("@" + parts[1])}`;
    if (parts[0] === "user" && parts[1]) return `forUsername=${encodeURIComponent(parts[1])}`;
    return null;
  } catch {
    return null;
  }
}

// Subscriptors i visites totals del canal via l'API oficial de dades de
// YouTube (v3), pública amb una simple clau d'API (sense OAuth). Els
// subscriptors poden estar amagats pel canal (aleshores null).
export async function fetchYoutubeStats(channelUrl: string): Promise<{ views: number | null; subscribers: number | null } | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const param = youtubeChannelParam(channelUrl);
  if (!param) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&${param}&key=${key}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const st = data.items?.[0]?.statistics;
    if (!st) return null;
    return {
      views: st.viewCount != null ? Number(st.viewCount) : null,
      subscribers: st.hiddenSubscriberCount || st.subscriberCount == null ? null : Number(st.subscriberCount),
    };
  } catch {
    return null;
  }
}

let spotifyTokenCache: { token: string; expiresAt: number } | null = null;
async function getSpotifyAppToken(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (spotifyTokenCache && spotifyTokenCache.expiresAt > Date.now()) return spotifyTokenCache.token;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    spotifyTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return data.access_token;
  } catch {
    return null;
  }
}

// ID d'artista d'un enllaç open.spotify.com/artist/ID (amb o sense ?si=…).
function spotifyArtistId(artistUrl: string): string | null {
  try {
    const u = new URL(artistUrl.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("artist");
    return i >= 0 && parts[i + 1] ? parts[i + 1] : null;
  } catch {
    return null;
  }
}

// Seguidors de l'artista via l'API pública (credencials d'aplicació, mai
// d'usuari).
export async function fetchSpotifyFollowers(artistUrl: string): Promise<number | null> {
  const token = await getSpotifyAppToken();
  const id = spotifyArtistId(artistUrl);
  if (!token || !id) return null;
  try {
    const res = await fetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const followers = data.followers?.total;
    return followers != null ? Number(followers) : null;
  } catch {
    return null;
  }
}

// "12.345", "12,345", "1.2K", "1,2M" → nombre. Amb sufix (K/M) el punt o la
// coma són decimals; sense sufix, separadors de milers.
function parseCompactNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  const m = s.match(/^([\d.,]+)([kKmM])?$/);
  if (!m) return null;
  if (m[2]) {
    const v = parseFloat(m[1].replace(",", "."));
    if (Number.isNaN(v)) return null;
    return Math.round(v * (m[2].toLowerCase() === "m" ? 1e6 : 1e3));
  }
  const v = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return Number.isNaN(v) ? null : v;
}

// Oients mensuals: no hi ha cap API que els doni, però la pàgina pública de
// l'artista els porta a les metadades ("Artist · 45.7M monthly listeners").
// Compte: amb un User-Agent de navegador Spotify serveix només l'aplicació
// (sense metadades); amb el User-Agent per defecte de fetch serveix la
// pàgina renderitzada. Millor esforç: si la pàgina canvia, torna null i la
// xifra es queda com estava (o s'escriu a mà).
export async function fetchSpotifyMonthlyListeners(artistUrl: string): Promise<number | null> {
  const id = spotifyArtistId(artistUrl);
  if (!id) return null;
  try {
    const res = await fetch(`https://open.spotify.com/artist/${encodeURIComponent(id)}`, {
      headers: { "Accept-Language": "en" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const json = html.match(/"monthlyListeners"\s*:\s*(\d+)/);
    if (json) return Number(json[1]);
    const meta = html.match(/([\d.,]+\s*[KMkm]?)\s+monthly listeners/i);
    if (meta) return parseCompactNumber(meta[1]);
    return null;
  } catch {
    return null;
  }
}
