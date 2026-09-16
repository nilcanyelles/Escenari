import { db } from "./db";
import type { CustomInstrument } from "./tags";

// Instruments personalitzats del compte que fa la petició (nom + icona
// d'un altre instrument), per omplir el registre en memòria de tags.ts.
// Privats: cada compte només veu els que ell mateix ha creat.
export async function getCustomInstruments(clerkUserId: string | null): Promise<CustomInstrument[]> {
  if (!clerkUserId) return [];
  try {
    const { rows } = await db().query(
      "select name, icon from custom_instruments where created_by=$1 order by lower(name)",
      [clerkUserId]
    );
    return rows.map((r) => ({ name: r.name, icon: r.icon || "" }));
  } catch {
    return [];
  }
}
