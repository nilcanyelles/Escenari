import AppShell from "@/components/AppShell";
import { today, formatDateFull, capitalize } from "@/lib/format";
import { PAGES } from "@/lib/nav";
import { requireManager } from "@/lib/current-user";
import { getBands } from "@/lib/data";
import { getSelectedBandId, resolveBandScope } from "@/lib/band-scope";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireManager();
  const todayLabel = capitalize(formatDateFull(today()));
  const [bands, selectedRaw] = await Promise.all([getBands(profile.workspaceId), getSelectedBandId()]);
  const selectedBandId = resolveBandScope(bands, selectedRaw);
  // La pestanya "Grup" només existeix quan hi ha un grup seleccionat: amb
  // "tots els grups" no hi ha pàgina de grup.
  const pages = selectedBandId ? PAGES : PAGES.filter((p) => p.key !== "grup");
  return (
    <AppShell
      todayLabel={todayLabel}
      pages={pages}
      user={{ name: profile.name, roleLabel: "Gestió" }}
      bands={bands.map((b) => ({ id: b.id, name: b.name, logo: b.logo || "", color1: b.color1 || "", tags: b.tags }))}
      selectedBandId={selectedBandId}
    >
      {children}
    </AppShell>
  );
}
