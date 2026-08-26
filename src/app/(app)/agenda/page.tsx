import AgendaView from "@/components/AgendaView";
import { getBands, getConcerts, getInvoices } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope, scopeConcerts, scopeInvoices } from "@/lib/band-scope";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts, invoices, selectedRaw] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getInvoices(workspaceId), getSelectedBandId(),
  ]);
  const bandId = resolveBandScope(bands, selectedRaw);
  const scoped = scopeConcerts(concerts, bandId);
  return (
    <AgendaView
      bands={bandId ? bands.filter((b) => b.id === bandId) : bands}
      concerts={scoped}
      invoices={scopeInvoices(invoices, concerts, bandId)}
      today={today()}
    />
  );
}
