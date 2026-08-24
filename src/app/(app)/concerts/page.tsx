import ConcertsView from "@/components/ConcertsView";
import { getBands, getConcerts, getInvoices, getCompanyInfo } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function ConcertsPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts, invoices, companyInfo] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getInvoices(workspaceId), getCompanyInfo(workspaceId),
  ]);
  return <ConcertsView bands={bands} concerts={concerts} invoices={invoices} companyInfo={companyInfo} today={today()} />;
}
