import CalendariView from "@/components/CalendariView";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull, getArtistConcertsFull, getFeedToken } from "@/lib/artist-data";
import { getSelectedBandId } from "@/lib/band-scope";
import { getAvailability } from "@/lib/subs";
import { today } from "@/lib/format";
import { normalize } from "@/lib/text";
import { memberPerms } from "@/lib/perms";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Calendari del músic: el mateix calendari que el gestor, sense facturació,
// i amb la seva disponibilitat per a suplències marcable dia a dia. Només
// pot crear esdeveniments si el gestor li ha donat el permís.
export default async function ArtistAgendaPage() {
  const profile = await requireArtist();
  const [bands, concerts, selectedRaw, feedToken, availability, links] = await Promise.all([
    getArtistBandsFull(profile.clerkUserId),
    getArtistConcertsFull(profile.clerkUserId),
    getSelectedBandId(),
    getFeedToken(profile.clerkUserId),
    getAvailability(profile.clerkUserId),
    db().query("select band_id, member_name from band_members where clerk_user_id=$1", [profile.clerkUserId]).then((r) => r.rows),
  ]);
  const bandId = bands.length === 1 ? bands[0].id : bands.some((b) => b.id === selectedRaw) ? selectedRaw : "";
  const scoped = bandId ? concerts.filter((c) => c.bandId === bandId) : concerts;

  // Permís "esdeveniments" a cada grup (pel nom amb què hi consta).
  const canCreateSomewhere = bands.some((b) => {
    if (bandId && b.id !== bandId) return false;
    const link = links.find((l) => l.band_id === b.id);
    const me = link ? (b.members || []).find((m) => normalize(m.name) === normalize(link.member_name)) : null;
    return memberPerms(me).events;
  });

  // Dies amb bolo (de qualsevol grup, on no ha dit que no hi va): surten
  // sols com a no disponibles al calendari de suplències.
  const nameByBand: Record<string, string> = {};
  links.forEach((l) => { nameByBand[l.band_id] = l.member_name; });
  const busyDays: Record<string, string> = {};
  concerts.forEach((c) => {
    if (c.status === "cancel·lat") return;
    const my = (c.attendance || {})[nameByBand[c.bandId] || profile.name];
    if (my === "no") return;
    if (!busyDays[c.date]) busyDays[c.date] = `${c.bandName} · ${c.city || c.venue || "bolo"}`;
  });

  return (
    <CalendariView
      bands={bands}
      concerts={scoped}
      selectedBandId={bandId}
      icsToken={feedToken}
      canCreate={canCreateSomewhere}
      allowBolo={false}
      detailBase="/artista/concerts"
      availability={availability}
      busyDays={busyDays}
      today={today()}
    />
  );
}
