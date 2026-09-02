import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { OAUTH_COOKIE, appBaseUrl, exchangeCode, isOAuthPlatform } from "@/lib/social-oauth";
import { saveSocialAccount, refreshBandSocialStats } from "@/lib/social-sync";

export const dynamic = "force-dynamic";

// Tornada de la plataforma després d'iniciar-hi sessió: es comprova l'estat
// de la cookie, es bescanvia el codi per tokens, es desa el compte i es
// llegeixen les xifres de seguida.
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = new URL(req.url);
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/grup/xarxes?${q}`, appBaseUrl()));
    res.cookies.set(OAUTH_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  };
  if (!isOAuthPlatform(platform)) return back("error=plataforma");

  let state: { p?: string; b?: string; n?: string } = {};
  try {
    state = JSON.parse((await cookies()).get(OAUTH_COOKIE)?.value || "{}");
  } catch {
    state = {};
  }
  if (url.searchParams.get("error")) return back(`error=denegat&platform=${platform}`);
  const code = url.searchParams.get("code") || "";
  if (!code || state.p !== platform || !state.b || !state.n || state.n !== url.searchParams.get("state")) {
    return back(`error=estat&platform=${platform}`);
  }
  const bandId = state.b;

  try {
    const tokens = await exchangeCode(platform, code);
    await saveSocialAccount(bandId, platform, tokens);
    // Un compte acabat de connectar sempre passa a tenir seguiment actiu.
    await db().query(
      "update bands set social_tracking = coalesce(social_tracking, '{}'::jsonb) || jsonb_build_object($1::text, true) where id=$2",
      [platform, bandId]
    );
    await refreshBandSocialStats(bandId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(`error=intercanvi&platform=${platform}&detail=${encodeURIComponent(msg.slice(0, 140))}`);
  }
  revalidatePath("/grup");
  revalidatePath("/grup/xarxes");
  return back(`connected=${platform}`);
}
