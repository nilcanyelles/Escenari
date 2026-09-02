import FacturacioView from "@/components/FacturacioView";
import { getConcerts, getInvoices, getCompanyInfo } from "@/lib/data";
import { requireManager } from "@/lib/current-user";
import { getWorkspaceBilling } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function FacturacioPage() {
  const { workspaceId, agencyOwner } = await requireManager();
  const [concerts, invoices, companyInfo, billing] = await Promise.all([
    getConcerts(workspaceId), getInvoices(workspaceId), getCompanyInfo(workspaceId), getWorkspaceBilling(workspaceId),
  ]);
  return <FacturacioView concerts={concerts} invoices={invoices} companyInfo={companyInfo} billing={billing} canUpgrade={agencyOwner} />;
}
