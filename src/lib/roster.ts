import { normalize } from "./text";
import type { Person } from "./types";

// Gent única d'un grup (músics + crew) — algú que surt a totes dues
// llistes (p. ex. també fa de tècnic) només compta un cop, tant als
// recomptes com a les llistes d'assistència.
export function bandRoster(band: { members: Person[]; crew: Person[] }): Person[] {
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const p of [...(band.members || []), ...(band.crew || [])]) {
    const key = normalize(p.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
