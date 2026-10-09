import SongLibraryView, { type LibraryItem, type SetlistItem } from "@/components/SongLibraryView";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull } from "@/lib/artist-data";
import { getSongs, getPersonalSongs } from "@/lib/songs";
import { getSetlists, getPersonalSetlists } from "@/lib/material-data";
import { memberPerms } from "@/lib/perms";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Biblioteca de cançons del músic: tot el repertori de tots els seus grups
// més les cançons pròpies (sense grup), amb filtres i mode escenari per
// cançó. Pot editar/eliminar una cançó de grup només si té el permís
// "songs" en aquell grup en concret (les pròpies, sempre).
export default async function BibliotecaPage() {
  const profile = await requireArtist();
  const [bands, memberships] = await Promise.all([
    getArtistBandsFull(profile.clerkUserId),
    db().query("select band_id, member_name from band_members where clerk_user_id=$1", [profile.clerkUserId]).then((r) => r.rows),
  ]);
  const nameByBand = new Map<string, string>(memberships.map((m) => [m.band_id, m.member_name]));
  const canEditByBand = new Map<string, boolean>(
    bands.map((b) => {
      const name = nameByBand.get(b.id);
      const person = [...(b.members || []), ...(b.crew || [])].find((p) => p.name === name);
      return [b.id, memberPerms(person).songs];
    })
  );
  const canEditSetlistsByBand = new Map<string, boolean>(
    bands.map((b) => {
      const name = nameByBand.get(b.id);
      const person = [...(b.members || []), ...(b.crew || [])].find((p) => p.name === name);
      return [b.id, memberPerms(person).setlists];
    })
  );

  const [personal, ...perBand] = await Promise.all([
    getPersonalSongs(profile.clerkUserId),
    ...bands.map((b) => getSongs(b.id)),
  ]);
  const items: LibraryItem[] = [
    ...bands.flatMap((b, i) => perBand[i].map((song) => ({
      song, bandId: b.id, bandName: b.name, bandColor: b.color1 || "#8b7bff", bandLogo: b.logo || "",
      canEdit: canEditByBand.get(b.id) || false,
    }))),
    ...personal.map((song) => ({ song, bandId: null, bandName: "Les meves cançons", bandColor: "#8b7bff", bandLogo: "", canEdit: true })),
  ];

  // Setlists dels mateixos grups, per al botó "Setlists" (mateixos filtres
  // de grup i cercador que les cançons), més les setlists pròpies.
  const [personalSetlists, ...setlistsPerBand] = await Promise.all([
    getPersonalSetlists(profile.clerkUserId),
    ...bands.map((b) => getSetlists(b.id)),
  ]);
  const setlistItems: SetlistItem[] = [
    ...bands.flatMap((b, i) => setlistsPerBand[i].map((setlist) => ({
      setlist, bandId: b.id, bandName: b.name, bandColor: b.color1 || "#8b7bff", bandLogo: b.logo || "",
      canEdit: canEditSetlistsByBand.get(b.id) || false,
    }))),
    ...personalSetlists.map((setlist) => ({ setlist, bandId: null, bandName: "Les meves cançons", bandColor: "#8b7bff", bandLogo: "", canEdit: true })),
  ];

  return (
    <SongLibraryView
      items={items}
      setlistItems={setlistItems}
      bands={bands.map((b) => ({
        id: b.id, name: b.name, color1: b.color1 || "#8b7bff", logo: b.logo || "",
        canEdit: canEditByBand.get(b.id) || false, canEditSetlists: canEditSetlistsByBand.get(b.id) || false,
      }))}
    />
  );
}
