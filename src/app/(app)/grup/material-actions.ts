"use server";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/current-user";
import { requireBandAccess as requireBandPerm } from "@/lib/band-access";
import type { RiderContent, Song } from "@/lib/material-types";

// Autorització dual: el gestor del workspace del grup, o un artista del grup
// amb permís d'edició (band_editors) per a aquest tipus de material.
async function requireMaterialAccess(bandId: string, kind: "riders" | "setlists"): Promise<{ workspaceId: string }> {
  const profile = await getProfile();
  if (!profile) throw new Error("Sessió no vàlida");
  const band = (await db().query("select workspace_id from bands where id=$1", [bandId])).rows[0];
  if (!band) throw new Error("Grup no trobat");
  if (profile.role === "manager" && profile.workspaceId === band.workspace_id) {
    return { workspaceId: band.workspace_id };
  }
  const col = kind === "riders" ? "can_riders" : "can_setlists";
  const editor = (await db().query(
    `select 1 from band_editors where band_id=$1 and clerk_user_id=$2 and ${col}`,
    [bandId, profile.clerkUserId]
  )).rows[0];
  if (editor) return { workspaceId: band.workspace_id };
  // O bé el permís per membre que el gestor posa a la targeta d'equip.
  try {
    await requireBandPerm(bandId, kind === "riders" ? "riders" : "setlists");
    return { workspaceId: band.workspace_id };
  } catch {
    throw new Error("Sense permís d'edició");
  }
}

function revalidateMaterial(bandId: string) {
  revalidatePath("/grup");
  revalidatePath("/material/" + bandId);
  revalidatePath("/concerts");
}

function newToken(prefix: string): string {
  return prefix + randomBytes(12).toString("base64url");
}

// ---------- Riders ----------

export async function saveRiderAction(input: { id: string | null; bandId: string; name: string; content: RiderContent }): Promise<{ id: string }> {
  const { workspaceId } = await requireMaterialAccess(input.bandId, "riders");
  const pool = db();
  if (input.id) {
    await pool.query(
      "update riders set name=$1, content=$2 where id=$3 and band_id=$4",
      [(input.name || "Rider").trim(), JSON.stringify(input.content), input.id, input.bandId]
    );
    revalidateMaterial(input.bandId);
    return { id: input.id };
  }
  const id = "rd" + Date.now();
  await pool.query(
    "insert into riders (id, workspace_id, band_id, name, content, public_token) values ($1,$2,$3,$4,$5,$6)",
    [id, workspaceId, input.bandId, (input.name || "Rider").trim(), JSON.stringify(input.content), newToken("r")]
  );
  revalidateMaterial(input.bandId);
  return { id };
}

export async function deleteRiderAction(bandId: string, riderId: string) {
  await requireMaterialAccess(bandId, "riders");
  await db().query("delete from riders where id=$1 and band_id=$2", [riderId, bandId]);
  revalidateMaterial(bandId);
}

// ---------- Setlists ----------

export async function saveSetlistAction(input: { id: string | null; bandId: string; name: string; songs: Song[] }): Promise<{ id: string }> {
  const { workspaceId } = await requireMaterialAccess(input.bandId, "setlists");
  const pool = db();
  if (input.id) {
    await pool.query(
      "update setlists set name=$1, songs=$2 where id=$3 and band_id=$4",
      [(input.name || "Setlist").trim(), JSON.stringify(input.songs || []), input.id, input.bandId]
    );
    revalidateMaterial(input.bandId);
    return { id: input.id };
  }
  const id = "sl" + Date.now();
  await pool.query(
    "insert into setlists (id, workspace_id, band_id, name, songs, public_token) values ($1,$2,$3,$4,$5,$6)",
    [id, workspaceId, input.bandId, (input.name || "Setlist").trim(), JSON.stringify(input.songs || []), newToken("s")]
  );
  revalidateMaterial(input.bandId);
  return { id };
}

export async function deleteSetlistAction(bandId: string, setlistId: string) {
  await requireMaterialAccess(bandId, "setlists");
  await db().query("delete from setlists where id=$1 and band_id=$2", [setlistId, bandId]);
  revalidateMaterial(bandId);
}

// ---------- Assignació a concerts (només gestor) ----------

export async function setConcertMaterialAction(concertId: string, field: "rider" | "setlist", materialId: string | null) {
  const profile = await getProfile();
  if (!profile || profile.role !== "manager" || !profile.workspaceId) throw new Error("Sessió de gestor no vàlida");
  const col = field === "rider" ? "rider_id" : "setlist_id";
  await db().query(
    `update concerts set ${col}=$1 where id=$2 and workspace_id=$3`,
    [materialId || null, concertId, profile.workspaceId]
  );
  revalidatePath(`/concerts/${concertId}`);
}

// ---------- Aprovació de riders per concert (només gestor) ----------

export async function sendRiderApprovalAction(input: { concertId: string; riderId: string; recipientName: string; recipientEmail: string }): Promise<{ id: string }> {
  const profile = await getProfile();
  if (!profile || profile.role !== "manager" || !profile.workspaceId) throw new Error("Sessió de gestor no vàlida");
  const owns = (await db().query(
    "select 1 from concerts where id=$1 and workspace_id=$2", [input.concertId, profile.workspaceId]
  )).rows[0];
  if (!owns) throw new Error("Concert no trobat");
  const id = newToken("ap");
  await db().query(
    `insert into rider_approvals (id, workspace_id, concert_id, rider_id, recipient_name, recipient_email)
     values ($1,$2,$3,$4,$5,$6)`,
    [id, profile.workspaceId, input.concertId, input.riderId, (input.recipientName || "").trim(), (input.recipientEmail || "").trim()]
  );
  revalidatePath(`/concerts/${input.concertId}`);
  return { id };
}

// El gestor accepta la contraproposta: el contingut del contrarider passa a
// ser el contingut del rider i l'aprovació queda tancada com a aprovada.
export async function acceptCounterRiderAction(approvalId: string) {
  const profile = await getProfile();
  if (!profile || profile.role !== "manager" || !profile.workspaceId) throw new Error("Sessió de gestor no vàlida");
  const ap = (await db().query(
    "select * from rider_approvals where id=$1 and workspace_id=$2", [approvalId, profile.workspaceId]
  )).rows[0];
  if (!ap || !ap.counter_content) throw new Error("Contraproposta no trobada");
  await db().query("update riders set content=$1 where id=$2", [JSON.stringify(ap.counter_content), ap.rider_id]);
  await db().query("update rider_approvals set status='aprovat', approved_at=now() where id=$1", [approvalId]);
  revalidatePath(`/concerts/${ap.concert_id}`);
  revalidatePath("/grup");
}

export async function deleteRiderApprovalAction(approvalId: string) {
  const profile = await getProfile();
  if (!profile || profile.role !== "manager" || !profile.workspaceId) throw new Error("Sessió de gestor no vàlida");
  const ap = (await db().query("select concert_id from rider_approvals where id=$1 and workspace_id=$2", [approvalId, profile.workspaceId])).rows[0];
  await db().query("delete from rider_approvals where id=$1 and workspace_id=$2", [approvalId, profile.workspaceId]);
  if (ap) revalidatePath(`/concerts/${ap.concert_id}`);
}

// ---------- Permisos d'edició (només gestor) ----------

export async function setBandEditorAction(bandId: string, clerkUserId: string, flags: { canRiders: boolean; canSetlists: boolean }) {
  const profile = await getProfile();
  if (!profile || profile.role !== "manager" || !profile.workspaceId) throw new Error("Sessió de gestor no vàlida");
  const band = (await db().query("select workspace_id from bands where id=$1", [bandId])).rows[0];
  if (!band || band.workspace_id !== profile.workspaceId) throw new Error("Grup no trobat");
  if (!flags.canRiders && !flags.canSetlists) {
    await db().query("delete from band_editors where band_id=$1 and clerk_user_id=$2", [bandId, clerkUserId]);
  } else {
    await db().query(
      `insert into band_editors (band_id, clerk_user_id, can_riders, can_setlists) values ($1,$2,$3,$4)
       on conflict (band_id, clerk_user_id) do update set can_riders=$3, can_setlists=$4`,
      [bandId, clerkUserId, flags.canRiders, flags.canSetlists]
    );
  }
  revalidateMaterial(bandId);
}
