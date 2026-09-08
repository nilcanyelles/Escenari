import type { MemberPerms, Person } from "./types";

// Permisos per membre, decidits pel gestor (o per qui tingui el permís
// "Permisos") des de la pestanya Permisos del grup o des del perfil de la
// persona. Per defecte poden crear material (cançons, riders, setlists)
// però no tocar l'equip, crear esdeveniments ni gestionar permisos.
export const DEFAULT_PERMS: MemberPerms = {
  songs: true,
  riders: true,
  setlists: true,
  members: false,
  events: false,
  removeMembers: false,
  perms: false,
  admin: false,
};

// Tot permès — el gestor del workspace, i qualsevol membre marcat "Admin".
export const ALL_PERMS: MemberPerms = {
  songs: true,
  riders: true,
  setlists: true,
  members: true,
  events: true,
  removeMembers: true,
  perms: true,
  admin: true,
};

export const PERM_LABELS: { key: keyof MemberPerms; label: string }[] = [
  { key: "songs", label: "Cançons" },
  { key: "riders", label: "Riders" },
  { key: "setlists", label: "Setlists" },
  { key: "members", label: "Afegir gent" },
  { key: "removeMembers", label: "Treure gent" },
  { key: "events", label: "Esdeveniments" },
  { key: "perms", label: "Permisos" },
  { key: "admin", label: "Admin" },
];

// "Admin" ho inclou tot: encara que la resta d'interruptors estiguin
// apagats, un admin pot fer qualsevol cosa dins el grup.
export function memberPerms(p?: Person | null): MemberPerms {
  const merged: MemberPerms = { ...DEFAULT_PERMS, ...(p?.perms || {}) };
  return merged.admin ? { ...ALL_PERMS } : merged;
}
