import { redirect } from "next/navigation";
import GroupHomeView from "@/components/GroupHomeView";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull, getArtistConcertsFull } from "@/lib/artist-data";
import { getLinkedMembers, getBackupRequests } from "@/lib/group-data";
import { getRiders, getSetlists, getBandEditors } from "@/lib/material-data";
import { getSongs, getBandFiles } from "@/lib/songs";
import { getSelectedBandId } from "@/lib/band-scope";
import { memberPerms } from "@/lib/perms";
import { normalize } from "@/lib/text";
import { today } from "@/lib/format";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Pàgina del grup per al músic: mateixes pestanyes que el gestor, amb els
// permisos que aquest li hagi donat (equip sense altes ni codis d'unió).
export default async function ArtistGrupPage() {
  const profile = await requireArtist();
  const [bands, concerts, selectedRaw] = await Promise.all([
    getArtistBandsFull(profile.clerkUserId),
    getArtistConcertsFull(profile.clerkUserId),
    getSelectedBandId(),
  ]);
  const bandId = bands.length === 1 ? bands[0].id : bands.some((b) => b.id === selectedRaw) ? selectedRaw : "";
  if (!bandId) redirect("/artista/agenda");

  const band = bands.find((b) => b.id === bandId)!;
  const workspaceId = (await db().query("select workspace_id from bands where id=$1", [bandId])).rows[0]?.workspace_id;

  const link = (await db().query(
    "select member_name from band_members where band_id=$1 and clerk_user_id=$2",
    [bandId, profile.clerkUserId]
  )).rows[0];
  const myName = link?.member_name || profile.name;
  const me = (band.members || []).find((m) => normalize(m.name) === normalize(myName)) || null;
  const caps = memberPerms(me);

  const concertCountByPerson: Record<string, number> = {};
  concerts.forEach((c) => {
    Object.entries(c.attendance || {}).forEach(([name, val]) => {
      if (val === "yes") concertCountByPerson[name] = (concertCountByPerson[name] || 0) + 1;
    });
  });

  const [linkedMembers, backupRequests, riders, setlists, editors, songs, files] = await Promise.all([
    getLinkedMembers(bandId),
    getBackupRequests(workspaceId, { bandId }),
    getRiders(bandId),
    getSetlists(bandId),
    getBandEditors(bandId),
    getSongs(bandId),
    getBandFiles(bandId),
  ]);

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
      viewer="artist"
      caps={caps}
      myName={myName}
      today={today()}
    />
  );
}
