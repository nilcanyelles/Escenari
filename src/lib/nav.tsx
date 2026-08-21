export const USER_NAME = "Judit Marín";
export const USER_ROLE = "Gestora";
export const USER_INITIALS = "JM";

export type PageKey = "resum" | "calendari" | "concerts" | "grups" | "contactes" | "facturacio" | "basedades";

export const PAGES: { key: PageKey; href: string; label: string }[] = [
  { key: "resum", href: "/", label: "Resum" },
  { key: "calendari", href: "/calendari", label: "Calendari" },
  { key: "concerts", href: "/concerts", label: "Concerts" },
  { key: "grups", href: "/grups", label: "Grups" },
  { key: "contactes", href: "/contactes", label: "Contactes" },
  { key: "facturacio", href: "/facturacio", label: "Facturació" },
  { key: "basedades", href: "/base-de-dades", label: "Base de dades" },
];

export const NAV_ICON_PATHS: Record<PageKey, string> = {
  resum: '<line x1="4" y1="20" x2="4" y2="12"></line><line x1="12" y1="20" x2="12" y2="5"></line><line x1="20" y1="20" x2="20" y2="15"></line>',
  calendari: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
  concerts: '<path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="18" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line>',
  grups: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M15.5 3.13a4 4 0 0 1 0 7.75"></path>',
  contactes: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
  facturacio: '<circle cx="12" cy="12" r="9.5"></circle><text x="12" y="16.3" text-anchor="middle" font-size="12.5" font-weight="700" font-family="Inter,sans-serif" stroke="none" fill="currentColor">€</text>',
  basedades: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line>',
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
