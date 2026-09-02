import { redirect } from "next/navigation";
import SocialsView from "@/components/SocialsView";
import { getBands } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope } from "@/lib/band-scope";
import { getSocialAccounts, getSocialSnapshots } from "@/lib/social-sync";
import { youtubeConfigured, spotifyConfigured } from "@/lib/social-stats";
import { instagramConfigured, tiktokConfigured } from "@/lib/social-oauth";

export const dynamic = "force-dynamic";

// Xarxes socials del grup seleccionat: connexió de cada plataforma, de
// quines es fa seguiment, xifres actuals i evolució mes a mes.
export default async function XarxesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireManager();
  const [bands, selectedRaw, sp] = await Promise.all([getBands(profile.workspaceId), getSelectedBandId(), searchParams]);
  const bandId = resolveBandScope(bands, selectedRaw);
  if (!bandId) redirect("/agenda");
  const band = bands.find((b) => b.id === bandId)!;

  const [accounts, snapshots] = await Promise.all([getSocialAccounts(bandId), getSocialSnapshots(bandId, 13)]);
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] || "" : v || "");

  return (
    <SocialsView
      band={band}
      // Els tokens no surten mai del servidor: només qui és i des de quan.
      accounts={accounts.map((a) => ({ platform: a.platform, username: a.username, connectedAt: a.connectedAt, expiresAt: a.expiresAt }))}
      snapshots={snapshots}
      configured={{ youtube: youtubeConfigured(), spotify: spotifyConfigured(), instagram: instagramConfigured(), tiktok: tiktokConfigured() }}
      notice={{ connected: str(sp.connected), error: str(sp.error), platform: str(sp.platform), detail: str(sp.detail) }}
      today={today()}
    />
  );
}
