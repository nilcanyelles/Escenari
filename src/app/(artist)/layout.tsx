import AppShell from "@/components/AppShell";
import { today, formatDateFull, capitalize } from "@/lib/format";
import { ARTIST_PAGES } from "@/lib/nav";
import { requireArtist } from "@/lib/current-user";
import { getArtistBands } from "@/lib/artist-data";
import { getSelectedBandId } from "@/lib/band-scope";
import { db } from "@/lib/db";

// L'àrea del músic és un mirall de la del gestor: grups a l'esquerra (amb
// Perfil i Suplències a dalt de tot) i pestanyes Grup/Agenda/Concerts/Estadístiques.
export default async function ArtistGroupLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireArtist();
  const todayLabel = capitalize(formatDateFull(today()));
  const [bands, selectedRaw, photoRow] = await Promise.all([
    getArtistBands(profile.clerkUserId),
    getSelectedBandId(),
    db().query(
      "select photo_file_id from person_profiles where clerk_user_id=$1 and photo_file_id is not null limit 1",
      [profile.clerkUserId]
    ).then((r) => r.rows[0] || null),
  ]);
  const selectedBandId =
    bands.length === 1 ? bands[0].id : bands.some((b) => b.id === selectedRaw) ? selectedRaw : "";
  const pages = selectedBandId ? ARTIST_PAGES : ARTIST_PAGES.filter((p) => p.key !== "grup");
  return (
    <AppShell
      todayLabel={todayLabel}
      pages={pages}
      user={{
        name: profile.name,
        roleLabel: "Músic",
        photoUrl: photoRow?.photo_file_id ? `/api/file/${photoRow.photo_file_id}` : "",
      }}
      bands={bands.map((b) => ({ id: b.id, name: b.name, logo: b.logo || "", color1: b.color1 || "" }))}
      selectedBandId={selectedBandId}
      railLinks={[
        { href: "/artista/perfil", label: "El meu perfil", emoji: "👤" },
        { href: "/suplencies", label: "Suplències", emoji: "🔄" },
        { href: "/els-meus-grups", label: "Uneix-te a un grup", emoji: "➕" },
      ]}
      routeBase="/artista"
      homeHref="/artista/perfil"
    >
      {children}
    </AppShell>
  );
}
