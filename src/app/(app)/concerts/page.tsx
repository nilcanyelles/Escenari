import ConcertsView from "@/components/ConcertsView";
import { getBands, getConcerts, getContacts } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope, scopeConcerts } from "@/lib/band-scope";

export const dynamic = "force-dynamic";

export default async function ConcertsPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts, contacts, selectedRaw] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getContacts(workspaceId), getSelectedBandId(),
  ]);
  const bandId = resolveBandScope(bands, selectedRaw);
  const scoped = scopeConcerts(concerts, bandId);
  return (
    <ConcertsView
      bands={bands}
      concerts={scoped}
      contacts={contacts}
      selectedBandId={bandId}
      today={today()}
    />
  );
}
