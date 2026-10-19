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

// Totes les formacions de tots els grups d'un workspace — per a llistats
// com Esdeveniments, que mostren concerts de diversos grups alhora i
// necessiten saber quina formació té assignada cadascun (vegeu el total de
// la columna Assistència).
export async function getFormationsByWorkspace(workspaceId: string): Promise<Formation[]> {
  const { rows } = await db().query(
    `select f.id, f.band_id, f.name, f.preferred, f.slots from formations f
     join bands b on b.id = f.band_id where b.workspace_id=$1`,
    [workspaceId]
  );
  return rows.map((r) => ({
    id: r.id,
    bandId: r.band_id,
    name: r.name,
    preferred: !!r.preferred,
    slots: r.slots || [],
  }));
}
