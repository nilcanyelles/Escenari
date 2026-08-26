"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";

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
};

export async function saveTransactionAction(input: SaveTransactionInput): Promise<{ id: string }> {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  if (input.id) {
    await pool.query(
      `update transactions set kind=$1, category=$2, amount=$3, tdate=$4, concert_id=$5, member=$6, fund=$7, notes=$8
       where id=$9 and workspace_id=$10`,
      [input.kind, input.category, Math.round(input.amount) || 0, input.date, input.concertId, input.member || "", input.fund || "", input.notes || "", input.id, workspaceId]
    );
    revalidatePath("/estadistiques");
    return { id: input.id };
  }
  const id = "tx" + Date.now();
  await pool.query(
    `insert into transactions (id, workspace_id, kind, category, amount, tdate, concert_id, member, fund, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, workspaceId, input.kind, input.category, Math.round(input.amount) || 0, input.date, input.concertId, input.member || "", input.fund || "", input.notes || ""]
  );
  revalidatePath("/estadistiques");
  return { id };
}

export async function deleteTransactionAction(id: string) {
  const { workspaceId } = await requireManagerAction();
  await db().query("delete from transactions where id=$1 and workspace_id=$2", [id, workspaceId]);
  revalidatePath("/estadistiques");
}
