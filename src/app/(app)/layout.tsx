import AppShell from "@/components/AppShell";
import { today, formatDateFull, capitalize } from "@/lib/format";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const todayLabel = capitalize(formatDateFull(today()));
  return <AppShell todayLabel={todayLabel}>{children}</AppShell>;
}
