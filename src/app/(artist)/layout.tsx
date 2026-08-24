import AppShell from "@/components/AppShell";
import { today, formatDateFull, capitalize } from "@/lib/format";
import { ARTIST_PAGES } from "@/lib/nav";
import { requireArtist } from "@/lib/current-user";

export default async function ArtistGroupLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireArtist();
  const todayLabel = capitalize(formatDateFull(today()));
  return (
    <AppShell todayLabel={todayLabel} pages={ARTIST_PAGES} user={{ name: profile.name, roleLabel: "Artista" }}>
      {children}
    </AppShell>
  );
}
