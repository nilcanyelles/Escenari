import type { NavApp } from "@/lib/nav-app";

// Icona (dibuixada, no la marca real) + color de cada app de navegació, per
// distingir-les d'un cop d'ull al selector del perfil.
const NAV_APP_ICON: Record<NavApp, { bg: string; icon: React.ReactNode }> = {
  google: {
    bg: "#EA4335",
    icon: (
      <path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="white" />
    ),
  },
  waze: {
    bg: "#05C8F6",
    icon: (
      <path d="M3 11.5 20 4l-7.5 17-2-6.5L3 12.5z" fill="white" stroke="white" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
    ),
  },
  apple: {
    bg: "#0A84FF",
    icon: (
      <>
        <circle cx="12" cy="12" r="6.5" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="12" cy="12" r="1.8" fill="white" />
      </>
    ),
  },
};

export default function NavAppBadge({ app, size = 18 }: { app: NavApp; size?: number }) {
  const { bg, icon } = NAV_APP_ICON[app];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size + 6, height: size + 6, borderRadius: (size + 6) / 3, background: bg, flex: "none",
    }}>
      <svg width={size} height={size} viewBox="0 0 24 24">{icon}</svg>
    </span>
  );
}
