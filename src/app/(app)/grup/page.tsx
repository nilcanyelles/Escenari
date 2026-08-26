import { redirect } from "next/navigation";
import GroupHomeView from "@/components/GroupHomeView";
import { getBands, getConcerts } from "@/lib/data";
import { getLinkedMembers, getBackupRequests } from "@/lib/group-data";
import { getRiders, getSetlists, getBandEditors } from "@/lib/material-data";
import { getSongs, getBandFiles } from "@/lib/songs";
import { db } from "@/lib/db";
import { normalize } from "@/lib/text";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope } from "@/lib/band-scope";

export const dynamic = "force-dynamic";

// Pàgina principal del grup seleccionat (membres, suplents, material, bolos).
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

  // Sense grup seleccionat no hi ha pàgina de grup: l'agenda és la vista de
  // "tots els grups".
  if (!bandId) redirect("/agenda");

  const band = bands.find((b) => b.id === bandId)!;
  const [linkedMembers, backupRequests, riders, setlists, editors, songs, files] = await Promise.all([
    getLinkedMembers(bandId),
    getBackupRequests(workspaceId, { bandId }),
    getRiders(bandId),
    getSetlists(bandId),
    getBandEditors(bandId),
    getSongs(bandId),
    getBandFiles(bandId),
  ]);

  // Fotos de perfil i Instagram reals (perquè les targetes de l'equip els usin).
  const profRows = (await db().query(
    "select person_name, photo_file_id, ig_handle from person_profiles where workspace_id=$1",
    [workspaceId]
  )).rows;
  const photosByName: Record<string, string> = {};
  const igByName: Record<string, string> = {};
  profRows.forEach((r) => {
    if (r.photo_file_id) photosByName[normalize(r.person_name)] = r.photo_file_id;
    if (r.ig_handle) igByName[normalize(r.person_name)] = r.ig_handle;
  });

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
      songs={songs}
      files={files}
      photosByName={photosByName}
      igByName={igByName}
      today={today()}
    />
  );
}
