import CalendariView from "@/components/CalendariView";
import { getBands, getConcerts } from "@/lib/data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function CalendariPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts] = await Promise.all([getBands(workspaceId), getConcerts(workspaceId)]);
  return <CalendariView bands={bands} concerts={concerts} today={today()} />;
}
