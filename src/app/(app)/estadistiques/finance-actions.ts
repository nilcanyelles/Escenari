"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
import { requireConcertAccess } from "@/lib/band-access";
import { uploadFileBlob } from "@/lib/blob-storage";

export type SaveTransactionInput = {
  id: string | null;
  kind: "ingres" | "despesa";
  category: string;
  amount: number;
  date: string;
  concertId: string | null;
  member: string;
  fund: string;
  notes: string;
  // Qui es fa càrrec (només despeses de concert): agencia | grup | ambdos | altre.
  paidBy?: string;
};

const PAYERS = ["agencia", "grup", "ambdos", "altre"];
function cleanPayer(v: string | undefined): string {
  return v && PAYERS.includes(v) ? v : "";
}

// Un moviment lligat a un concert (despesa d'un bolo, p. ex.) el pot tocar
// el gestor o un admin del grup d'aquell concert; un moviment general de
// l'agència (sense concert — despeses d'estructura, ingressos varis...)
// només el gestor, que és qui en té la visió de conjunt.
async function resolveTransactionWorkspace(concertId: string | null): Promise<string> {
  if (concertId) {
    const { workspaceId } = await requireConcertAccess(concertId, "admin");
    return workspaceId;
  }
  const { workspaceId } = await requireManagerAction();
  return workspaceId;
}

export async function saveTransactionAction(input: SaveTransactionInput): Promise<{ id: string }> {
  const pool = db();
  if (input.id) {
    const existing = (await pool.query("select concert_id from transactions where id=$1", [input.id])).rows[0];
    if (!existing) throw new Error("Moviment no trobat");
    const workspaceId = await resolveTransactionWorkspace(existing.concert_id);
    await pool.query(
      `update transactions set kind=$1, category=$2, amount=$3, tdate=$4, concert_id=$5, member=$6, fund=$7, notes=$8,
         paid_by = case when $11 = '' then paid_by else $11 end
       where id=$9 and workspace_id=$10`,
      [input.kind, input.category, Math.round(input.amount) || 0, input.date, input.concertId, input.member || "", input.fund || "", input.notes || "", input.id, workspaceId, cleanPayer(input.paidBy)]
    );
    revalidatePath("/estadistiques");
    revalidatePath("/concerts");
    revalidatePath("/artista");
    return { id: input.id };
  }
  const workspaceId = await resolveTransactionWorkspace(input.concertId);
  const id = "tx" + Date.now();
  await pool.query(
    `insert into transactions (id, workspace_id, kind, category, amount, tdate, concert_id, member, fund, notes, paid_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, workspaceId, input.kind, input.category, Math.round(input.amount) || 0, input.date, input.concertId, input.member || "", input.fund || "", input.notes || "", cleanPayer(input.paidBy)]
  );
  revalidatePath("/estadistiques");
  revalidatePath("/concerts");
  revalidatePath("/artista");
  return { id };
}

// Canvia qui es fa càrrec d'una despesa ja desada (fitxa del concert).
export async function setTransactionPayerAction(id: string, paidBy: string) {
  const existing = (await db().query("select concert_id from transactions where id=$1", [id])).rows[0];
  if (!existing) throw new Error("Moviment no trobat");
  const workspaceId = await resolveTransactionWorkspace(existing.concert_id);
  const v = cleanPayer(paidBy);
  if (!v) throw new Error("Valor no vàlid");
  await db().query("update transactions set paid_by=$1 where id=$2 and workspace_id=$3", [v, id, workspaceId]);
  revalidatePath("/estadistiques");
  revalidatePath("/concerts");
}

export async function deleteTransactionAction(id: string) {
  const existing = (await db().query("select concert_id from transactions where id=$1", [id])).rows[0];
  if (!existing) return;
  const workspaceId = await resolveTransactionWorkspace(existing.concert_id);
  await db().query("delete from transactions where id=$1 and workspace_id=$2", [id, workspaceId]);
  revalidatePath("/estadistiques");
}

// Rebut (foto del tiquet, PDF) adjunt a un moviment.
export async function uploadReceiptAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const transactionId = String(formData.get("transactionId") || "");
  const file = formData.get("file") as File | null;
  if (!transactionId || !file) return { ok: false, error: "Falta el fitxer" };
  const existing = (await db().query("select concert_id from transactions where id=$1", [transactionId])).rows[0];
  if (!existing) return { ok: false, error: "Moviment no trobat" };
  const { workspaceId, profile } = existing.concert_id
    ? await requireConcertAccess(existing.concert_id, "admin")
    : { workspaceId: (await requireManagerAction()).workspaceId, profile: null };
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "Màxim 15 MB" };
  const buf = Buffer.from(await file.arrayBuffer());
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  const mime = file.type || "application/octet-stream";
  const blobUrl = await uploadFileBlob("files/" + id, buf, mime);
  await db().query(
    "insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, blob_url) values ($1,$2,null,null,$3,$4,$5,null,$6,$7)",
    [id, workspaceId, file.name || "rebut", mime, file.size, profile?.name || "", blobUrl]
  );
  await db().query("update transactions set receipt_file_id=$1 where id=$2", [id, transactionId]);
  revalidatePath("/estadistiques");
  return { ok: true };
}
