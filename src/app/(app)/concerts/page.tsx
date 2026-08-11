import ConcertsView from "@/components/ConcertsView";
import { getBands, getConcerts, getInvoices, getCompanyInfo } from "@/lib/data";
import { today } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConcertsPage() {
  const [bands, concerts, invoices, companyInfo] = await Promise.all([getBands(), getConcerts(), getInvoices(), getCompanyInfo()]);
  return <ConcertsView bands={bands} concerts={concerts} invoices={invoices} companyInfo={companyInfo} today={today()} />;
}
