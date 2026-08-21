import GrupsView from "@/components/GrupsView";
import { getBands, getConcerts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function GrupsPage() {
  const [bands, concerts] = await Promise.all([getBands(), getConcerts()]);
  const historyByBand: Record<string, number> = {};
  const concertCountByPerson: Record<string, number> = {};
  concerts.forEach((c) => {
    historyByBand[c.bandId] = (historyByBand[c.bandId] || 0) + 1;
    Object.entries(c.attendance || {}).forEach(([name, val]) => {
      if (val === "yes") concertCountByPerson[name] = (concertCountByPerson[name] || 0) + 1;
    });
  });
  return <GrupsView bands={bands} historyByBand={historyByBand} concertCountByPerson={concertCountByPerson} />;
}
