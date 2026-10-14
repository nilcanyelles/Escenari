import ContactesView from "@/components/ContactesView";
import { getContacts, getBands, getConcerts } from "@/lib/data";
import { getContactInteractions } from "@/lib/contacts-data";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull } from "@/lib/artist-data";
import { memberPerms } from "@/lib/perms";
import { normalize } from "@/lib/text";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Contactes de l'agència per a músics amb el permís "Contactes" — mateixa
// vista que /contactes (gestor), incrustada. Els contactes no són per grup
// (són de tot el workspace), així que n'hi ha prou que el permís estigui
// donat en algun dels grups del músic dins d'aquest workspace.
export default async function ArtistContactesPage() {
  const profile = await requireArtist();
  const bands = await getArtistBandsFull(profile.clerkUserId);
  if (bands.length === 0) {
    return <div className="panel t-dim" style={{ fontSize: 13 }}>Encara no formes part de cap grup.</div>;
  }
  const links = (await db().query(
    "select band_id, member_name from band_members where clerk_user_id=$1",
    [profile.clerkUserId]
  )).rows;
  function permsFor(b: (typeof bands)[number]) {
    const link = links.find((l) => l.band_id === b.id);
    if (!link) return memberPerms(null);
    const me = (b.members || []).find((m) => normalize(m.name) === normalize(link.member_name)) ||
      (b.crew || []).find((m) => normalize(m.name) === normalize(link.member_name)) || null;
    return memberPerms(me);
  }
  const allowed = profile.role === "manager" || bands.some((b) => permsFor(b).contacts);
  if (!allowed) {
    return <div className="panel t-dim" style={{ fontSize: 13 }}>No tens el permís &quot;Contactes&quot; a cap dels teus grups — demana-ho al gestor.</div>;
  }

  const workspaceId = (await db().query("select workspace_id from bands where id=$1", [bands[0].id])).rows[0]?.workspace_id;
  if (!workspaceId) return null;
  const [contacts, allBands, concerts, interactions] = await Promise.all([
    getContacts(workspaceId),
    getBands(workspaceId),
    getConcerts(workspaceId),
    getContactInteractions(workspaceId),
  ]);
  const concertCountByPerson: Record<string, number> = {};
  concerts.forEach((c) => {
    if (c.status === "cancel·lat") return;
    Object.entries(c.attendance || {}).forEach(([name, val]) => {
      if (val === "yes") concertCountByPerson[name] = (concertCountByPerson[name] || 0) + 1;
    });
  });

  return <ContactesView contacts={contacts} allBands={allBands} concertCountByPerson={concertCountByPerson} interactions={interactions} embedded />;
}
