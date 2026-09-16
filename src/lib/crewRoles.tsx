// Catàleg de funcions de crew, amb una icona de línia per a cadascuna
// (mateix llenguatge visual que les icones dels instruments).

export type CrewRoleIconKey =
  | "manager" | "road" | "backliner" | "sound" | "lights" | "monitors" | "merch" | "helper"
  | "booker" | "artdir" | "stylist" | "press" | "vj" | "label" | "route" | "camera" | "video" | "community" | "edit";

const ICON_PATHS: Record<CrewRoleIconKey, string> = {
  manager: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="3" y1="12" x2="21" y2="12"/>',
  road: '<rect x="1" y="8" width="14" height="8" rx="1"/><path d="M15 11h4l3 3v2h-2"/><circle cx="5.5" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/>',
  backliner: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2.6-2.6z"/>',
  sound: '<line x1="6" y1="4" x2="6" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/><circle cx="6" cy="15" r="2"/><circle cx="12" cy="9" r="2"/><circle cx="18" cy="12" r="2"/>',
  lights: '<path d="M9.5 18h5"/><path d="M10 21.5h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.7.5 1.1 1.3 1.1 2.3h5.8c0-1 .4-1.8 1.1-2.3A7 7 0 0 0 12 2z"/>',
  monitors: '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="14" r="4"/><circle cx="12" cy="14" r="1.3"/><circle cx="12" cy="6" r="1.3"/>',
  merch: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  helper: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a7 7 0 0 1 7-7h1"/><line x1="17" y1="8" x2="17" y2="14"/><line x1="14" y1="11" x2="20" y2="11"/>',
  booker: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  artdir: '<polygon points="12 2 15.09 8.63 22 9.24 16.5 13.97 18.18 21 12 17.27 5.82 21 7.5 13.97 2 9.24 8.91 8.63 12 2"/>',
  stylist: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  press: '<path d="M3 11l18-6v14l-18-6v-2z"/><path d="M11.6 16.8a3 3 0 0 1-5.8-1.6"/>',
  vj: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><polygon points="10 7.5 16 10 10 12.5 10 7.5"/>',
  label: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>',
  route: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  community: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  edit: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
};

export function CrewRoleSvg({ icon, size = 15, className }: { icon: CrewRoleIconKey; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[icon] || ICON_PATHS.helper }}
    />
  );
}

export const CREW_ROLES: { name: string; icon: CrewRoleIconKey }[] = [
  { name: "Mànager", icon: "manager" },
  { name: "Booker", icon: "booker" },
  { name: "Director artístic", icon: "artdir" },
  { name: "Estilista", icon: "stylist" },
  { name: "Premsa", icon: "press" },
  { name: "Community manager", icon: "community" },
  { name: "Fotògraf", icon: "camera" },
  { name: "Videògraf", icon: "video" },
  { name: "Editorial", icon: "edit" },
  { name: "Tècnic de FOH", icon: "sound" },
  { name: "Tècnic de llums", icon: "lights" },
  { name: "Tècnic de monitors", icon: "monitors" },
  { name: "Backliner", icon: "backliner" },
  { name: "Videojòquei", icon: "vj" },
  { name: "Road mànager", icon: "road" },
  { name: "Tour mànager", icon: "route" },
  { name: "Segell", icon: "label" },
  { name: "Merxandatge", icon: "merch" },
  { name: "Auxiliar", icon: "helper" },
];

const ICON_BY_NAME: Record<string, CrewRoleIconKey> = {};
CREW_ROLES.forEach((r) => { ICON_BY_NAME[r.name.toLowerCase()] = r.icon; });

export function crewRoleIconKey(name: string): CrewRoleIconKey {
  return ICON_BY_NAME[(name || "").trim().toLowerCase()] || "helper";
}
