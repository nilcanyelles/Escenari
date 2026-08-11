import CalendariView from "@/components/CalendariView";
import { getBands, getConcerts } from "@/lib/data";
import { today } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CalendariPage() {
  const [bands, concerts] = await Promise.all([getBands(), getConcerts()]);
  return <CalendariView bands={bands} concerts={concerts} today={today()} />;
}
