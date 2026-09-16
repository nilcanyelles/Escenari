// App de navegació preferida per obrir les ubicacions del full de ruta.
// Es guarda al perfil (profiles.nav_app) i, perquè els components client
// que en depenen (RouteSheetPreviewDoc, que es fa servir des de molts
// llocs de l'app) no hagin d'anar-la a buscar amb una consulta pròpia,
// també en una cookie llegible pel navegador — es posa a l'instant de
// desar-la des de /artista/perfil (vegeu standalone-actions.ts).
export type NavApp = "google" | "waze" | "apple";
export const NAV_APP_COOKIE = "escenari_nav_app";
export const NAV_APP_OPTIONS: { value: NavApp; label: string }[] = [
  { value: "google", label: "Google Maps" },
  { value: "waze", label: "Waze" },
  { value: "apple", label: "Apple Maps" },
];

export function isNavApp(v: string | undefined | null): v is NavApp {
  return v === "google" || v === "waze" || v === "apple";
}

// Enllaç per obrir una ubicació (adreça o "lat,lng") amb l'app triada.
export function mapsHrefFor(navApp: string | undefined, query: string): string {
  const q = encodeURIComponent(query);
  if (navApp === "waze") return `https://waze.com/ul?q=${q}&navigate=yes`;
  if (navApp === "apple") return `https://maps.apple.com/?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

// Només des del client (document.cookie no existeix al servidor).
export function readNavAppCookie(): NavApp {
  if (typeof document === "undefined") return "google";
  const m = document.cookie.match(/(?:^|;\s*)escenari_nav_app=([^;]+)/);
  const v = m ? decodeURIComponent(m[1]) : "";
  return isNavApp(v) ? v : "google";
}
