import { db } from "./db";
import type { Formation } from "./types";

export async function getFormations(bandId: string): Promise<Formation[]> {
  const { rows } = await db().query(
    "select id, band_id, name, preferred, slots from formations where band_id=$1 order by preferred desc, created_at",
    [bandId]
  );
  return rows.map((r) => ({
    id: r.id,
    bandId: r.band_id,
    name: r.name,
    preferred: !!r.preferred,
    slots: r.slots || [],
  }));
}
