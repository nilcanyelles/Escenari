"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
import { syncClientToContacts } from "@/app/(app)/contactes/actions";

function revalidateAll() {
  revalidatePath("/base-de-dades");
  revalidatePath("/concerts");
  revalidatePath("/grups");
  revalidatePath("/resum");
  revalidatePath("/calendari");
  revalidatePath("/facturacio");
}

export async function updateConcertFieldAction(id: string, field: "bandName" | "city" | "venue" | "amount" | "date" | "status", value: string | number) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const columns: Record<string, string> = { bandName: "band_name", city: "city", venue: "venue", amount: "amount", date: "date", status: "status" };
  const col = columns[field];
  if (!col) return;
  await pool.query(`update concerts set ${col} = $1 where id = $2 and workspace_id = $3`, [value, id, workspaceId]);
  revalidateAll();
}

export async function cycleConcertStatusAction(id: string) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const order = ["confirmat", "pendent", "cancel·lat"];
  const row = (await pool.query("select status from concerts where id=$1 and workspace_id=$2", [id, workspaceId])).rows[0];
  if (!row) return;
  const next = order[(order.indexOf(row.status) + 1) % order.length];
  await pool.query("update concerts set status=$1 where id=$2 and workspace_id=$3", [next, id, workspaceId]);
  revalidateAll();
}

export async function updateBandFieldAction(id: string, field: "name" | "rate", value: string | number) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const col = field === "name" ? "name" : "rate";
  await pool.query(`update bands set ${col} = $1 where id = $2 and workspace_id = $3`, [value, id, workspaceId]);
  if (field === "name") {
    await pool.query("update concerts set band_name = $1 where band_id = $2 and workspace_id = $3", [value, id, workspaceId]);
  }
  revalidateAll();
}

export async function upsertClientDetailsAction(clientName: string, field: "cif" | "nom" | "address", value: string) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  await pool.query(
    `insert into client_details (client_name, cif, nom, address, workspace_id) values ($1, '', '', '', $2)
     on conflict (workspace_id, client_name) do nothing`,
    [clientName, workspaceId]
  );
  await pool.query(`update client_details set ${field} = $1 where client_name = $2 and workspace_id = $3`, [value, clientName, workspaceId]);
  const cd = (await pool.query("select cif, nom, address from client_details where client_name=$1 and workspace_id=$2", [clientName, workspaceId])).rows[0];
  await syncClientToContacts(workspaceId, clientName, cd);
  revalidateAll();
  revalidatePath("/contactes");
}

