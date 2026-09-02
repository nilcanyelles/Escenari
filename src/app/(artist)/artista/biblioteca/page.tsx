import SongLibraryView, { type LibraryItem } from "@/components/SongLibraryView";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull } from "@/lib/artist-data";
import { getSongs, getPersonalSongs } from "@/lib/songs";

export const dynamic = "force-dynamic";

// Biblioteca de cançons del músic: tot el repertori de tots els seus grups
// més les cançons pròpies (sense grup), amb filtres i mode escenari per
// cançó.
export default async function BibliotecaPage() {
  const profile = await requireArtist();
  const bands = await getArtistBandsFull(profile.clerkUserId);
  const [personal, ...perBand] = await Promise.all([
    getPersonalSongs(profile.clerkUserId),
    ...bands.map((b) => getSongs(b.id)),
  ]);
  const items: LibraryItem[] = [
    ...bands.flatMap((b, i) => perBand[i].map((song) => ({ song, bandId: b.id, bandName: b.name, bandColor: b.color1 || "#8b7bff", bandLogo: b.logo || "" }))),
    ...personal.map((song) => ({ song, bandId: null, bandName: "Les meves cançons", bandColor: "#8b7bff", bandLogo: "" })),
  ];
  return (
    <SongLibraryView
      items={items}
      bands={bands.map((b) => ({ id: b.id, name: b.name, color1: b.color1 || "#8b7bff", logo: b.logo || "" }))}
    />
  );
}
