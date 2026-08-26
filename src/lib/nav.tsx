export type PageKey = "grup" | "agenda" | "concerts" | "estadistiques" | "resum" | "calendari" | "grups" | "contactes" | "facturacio" | "basedades" | "suplencies" | "practica";

export type NavPage = { key: PageKey; href: string; label: string };

// Navegació principal de gestor: primer el grup, després l'agenda (resum +
// calendari fusionats), els concerts i les estadístiques. Facturació,
// contactes i base de dades queden fora del menú (les rutes segueixen vives).
export const PAGES: NavPage[] = [
  { key: "grup", href: "/grup", label: "Grup" },
  { key: "agenda", href: "/agenda", label: "Agenda" },
  { key: "concerts", href: "/concerts", label: "Concerts" },
  { key: "estadistiques", href: "/estadistiques", label: "Estadístiques" },
];

// Navegació de l'àrea d'artista (reutilitza les icones existents).
export const ARTIST_PAGES: NavPage[] = [
  { key: "concerts", href: "/artista", label: "Els meus bolos" },
  { key: "grups", href: "/els-meus-grups", label: "Els meus grups" },
  { key: "suplencies", href: "/suplencies", label: "Suplències" },
  { key: "practica", href: "/practica", label: "Pràctica" },
];

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
}

export const NAV_ICON_PATHS: Record<PageKey, string> = {
  grup: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M15.5 3.13a4 4 0 0 1 0 7.75"></path>',
  agenda: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><circle cx="12" cy="15.5" r="2.2" fill="currentColor" stroke="none"></circle>',
  estadistiques: '<line x1="4" y1="20" x2="4" y2="12"></line><line x1="12" y1="20" x2="12" y2="5"></line><line x1="20" y1="20" x2="20" y2="15"></line>',
  resum: '<line x1="4" y1="20" x2="4" y2="12"></line><line x1="12" y1="20" x2="12" y2="5"></line><line x1="20" y1="20" x2="20" y2="15"></line>',
  calendari: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
  concerts: '<path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="18" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line>',
  grups: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M15.5 3.13a4 4 0 0 1 0 7.75"></path>',
  contactes: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
  facturacio: '<circle cx="12" cy="12" r="9.5"></circle><text x="12" y="16.3" text-anchor="middle" font-size="12.5" font-weight="700" font-family="Inter,sans-serif" stroke="none" fill="currentColor">€</text>',
  basedades: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line>',
  suplencies: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>',
  practica: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
};

export function NavIcon({ page, color, className }: { page: PageKey; color: string; className?: string }) {
  return (
    <svg
      className={className}
      style={{ color }}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: NAV_ICON_PATHS[page] }}
    />
  );
}
