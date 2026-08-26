import GrupsView from "@/components/GrupsView";
import GroupHomeView from "@/components/GroupHomeView";
import { getBands, getConcerts } from "@/lib/data";
import { getLinkedMembers, getBackupRequests } from "@/lib/group-data";
import { getRiders, getSetlists, getBandEditors } from "@/lib/material-data";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope } from "@/lib/band-scope";

export const dynamic = "force-dynamic";

// Pàgina principal del grup: si hi ha un grup seleccionat a la barra lateral,
// mostra la seva fitxa (membres, suplents, bolos); si no, la graella de grups.
export default async function GrupPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts, selectedRaw] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getSelectedBandId(),
  ]);
  const bandId = resolveBandScope(bands, selectedRaw);

  const historyByBand: Record<string, number> = {};
  const concertCountByPerson: Record<string, number> = {};
  concerts.forEach((c) => {
    historyByBand[c.bandId] = (historyByBand[c.bandId] || 0) + 1;
    Object.entries(c.attendance || {}).forEach(([name, val]) => {
      if (val === "yes") concertCountByPerson[name] = (concertCountByPerson[name] || 0) + 1;
    });
  });

  if (!bandId) {
    return <GrupsView bands={bands} historyByBand={historyByBand} concertCountByPerson={concertCountByPerson} />;
  }

  const band = bands.find((b) => b.id === bandId)!;
  const [linkedMembers, backupRequests, riders, setlists, editors] = await Promise.all([
    getLinkedMembers(bandId),
    getBackupRequests(workspaceId, { bandId }),
    getRiders(bandId),
    getSetlists(bandId),
    getBandEditors(bandId),
  ]);

  return (
    <GroupHomeView
      band={band}
      allBands={bands}
      concerts={concerts.filter((c) => c.bandId === bandId)}
      linkedMembers={linkedMembers}
      backupRequests={backupRequests}
      concertCountByPerson={concertCountByPerson}
      riders={riders}
      setlists={setlists}
      editors={editors}
      today={today()}
    />
  );
}
