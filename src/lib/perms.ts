import type { MemberPerms, Person } from "./types";

// Permisos per membre, decidits pel gestor des de la targeta d'equip o des
// del perfil de la persona. Per defecte poden crear material (cançons,
// riders, setlists) però no tocar l'equip ni crear esdeveniments.
export const DEFAULT_PERMS: MemberPerms = {
  songs: true,
  riders: true,
  setlists: true,
  members: false,
  events: false,
};

export const PERM_LABELS: { key: keyof MemberPerms; label: string }[] = [
  { key: "songs", label: "Cançons" },
  { key: "riders", label: "Riders" },
  { key: "setlists", label: "Setlists" },
  { key: "members", label: "Afegir gent" },
  { key: "events", label: "Esdeveniments" },
];

export function memberPerms(p?: Person | null): MemberPerms {
  return { ...DEFAULT_PERMS, ...(p?.perms || {}) };
}
