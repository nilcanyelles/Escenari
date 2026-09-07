// Lectura automàtica de xifres de xarxes socials: per a cada plataforma es
// visita l'enllaç públic desat al grup (mai cap API oficial ni cap compte
// connectat) i se'n llegeix directament el nombre que hi surt al codi de
// la pàgina — el mateix truc que ja es feia servir per als oients mensuals
// de Spotify (que no té cap API pública), ara per a tots. Si la plataforma
// canvia la pàgina o bloqueja la petició, la xifra es queda com estava i
// es pot escriure a mà — mai peta la resta del refresc.

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// "12.345", "12,345", "1.2K", "1,2M", "3B" → nombre. Amb sufix (K/M/B) el
// punt o la coma són decimals; sense sufix, separadors de milers.
function parseCompactNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  const m = s.match(/^([\d.,]+)([kKmMbB])?$/);
  if (!m) return null;
  if (m[2]) {
    const v = parseFloat(m[1].replace(",", "."));
    if (Number.isNaN(v)) return null;
    const suf = m[2].toLowerCase();
    return Math.round(v * (suf === "b" ? 1e9 : suf === "m" ? 1e6 : 1e3));
  }
  const v = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return Number.isNaN(v) ? null : v;
}

// Subscriptors i visites totals del canal, llegits directament de la
// pàgina pública "/about" (el mateix header amb els subscriptors surt a
// qualsevol pestanya, però les visites totals només a "about").
export async function fetchYoutubeStats(channelUrl: string): Promise<{ subscribers: number | null; views: number | null } | null> {
  const base = channelUrl.trim().replace(/\/+$/, "");
  if (!base) return null;
  const html = await fetchHtml(base.includes("/about") ? base : base + "/about");
  if (!html) return null;

  // Actualment "subscriberCountText"/"viewCountText" del canal són cadenes
  // planes ("46.2M subscribers"), no objectes {"simpleText":...} — es
  // proven totes dues formes (la vella es deixa com a resguard, per si
  // YouTube hi torna) i, si de cas, un text solt.
  let subscribers: number | null = null;
  let m = html.match(/"subscriberCountText"\s*:\s*"([^"]+)"/) || html.match(/"subscriberCountText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/);
  if (m) subscribers = parseCompactNumber(m[1].replace(/\s*subscribers?/i, ""));
  if (subscribers == null) {
    m = html.match(/([\d.,]+\s*[KMB]?)\s*subscribers/i);
    if (m) subscribers = parseCompactNumber(m[1]);
  }

  let views: number | null = null;
  m = html.match(/"viewCountText"\s*:\s*"([^"]+)"/) || html.match(/"viewCountText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/);
  if (m) views = parseCompactNumber(m[1].replace(/[^\d.,KMBkmb]/g, ""));

  return { subscribers, views };
}

// Oients mensuals, llegits directament de la pàgina pública de l'artista —
// cap API els dona. Els seguidors de Spotify NO es llegeixen enlloc: la
// pàgina pública els carrega amb JavaScript un cop al navegador, mai els
// serveix al codi que rep el servidor.
export async function fetchSpotifyMonthlyListeners(artistUrl: string): Promise<number | null> {
  const html = await fetchHtml(artistUrl.trim());
  if (!html) return null;

  let m = html.match(/"monthlyListeners"\s*:\s*(\d+)/);
  if (m) return Number(m[1]);
  const meta = html.match(/([\d.,]+\s*[KMkm]?)\s+monthly listeners/i);
  return meta ? parseCompactNumber(meta[1]) : null;
}

// instagram.com/username(/) → username.
function instagramUsername(profileUrl: string): string | null {
  try {
    const u = new URL(profileUrl.trim());
    const seg = u.pathname.split("/").filter(Boolean)[0];
    return seg || null;
  } catch {
    return null;
  }
}

// Seguidors d'Instagram: la pàgina pública en si no porta cap dada (arriba
// buida, un embolcall que ho carrega tot amb JavaScript un cop al
// navegador — mai serveix cap xifra a una petició sense navegador). El
// mateix perfil públic, per sota, es basa en aquest punt intern del propi
// lloc (l'ID d'app és constant i públic, el fa servir el web d'Instagram
// per a qualsevol visitant sense sessió) — quan Instagram no el bloqueja,
// torna els seguidors de veres; si hi ha massa trànsit des d'aquest
// servidor, respon que cal esperar uns minuts i es queda com estava.
export async function fetchInstagramFollowers(profileUrl: string): Promise<number | null> {
  const username = instagramUsername(profileUrl);
  if (!username) return null;
  try {
    const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9", "x-ig-app-id": "936619743392459" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const followers = data?.data?.user?.edge_followed_by?.count;
    return followers != null ? Number(followers) : null;
  } catch {
    return null;
  }
}

// Seguidors de TikTok, llegits del bloc de dades incrustat a la pàgina
// pública del perfil.
export async function fetchTiktokFollowers(profileUrl: string): Promise<number | null> {
  const html = await fetchHtml(profileUrl.trim());
  if (!html) return null;
  let m = html.match(/"followerCount"\s*:\s*(\d+)/);
  if (m) return Number(m[1]);
  m = html.match(/([\d.,]+\s*[KMkm]?)\s*Followers/i);
  return m ? parseCompactNumber(m[1]) : null;
}
