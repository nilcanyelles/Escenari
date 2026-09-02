import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { OAUTH_COOKIE, appBaseUrl, authorizeUrl, isOAuthPlatform, oauthConfigured } from "@/lib/social-oauth";

export const dynamic = "force-dynamic";

// Inici de la connexió OAuth d'una xarxa (Instagram o TikTok) per a un grup:
// deixa l'estat de la connexió en una cookie i envia el gestor a la
// plataforma perquè hi iniciï sessió amb el compte del grup.
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const back = (q: string) => NextResponse.redirect(new URL(`/grup/xarxes?${q}`, appBaseUrl()));
  if (!isOAuthPlatform(platform)) return back("error=plataforma");
  const me = await getProfile();
  if (!me || me.role !== "manager" || !me.workspaceId) return back("error=sessio");
  const bandId = new URL(req.url).searchParams.get("bandId") || "";
  const owns = (await db().query("select 1 from bands where id=$1 and workspace_id=$2", [bandId, me.workspaceId])).rows[0];
  if (!owns) return back("error=grup");
  if (!oauthConfigured(platform)) return back(`error=config&platform=${platform}`);

  const nonce = randomBytes(12).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(platform, nonce));
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ p: platform, b: bandId, n: nonce }), {
    httpOnly: true,
    sameSite: "lax",
    secure: appBaseUrl().startsWith("https"),
    maxAge: 600,
    path: "/",
  });
  return res;
}
