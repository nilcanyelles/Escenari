import ConcertsView from "@/components/ConcertsView";
import { getBands, getConcerts, getInvoices, getCompanyInfo } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope, scopeConcerts, scopeInvoices } from "@/lib/band-scope";

export const dynamic = "force-dynamic";

export default async function ConcertsPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts, invoices, companyInfo, selectedRaw] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getInvoices(workspaceId), getCompanyInfo(workspaceId), getSelectedBandId(),
  ]);
  const bandId = resolveBandScope(bands, selectedRaw);
  const scoped = scopeConcerts(concerts, bandId);
  return (
    <ConcertsView
      bands={bands}
      concerts={scoped}
      invoices={scopeInvoices(invoices, concerts, bandId)}
      companyInfo={companyInfo}
      today={today()}
    />
  );
}
