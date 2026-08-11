import BaseDeDadesView from "@/components/BaseDeDadesView";
import { getBands, getConcerts, getInvoices, getClientDetails } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function BaseDeDadesPage() {
  const [bands, concerts, invoices, clientDetails] = await Promise.all([
    getBands(), getConcerts(), getInvoices(), getClientDetails(),
  ]);
  return <BaseDeDadesView bands={bands} concerts={concerts} invoices={invoices} clientDetails={clientDetails} />;
}
