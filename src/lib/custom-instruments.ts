import { db } from "./db";
import type { CustomInstrument } from "./tags";

// Instruments personalitzats de tota l'app (nom + icona d'un altre
// instrument), per omplir el registre en memòria de tags.ts.
export async function getCustomInstruments(): Promise<CustomInstrument[]> {
  try {
    const { rows } = await db().query("select name, icon from custom_instruments order by lower(name)");
    return rows.map((r) => ({ name: r.name, icon: r.icon || "" }));
  } catch {
    return [];
  }
}
