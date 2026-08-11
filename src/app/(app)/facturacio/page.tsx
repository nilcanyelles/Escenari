import FacturacioView from "@/components/FacturacioView";
import { getConcerts, getInvoices, getCompanyInfo } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function FacturacioPage() {
  const [concerts, invoices, companyInfo] = await Promise.all([getConcerts(), getInvoices(), getCompanyInfo()]);
  return <FacturacioView concerts={concerts} invoices={invoices} companyInfo={companyInfo} />;
}
