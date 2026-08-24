import FacturacioView from "@/components/FacturacioView";
import { getConcerts, getInvoices, getCompanyInfo } from "@/lib/data";
import { requireManager } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function FacturacioPage() {
  const { workspaceId } = await requireManager();
  const [concerts, invoices, companyInfo] = await Promise.all([
    getConcerts(workspaceId), getInvoices(workspaceId), getCompanyInfo(workspaceId),
  ]);
  return <FacturacioView concerts={concerts} invoices={invoices} companyInfo={companyInfo} />;
}
