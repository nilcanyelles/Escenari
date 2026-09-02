// Lectura automàtica de xifres públiques de xarxes socials a partir dels
// enllaços desats al grup — només allà on la plataforma ho permet sense que
// el grup hagi d'iniciar sessió enlloc:
//   · YouTube: visites totals del canal (API oficial, només calen una clau).
//   · Spotify: seguidors de l'artista (API oficial, credencials d'aplicació,
//     sense que ningú hagi d'iniciar sessió). Els "oients mensuals" NO són
//     una dada pública — només els veu el mateix grup a Spotify for Artists.
// Instagram i TikTok no tenen cap via pública sense que el compte
// s'autentiqui a cada plataforma (aprovació d'app + OAuth), així que es
// queden fora d'aquí — el manager els segueix introduint a mà.

export function youtubeConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}
export function spotifyConfigured(): boolean {
  return !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET;
}

// Accepta qualsevol forma d'URL de canal (/channel/UC..., /@handle, /c/Nom,
// /user/Nom) i en treu les visites totals via l'API oficial de dades de
// YouTube (v3), que és pública amb una simple clau d'API (sense OAuth).
export async function fetchYoutubeViews(channelUrl: string): Promise<number | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const u = new URL(channelUrl.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    let params: string;
    if (parts[0] === "channel" && parts[1]) {
      params = `id=${encodeURIComponent(parts[1])}`;
    } else if (parts[0]?.startsWith("@")) {
      params = `forHandle=${encodeURIComponent(parts[0])}`;
    } else if (parts[0] === "c" && parts[1]) {
      params = `forHandle=${encodeURIComponent("@" + parts[1])}`;
    } else if (parts[0] === "user" && parts[1]) {
      params = `forUsername=${encodeURIComponent(parts[1])}`;
    } else {
      return null;
    }
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&${params}&key=${key}`);
    if (!res.ok) return null;
    const data = await res.json();
    const views = data.items?.[0]?.statistics?.viewCount;
    return views != null ? Number(views) : null;
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

// Accepta un enllaç d'artista de Spotify (open.spotify.com/artist/ID) i en
// treu els seguidors via l'API pública (credencials d'aplicació, mai
// d'usuari).
export async function fetchSpotifyFollowers(artistUrl: string): Promise<number | null> {
  const token = await getSpotifyAppToken();
  if (!token) return null;
  try {
    const u = new URL(artistUrl.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("artist");
    const id = i >= 0 ? parts[i + 1] : null;
    if (!id) return null;
    const res = await fetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const followers = data.followers?.total;
    return followers != null ? Number(followers) : null;
  } catch {
    return null;
  }
}
