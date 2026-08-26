import ConcertsView from "@/components/ConcertsView";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull, getArtistConcertsFull } from "@/lib/artist-data";
import { getSelectedBandId } from "@/lib/band-scope";
import { today } from "@/lib/format";
import { normalize } from "@/lib/text";
import { memberPerms } from "@/lib/perms";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Llistat de concerts del músic: mateixa taula que el gestor, sense diners
// ni esborrat, i amb la fitxa de només lectura.
export default async function ArtistConcertsPage() {
  const profile = await requireArtist();
  const [bands, concerts, selectedRaw] = await Promise.all([
    getArtistBandsFull(profile.clerkUserId),
    getArtistConcertsFull(profile.clerkUserId),
    getSelectedBandId(),
  ]);
  const bandId = bands.length === 1 ? bands[0].id : bands.some((b) => b.id === selectedRaw) ? selectedRaw : "";
  const scoped = bandId ? concerts.filter((c) => c.bandId === bandId) : concerts;

  const links = (await db().query(
    "select band_id, member_name from band_members where clerk_user_id=$1", [profile.clerkUserId]
  )).rows;
  const canCreate = bands.some((b) => {
    if (bandId && b.id !== bandId) return false;
    const link = links.find((l) => l.band_id === b.id);
    const me = link ? (b.members || []).find((m) => normalize(m.name) === normalize(link.member_name)) : null;
    return memberPerms(me).events;
  });

  return (
    <ConcertsView
      bands={bands}
      concerts={scoped}
      invoices={[]}
      companyInfo={{ ivaRate: 21, irpfRate: 0 } as never}
      selectedBandId={bandId}
      viewer="artist"
      canCreate={canCreate}
      detailBase="/artista/concerts"
      today={today()}
    />
  );
}
