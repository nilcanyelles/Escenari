import ResumView from "@/components/ResumView";
import { getBands, getConcerts, getInvoices } from "@/lib/data";
import { today } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ResumPage() {
  const [bands, concerts, invoices] = await Promise.all([getBands(), getConcerts(), getInvoices()]);
  return <ResumView bands={bands} concerts={concerts} invoices={invoices} today={today()} />;
}
