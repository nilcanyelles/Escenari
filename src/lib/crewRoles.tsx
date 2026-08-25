// Catàleg de funcions de crew, amb una icona de línia per a cadascuna
// (mateix llenguatge visual que les icones dels instruments).

export type CrewRoleIconKey =
  | "manager" | "road" | "backliner" | "sound" | "lights" | "monitors" | "merch" | "helper";

const ICON_PATHS: Record<CrewRoleIconKey, string> = {
  manager: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="3" y1="12" x2="21" y2="12"/>',
  road: '<rect x="1" y="8" width="14" height="8" rx="1"/><path d="M15 11h4l3 3v2h-2"/><circle cx="5.5" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/>',
  backliner: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2.6-2.6z"/>',
  sound: '<line x1="6" y1="4" x2="6" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/><circle cx="6" cy="15" r="2"/><circle cx="12" cy="9" r="2"/><circle cx="18" cy="12" r="2"/>',
  lights: '<path d="M9.5 18h5"/><path d="M10 21.5h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.7.5 1.1 1.3 1.1 2.3h5.8c0-1 .4-1.8 1.1-2.3A7 7 0 0 0 12 2z"/>',
  monitors: '<rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  merch: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  helper: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a7 7 0 0 1 7-7h1"/><line x1="17" y1="8" x2="17" y2="14"/><line x1="14" y1="11" x2="20" y2="11"/>',
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
  { name: "Road mànager", icon: "road" },
  { name: "Backliner", icon: "backliner" },
  { name: "Tècnic de so", icon: "sound" },
  { name: "Tècnic de llums", icon: "lights" },
  { name: "Tècnic de monitors", icon: "monitors" },
  { name: "Merxandatge", icon: "merch" },
  { name: "Auxiliar", icon: "helper" },
];

const ICON_BY_NAME: Record<string, CrewRoleIconKey> = {};
CREW_ROLES.forEach((r) => { ICON_BY_NAME[r.name.toLowerCase()] = r.icon; });

export function crewRoleIconKey(name: string): CrewRoleIconKey {
  return ICON_BY_NAME[(name || "").trim().toLowerCase()] || "helper";
}
