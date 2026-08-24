import ResumView from "@/components/ResumView";
import { getBands, getConcerts, getInvoices } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function ResumPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts, invoices] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getInvoices(workspaceId),
  ]);
  return <ResumView bands={bands} concerts={concerts} invoices={invoices} today={today()} />;
}
