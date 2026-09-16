import CalendariView from "@/components/CalendariView";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull, getArtistConcertsFull, getFeedToken } from "@/lib/artist-data";
import { getSelectedBandId } from "@/lib/band-scope";
import { today } from "@/lib/format";
import { normalize } from "@/lib/text";
import { memberPerms } from "@/lib/perms";
import { db } from "@/lib/db";
import { getUnavailability } from "@/lib/unavailability";

export const dynamic = "force-dynamic";

// Calendari del músic: el mateix calendari que el gestor, sense facturació,
// més els seus propis esdeveniments de "no disponible" (vacances, etc.),
// personals i visibles en vermell. La disponibilitat per a suplències es
// marca a "Suplències", no aquí. Només pot crear esdeveniments de grup si
// el gestor li ha donat el permís.
export default async function ArtistAgendaPage() {
  const profile = await requireArtist();
  const [bands, concerts, selectedRaw, feedToken, links, unavailability] = await Promise.all([
    getArtistBandsFull(profile.clerkUserId),
    getArtistConcertsFull(profile.clerkUserId),
    getSelectedBandId(),
    getFeedToken(profile.clerkUserId),
    db().query("select band_id, member_name from band_members where clerk_user_id=$1", [profile.clerkUserId]).then((r) => r.rows),
    getUnavailability(profile.clerkUserId),
  ]);
  const bandId = bands.length === 1 ? bands[0].id : bands.some((b) => b.id === selectedRaw) ? selectedRaw : "";
  const scoped = bandId ? concerts.filter((c) => c.bandId === bandId) : concerts;

  // Permisos a cada grup (pel nom amb què hi consta) — músic o crew, els
  // permisos es guarden a totes dues llistes.
  function permsFor(b: (typeof bands)[number]) {
    const link = links.find((l) => l.band_id === b.id);
    if (!link) return memberPerms(null);
    const me = (b.members || []).find((m) => normalize(m.name) === normalize(link.member_name)) ||
      (b.crew || []).find((m) => normalize(m.name) === normalize(link.member_name)) || null;
    return memberPerms(me);
  }
  const eligible = bands.filter((b) => !bandId || b.id === bandId);
  const canCreateSomewhere = eligible.some((b) => permsFor(b).events);
  // "Bolo" (fitxa completa): només a qui sigui Admin d'algun dels grups
  // elegibles.
  const allowBoloSomewhere = eligible.some((b) => permsFor(b).admin);

  return (
    <CalendariView
      bands={bands}
      concerts={scoped}
      selectedBandId={bandId}
      icsToken={feedToken}
      canCreate={canCreateSomewhere}
      allowBolo={allowBoloSomewhere}
      detailBase="/artista/concerts"
      unavailability={unavailability}
      today={today()}
    />
  );
}
