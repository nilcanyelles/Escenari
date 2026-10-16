import { redirect } from "next/navigation";
import { Suspense } from "react";
import GroupHomeView from "@/components/GroupHomeView";
import { getBands, getConcerts, getContacts } from "@/lib/data";
import { getContactInteractions } from "@/lib/contacts-data";
import { getLinkedMembers, getBackupRequests } from "@/lib/group-data";
import { getRiders, getSetlists, getBandEditors } from "@/lib/material-data";
import { getFormations } from "@/lib/formation-data";
import { getSongs, getBandFiles } from "@/lib/songs";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope } from "@/lib/band-scope";
import { ensureManagerCrew, getTeamPhotosAndIg, getHiddenBandsByName } from "@/lib/person-profile";
import { getSocialPrevMonth } from "@/lib/social-sync";

export const dynamic = "force-dynamic";

// Pàgina principal del grup seleccionat (membres, suplents, material, bolos).
export default async function GrupPage() {
  const profile = await requireManager();
  const { workspaceId } = profile;
  // El gestor apareix sempre com a mànager a l'equip tècnic de tots els grups.
  await ensureManagerCrew(workspaceId, { clerkUserId: profile.clerkUserId, name: profile.name, email: profile.email });
  // Els propers sempre hi entren igualment; l'historial que compten
  // "concerts en total"/fets per persona queda a l'últim any (vegeu el
  // mateix canvi a /concerts i /agencia).
  const [bands, concerts, selectedRaw] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId, { monthsBack: 12 }), getSelectedBandId(),
  ]);
  const bandId = resolveBandScope(bands, selectedRaw);

  const historyByBand: Record<string, number> = {};
  const concertCountByPerson: Record<string, number> = {};
  concerts.forEach((c) => {
    if (c.status === "cancel·lat") return;
    historyByBand[c.bandId] = (historyByBand[c.bandId] || 0) + 1;
    Object.entries(c.attendance || {}).forEach(([name, val]) => {
      if (val === "yes") concertCountByPerson[name] = (concertCountByPerson[name] || 0) + 1;
    });
  });

  // Sense grup seleccionat no hi ha pàgina de grup: l'agenda és la vista de
  // "tots els grups".
  if (!bandId) redirect("/agenda");

  const band = bands.find((b) => b.id === bandId)!;
  const [linkedMembers, backupRequests, riders, setlists, editors, songs, files, socialPrev, formations, contacts, contactInteractions] = await Promise.all([
    getLinkedMembers(bandId),
    getBackupRequests(workspaceId, { bandId }),
    getRiders(bandId),
    getSetlists(bandId),
    getBandEditors(bandId),
    getSongs(bandId),
    getBandFiles(bandId),
    // Xifres de xarxes del mes passat, per als "+123" de la targeta d'Inici.
    getSocialPrevMonth(bandId, today()),
    getFormations(bandId),
    getContacts(workspaceId),
    getContactInteractions(workspaceId),
  ]);

  // Fotos de perfil i Instagram reals (perquè les targetes de l'equip els
  // usin, mai les d'algú que només coincideix de nom en un altre grup — vegeu
  // getTeamPhotosAndIg), i els grups que cadascú ha amagat del seu perfil
  // (per filtrar-los igual a la pestanya Contactes).
  const [{ photosByName, igByName }, hiddenBandsByName] = await Promise.all([
    getTeamPhotosAndIg(workspaceId, [bandId]),
    getHiddenBandsByName(workspaceId),
  ]);

  return (
    <Suspense fallback={null}>
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
        formations={formations}
        contacts={contacts}
        contactInteractions={contactInteractions}
        hiddenBandsByName={hiddenBandsByName}
        photosByName={photosByName}
        igByName={igByName}
        socialPrev={socialPrev}
        today={today()}
        agencyOwner={profile.agencyOwner}
      />
    </Suspense>
  );
}
