import ConcertsView from "@/components/ConcertsView";
import { getBands, getConcerts, getInvoices } from "@/lib/data";
import { today } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConcertsPage() {
  const [bands, concerts, invoices] = await Promise.all([getBands(), getConcerts(), getInvoices()]);
  return <ConcertsView bands={bands} concerts={concerts} invoices={invoices} today={today()} />;
}
