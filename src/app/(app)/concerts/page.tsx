import ConcertsView from "@/components/ConcertsView";
import { getBands, getConcerts } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope, scopeConcerts } from "@/lib/band-scope";

export const dynamic = "force-dynamic";

export default async function ConcertsPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts, selectedRaw] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getSelectedBandId(),
  ]);
  const bandId = resolveBandScope(bands, selectedRaw);
  const scoped = scopeConcerts(concerts, bandId);
  return (
    <ConcertsView
      bands={bands}
      concerts={scoped}
      selectedBandId={bandId}
      today={today()}
    />
  );
}
