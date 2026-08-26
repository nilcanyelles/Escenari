import CalendariView from "@/components/CalendariView";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull, getArtistConcertsFull, getFeedToken } from "@/lib/artist-data";
import { getSelectedBandId } from "@/lib/band-scope";
import { today } from "@/lib/format";
import { normalize } from "@/lib/text";
import { memberPerms } from "@/lib/perms";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Agenda del músic: el mateix calendari que el gestor, sense facturació.
// Només pot crear esdeveniments si el gestor li ha donat el permís.
export default async function ArtistAgendaPage() {
  const profile = await requireArtist();
  const [bands, concerts, selectedRaw, feedToken] = await Promise.all([
    getArtistBandsFull(profile.clerkUserId),
    getArtistConcertsFull(profile.clerkUserId),
    getSelectedBandId(),
    getFeedToken(profile.clerkUserId),
  ]);
  const bandId = bands.length === 1 ? bands[0].id : bands.some((b) => b.id === selectedRaw) ? selectedRaw : "";
  const scoped = bandId ? concerts.filter((c) => c.bandId === bandId) : concerts;

  // Permís "esdeveniments" a cada grup (pel nom amb què hi consta).
  const links = (await db().query(
    "select band_id, member_name from band_members where clerk_user_id=$1", [profile.clerkUserId]
  )).rows;
  const canCreateSomewhere = bands.some((b) => {
    if (bandId && b.id !== bandId) return false;
    const link = links.find((l) => l.band_id === b.id);
    const me = link ? (b.members || []).find((m) => normalize(m.name) === normalize(link.member_name)) : null;
    return memberPerms(me).events;
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
      today={today()}
    />
  );
}
