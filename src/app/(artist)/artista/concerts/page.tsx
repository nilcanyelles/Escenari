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
// ni esborrat, i amb la fitxa de només lectura. Per defecte només els
// últims 12 mesos + tots els futurs (vegeu getConcerts a data.ts) —
// "?full=1" en carrega tot l'historial.
export default async function ArtistConcertsPage({ searchParams }: { searchParams: Promise<{ full?: string }> }) {
  const { full } = await searchParams;
  const profile = await requireArtist();
  const [bands, concerts, selectedRaw] = await Promise.all([
    getArtistBandsFull(profile.clerkUserId),
    getArtistConcertsFull(profile.clerkUserId, full ? undefined : { monthsBack: 12 }),
    getSelectedBandId(),
  ]);
  const bandId = bands.length === 1 ? bands[0].id : bands.some((b) => b.id === selectedRaw) ? selectedRaw : "";
  const scoped = bandId ? concerts.filter((c) => c.bandId === bandId) : concerts;

  const links = (await db().query(
    "select band_id, member_name from band_members where clerk_user_id=$1", [profile.clerkUserId]
  )).rows;
  // Músic o crew — els permisos es guarden a totes dues llistes.
  function permsFor(b: (typeof bands)[number]) {
    const link = links.find((l) => l.band_id === b.id);
    if (!link) return memberPerms(null);
    const me = (b.members || []).find((m) => normalize(m.name) === normalize(link.member_name)) ||
      (b.crew || []).find((m) => normalize(m.name) === normalize(link.member_name)) || null;
    return memberPerms(me);
  }
  const eligible = bandId ? bands.filter((b) => b.id === bandId) : bands;
  const canCreate = eligible.some((b) => permsFor(b).events);
  // "Bolo" (fitxa completa, amb caixet/factura): només a qui sigui Admin
  // d'aquell grup — la resta d'esdeveniments (assaig/reunió/altre) ja els
  // deixa crear el permís "Esdeveniments".
  const allowBolo = eligible.some((b) => permsFor(b).admin);
  // El teu nom a cada grup (per marcar la teva pròpia assistència a la
  // columna "Assistència" — només quan hi ets convocat, vegeu ConcertsView).
  const myNames: Record<string, string> = {};
  links.forEach((l) => { myNames[l.band_id] = l.member_name; });

  return (
    <ConcertsView
      bands={bands}
      concerts={scoped}
      selectedBandId={bandId}
      viewer="artist"
      canCreate={canCreate}
      allowBolo={allowBolo}
      detailBase="/artista/concerts"
      myNames={myNames}
      today={today()}
      fullHistoryLoaded={!!full}
    />
  );
}
