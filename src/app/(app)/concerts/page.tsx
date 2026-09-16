import ConcertsView from "@/components/ConcertsView";
import { getBands, getConcerts, getContacts } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope, scopeConcerts } from "@/lib/band-scope";

export const dynamic = "force-dynamic";

// Per defecte només es carreguen els concerts dels últims 12 mesos (més
// tots els futurs, siguin quan siguin) — evita transmetre anys d'historial
// cada cop que s'obre la pestanya. "?full=1" (botó "Carrega tot
// l'historial" a ConcertsView) en demana la llista sencera.
export default async function ConcertsPage({ searchParams }: { searchParams: Promise<{ full?: string }> }) {
  const { full } = await searchParams;
  const { workspaceId } = await requireManager();
  const [bands, concerts, contacts, selectedRaw] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId, full ? undefined : { monthsBack: 12 }), getContacts(workspaceId), getSelectedBandId(),
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
      fullHistoryLoaded={!!full}
    />
  );
}
