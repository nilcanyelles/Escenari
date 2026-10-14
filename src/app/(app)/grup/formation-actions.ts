"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireBandAccess } from "@/lib/band-access";
import type { FormationSlot } from "@/lib/types";

function revalidateFormations() {
  revalidatePath("/grup");
  revalidatePath("/concerts");
  revalidatePath("/artista");
}

export async function saveFormationAction(input: { id: string | null; bandId: string; name: string; preferred: boolean; slots: FormationSlot[] }): Promise<{ id: string }> {
  const { workspaceId } = await requireBandAccess(input.bandId, "members");
  const pool = db();
  const id = input.id || "fm" + Date.now();
  // Només una formació preferida per grup — en marcar-ne una, es desmarquen
  // les altres (no cal que el client ho gestioni).
  if (input.preferred) await pool.query("update formations set preferred=false where band_id=$1 and id<>$2", [input.bandId, id]);
  await pool.query(
    `insert into formations (id, workspace_id, band_id, name, preferred, slots)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (id) do update set name=$4, preferred=$5, slots=$6
     where formations.band_id = excluded.band_id`,
    [id, workspaceId, input.bandId, (input.name || "Formació").trim(), input.preferred, JSON.stringify(input.slots || [])]
  );
  revalidateFormations();
  return { id };
}

export async function deleteFormationAction(bandId: string, formationId: string) {
  await requireBandAccess(bandId, "members");
  await db().query("delete from formations where id=$1 and band_id=$2", [formationId, bandId]);
  revalidateFormations();
}
