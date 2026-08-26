import StatsView from "@/components/StatsView";
import { getBands, getConcerts, getInvoices } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope, scopeConcerts, scopeInvoices } from "@/lib/band-scope";

export const dynamic = "force-dynamic";

export default async function EstadistiquesPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts, invoices, selectedRaw] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getInvoices(workspaceId), getSelectedBandId(),
  ]);
  const bandId = resolveBandScope(bands, selectedRaw);
  const scoped = scopeConcerts(concerts, bandId);
  return (
    <StatsView
      bands={bands}
      concerts={scoped}
      invoices={scopeInvoices(invoices, concerts, bandId)}
      today={today()}
    />
  );
}
