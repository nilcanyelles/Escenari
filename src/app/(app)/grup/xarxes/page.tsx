import { redirect } from "next/navigation";
import SocialsView from "@/components/SocialsView";
import { getBands } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope } from "@/lib/band-scope";
import { getSocialSnapshots } from "@/lib/social-sync";
import { getWorkspaceBilling } from "@/lib/billing";

export const dynamic = "force-dynamic";

// Xarxes socials del grup seleccionat: enllaç de cada plataforma, de
// quines es fa seguiment, xifres actuals (llegides soles de la pàgina
// pública de l'enllaç) i evolució mes a mes.
export default async function XarxesPage() {
  const profile = await requireManager();
  const [bands, selectedRaw] = await Promise.all([getBands(profile.workspaceId), getSelectedBandId()]);
  const bandId = resolveBandScope(bands, selectedRaw);
  if (!bandId) redirect("/agenda");
  const band = bands.find((b) => b.id === bandId)!;

  const [snapshots, billing] = await Promise.all([getSocialSnapshots(bandId, 13), getWorkspaceBilling(profile.workspaceId)]);

  return <SocialsView band={band} snapshots={snapshots} today={today()} billing={billing} canUpgrade={profile.agencyOwner} />;
}
