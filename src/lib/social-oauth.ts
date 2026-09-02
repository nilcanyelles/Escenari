// Connexió per OAuth amb les xarxes que no tenen cap via pública per llegir
// els seguidors (Instagram i TikTok): el grup inicia sessió un cop a la
// plataforma, i els tokens es queden al servidor (band_social_accounts) per
// refrescar-ne les xifres cada dia sense que ningú hagi de tornar a entrar.
//
//  · Instagram: "API d'Instagram amb inici de sessió d'Instagram" (Meta for
//    Developers). Cal un compte professional (Business o Creator), una app
//    amb el producte Instagram i l'URI de redirecció registrada. Tokens de
//    llarga durada (60 dies), renovables mentre s'usin.
//  · TikTok: Login Kit + Display API (TikTok for Developers) amb els scopes
//    user.info.basic i user.info.stats. Token d'accés de 24 h amb refresh
//    token d'un any.
//
// Sense les claus corresponents a .env.local, el botó "Connecta" no surt i
// la xifra s'introdueix a mà.

export type OAuthPlatform = "instagram" | "tiktok";

export const OAUTH_COOKIE = "escenari_social_oauth";

export function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3001";
}

export function instagramConfigured(): boolean {
  return !!process.env.INSTAGRAM_APP_ID && !!process.env.INSTAGRAM_APP_SECRET;
}
export function tiktokConfigured(): boolean {
  return !!process.env.TIKTOK_CLIENT_KEY && !!process.env.TIKTOK_CLIENT_SECRET;
}
export function isOAuthPlatform(p: string): p is OAuthPlatform {
  return p === "instagram" || p === "tiktok";
}
export function oauthConfigured(p: OAuthPlatform): boolean {
  return p === "instagram" ? instagramConfigured() : tiktokConfigured();
}

export function redirectUri(p: OAuthPlatform): string {
  return `${appBaseUrl()}/api/social/${p}/callback`;
}

export function authorizeUrl(p: OAuthPlatform, state: string): string {
  if (p === "instagram") {
    const q = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID || "",
      redirect_uri: redirectUri(p),
      response_type: "code",
      scope: "instagram_business_basic",
      state,
      enable_fb_login: "0",
      force_authentication: "1",
    });
    return `https://www.instagram.com/oauth/authorize?${q.toString()}`;
  }
  const q = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY || "",
    redirect_uri: redirectUri(p),
    response_type: "code",
    scope: "user.info.basic,user.info.stats",
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q.toString()}`;
}

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
  externalId: string;
  username: string;
};

async function postForm(url: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error;
    const msg = (data.error_message as string) || (data.error_description as string) ||
      (err && typeof err === "object" ? (err as { message?: string }).message : (err as string)) ||
      `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return data;
}

// Perfil (nom d'usuari + seguidors) del compte d'Instagram connectat.
export async function fetchInstagramProfile(accessToken: string): Promise<{ id: string; username: string; followers: number | null } | null> {
  try {
    const res = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username,followers_count&access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d?.id) return null;
    return { id: String(d.id), username: d.username || "", followers: d.followers_count != null ? Number(d.followers_count) : null };
  } catch {
    return null;
  }
}

// Perfil (nom + seguidors) del compte de TikTok connectat.
export async function fetchTiktokProfile(accessToken: string): Promise<{ id: string; username: string; followers: number | null } | null> {
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const u = d?.data?.user;
    if (!u?.open_id) return null;
    return { id: String(u.open_id), username: u.display_name || "", followers: u.follower_count != null ? Number(u.follower_count) : null };
  } catch {
    return null;
  }
}

// Bescanvia el codi de la redirecció per tokens (i de passada llegeix el nom
// d'usuari per mostrar "Connectat com @…").
export async function exchangeCode(p: OAuthPlatform, code: string): Promise<OAuthTokens> {
  if (p === "instagram") {
    const short = await postForm("https://api.instagram.com/oauth/access_token", {
      client_id: process.env.INSTAGRAM_APP_ID || "",
      client_secret: process.env.INSTAGRAM_APP_SECRET || "",
      grant_type: "authorization_code",
      redirect_uri: redirectUri(p),
      code,
    });
    // La resposta pot venir com a {data: [{access_token, user_id}]} o plana.
    const first = (Array.isArray(short.data) ? short.data[0] : short) as Record<string, unknown>;
    const shortToken = String(first?.access_token || "");
    if (!shortToken) throw new Error("Instagram no ha retornat cap token");
    // Token de llarga durada (60 dies), renovable.
    const longRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(process.env.INSTAGRAM_APP_SECRET || "")}&access_token=${encodeURIComponent(shortToken)}`);
    const long = (await longRes.json().catch(() => ({}))) as Record<string, unknown>;
    const accessToken = String(long.access_token || shortToken);
    const expiresIn = Number(long.expires_in || 3600);
    const profile = await fetchInstagramProfile(accessToken);
    return {
      accessToken,
      refreshToken: "",
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      externalId: profile?.id || String(first?.user_id || ""),
      username: profile?.username || "",
    };
  }
  const tok = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
    client_key: process.env.TIKTOK_CLIENT_KEY || "",
    client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
    grant_type: "authorization_code",
    redirect_uri: redirectUri(p),
    code,
  });
  const accessToken = String(tok.access_token || "");
  if (!accessToken) throw new Error(String(tok.error_description || "TikTok no ha retornat cap token"));
  const profile = await fetchTiktokProfile(accessToken);
  return {
    accessToken,
    refreshToken: String(tok.refresh_token || ""),
    expiresAt: new Date(Date.now() + Number(tok.expires_in || 86400) * 1000),
    externalId: profile?.id || String(tok.open_id || ""),
    username: profile?.username || "",
  };
}

// Renova els tokens quan cal (Instagram: abans que caduquin els 60 dies;
// TikTok: cada dia, amb el refresh token). Torna null si no s'ha pogut.
export async function refreshTokens(p: OAuthPlatform, account: { accessToken: string; refreshToken: string }): Promise<Partial<OAuthTokens> | null> {
  try {
    if (p === "instagram") {
      const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(account.accessToken)}`);
      const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || !d.access_token) return null;
      return { accessToken: String(d.access_token), expiresAt: new Date(Date.now() + Number(d.expires_in || 5184000) * 1000) };
    }
    if (!account.refreshToken) return null;
    const d = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
      client_key: process.env.TIKTOK_CLIENT_KEY || "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    });
    if (!d.access_token) return null;
    return {
      accessToken: String(d.access_token),
      refreshToken: String(d.refresh_token || account.refreshToken),
      expiresAt: new Date(Date.now() + Number(d.expires_in || 86400) * 1000),
    };
  } catch {
    return null;
  }
}
