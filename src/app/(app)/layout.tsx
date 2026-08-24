import AppShell from "@/components/AppShell";
import { today, formatDateFull, capitalize } from "@/lib/format";
import { PAGES } from "@/lib/nav";
import { requireManager } from "@/lib/current-user";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireManager();
  const todayLabel = capitalize(formatDateFull(today()));
  return (
    <AppShell todayLabel={todayLabel} pages={PAGES} user={{ name: profile.name, roleLabel: "Gestió" }}>
      {children}
    </AppShell>
  );
}
