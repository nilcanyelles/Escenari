import ContactesView from "@/components/ContactesView";
import { getContacts, getBands, getConcerts } from "@/lib/data";
import { getContactInteractions } from "@/lib/contacts-data";
import { requireManager } from "@/lib/current-user";
import { syncAllBandPeopleToContacts } from "@/app/(app)/contactes/actions";

export const dynamic = "force-dynamic";

export default async function ContactesPage() {
  const { workspaceId } = await requireManager();
  await syncAllBandPeopleToContacts(workspaceId);
  const [contacts, bands, concerts, interactions] = await Promise.all([
    getContacts(workspaceId),
    getBands(workspaceId),
    getConcerts(workspaceId),
    getContactInteractions(workspaceId),
  ]);
  const concertCountByPerson: Record<string, number> = {};
  concerts.forEach((c) => {
    Object.entries(c.attendance || {}).forEach(([name, val]) => {
      if (val === "yes") concertCountByPerson[name] = (concertCountByPerson[name] || 0) + 1;
    });
  });
  return <ContactesView contacts={contacts} allBands={bands} concertCountByPerson={concertCountByPerson} interactions={interactions} />;
}
