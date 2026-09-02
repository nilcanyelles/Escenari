"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/current-user";
import { requireBandAccess } from "@/lib/band-access";
import { getOrCreateBandPublicToken } from "@/lib/band-public";

// Obre (creant-lo si cal) l'enllaç públic del grup: el gestor o qualsevol
// membre del grup poden compartir-lo.
export async function openBandPublicPageAction(bandId: string): Promise<{ token: string }> {
  await requireBandAccess(bandId);
  const token = await getOrCreateBandPublicToken(bandId);
  return { token };
}

// Text de presentació del grup, editable des de la mateixa pàgina pública
// (només el gestor del workspace).
export async function updateBandBioAction(token: string, bio: string) {
  const me = await getProfile();
  const row = (await db().query("select id, workspace_id from bands where public_token=$1", [token])).rows[0];
  if (!row) throw new Error("Grup no trobat");
  if (!me || me.role !== "manager" || me.workspaceId !== row.workspace_id) throw new Error("Sense permís");
  await db().query("update bands set bio=$1 where id=$2", [(bio || "").trim().slice(0, 2000), row.id]);
  revalidatePath(`/g/${token}`);
  revalidatePath("/grup");
}
