import BaseDeDadesView from "@/components/BaseDeDadesView";
import { getBands, getConcerts, getInvoices, getClientDetails } from "@/lib/data";
import { requireManager } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function BaseDeDadesPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts, invoices, clientDetails] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getInvoices(workspaceId), getClientDetails(workspaceId),
  ]);
  return <BaseDeDadesView bands={bands} concerts={concerts} invoices={invoices} clientDetails={clientDetails} />;
}
