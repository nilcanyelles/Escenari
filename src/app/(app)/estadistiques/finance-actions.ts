"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
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

export async function saveTransactionAction(input: SaveTransactionInput): Promise<{ id: string }> {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  if (input.id) {
    await pool.query(
      `update transactions set kind=$1, category=$2, amount=$3, tdate=$4, concert_id=$5, member=$6, fund=$7, notes=$8,
         paid_by = case when $11 = '' then paid_by else $11 end
       where id=$9 and workspace_id=$10`,
      [input.kind, input.category, Math.round(input.amount) || 0, input.date, input.concertId, input.member || "", input.fund || "", input.notes || "", input.id, workspaceId, cleanPayer(input.paidBy)]
    );
    revalidatePath("/estadistiques");
    return { id: input.id };
  }
  const id = "tx" + Date.now();
  await pool.query(
    `insert into transactions (id, workspace_id, kind, category, amount, tdate, concert_id, member, fund, notes, paid_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, workspaceId, input.kind, input.category, Math.round(input.amount) || 0, input.date, input.concertId, input.member || "", input.fund || "", input.notes || "", cleanPayer(input.paidBy)]
  );
  revalidatePath("/estadistiques");
  return { id };
}

// Canvia qui es fa càrrec d'una despesa ja desada (fitxa del concert).
export async function setTransactionPayerAction(id: string, paidBy: string) {
  const { workspaceId } = await requireManagerAction();
  const v = cleanPayer(paidBy);
  if (!v) throw new Error("Valor no vàlid");
  await db().query("update transactions set paid_by=$1 where id=$2 and workspace_id=$3", [v, id, workspaceId]);
  revalidatePath("/estadistiques");
  revalidatePath("/concerts");
}

export async function deleteTransactionAction(id: string) {
  const { workspaceId } = await requireManagerAction();
  await db().query("delete from transactions where id=$1 and workspace_id=$2", [id, workspaceId]);
  revalidatePath("/estadistiques");
}

// Rebut (foto del tiquet, PDF) adjunt a un moviment.
export async function uploadReceiptAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { workspaceId, name } = await requireManagerAction();
  const transactionId = String(formData.get("transactionId") || "");
  const file = formData.get("file") as File | null;
  if (!transactionId || !file) return { ok: false, error: "Falta el fitxer" };
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "Màxim 15 MB" };
  const owns = (await db().query("select 1 from transactions where id=$1 and workspace_id=$2", [transactionId, workspaceId])).rows[0];
  if (!owns) return { ok: false, error: "Moviment no trobat" };
  const buf = Buffer.from(await file.arrayBuffer());
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  const mime = file.type || "application/octet-stream";
  const blobUrl = await uploadFileBlob("files/" + id, buf, mime);
  await db().query(
    "insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, blob_url) values ($1,$2,null,null,$3,$4,$5,null,$6,$7)",
    [id, workspaceId, file.name || "rebut", mime, file.size, name, blobUrl]
  );
  await db().query("update transactions set receipt_file_id=$1 where id=$2", [id, transactionId]);
  revalidatePath("/estadistiques");
  return { ok: true };
}
