"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { today, addDays } from "@/lib/format";
import { requireManagerAction } from "@/lib/current-user";
import { syncClientToContacts } from "@/app/(app)/contactes/actions";

// Bloqueig d'assessorament (advisory lock) perquè dues generacions simultànies
// no calculin el mateix número de factura. La sèrie és per workspace, així que
// el bloqueig també ho és (clau de dos enters: constant + hash del workspace).
const INVOICE_LOCK_KEY = 982451;

export async function generateInvoiceAction(concertId: string) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1, hashtext($2))", [INVOICE_LOCK_KEY, workspaceId]);

    const c = (await client.query("select * from concerts where id=$1 and workspace_id=$2", [concertId, workspaceId])).rows[0];
    const existing = (await client.query("select id from invoices where concert_id=$1 and workspace_id=$2", [concertId, workspaceId])).rows[0];
    if (!c || existing) {
      await client.query("rollback");
      return;
    }

    const todayStr = today();
    const year = todayStr.slice(0, 4);
    // Següent número = màxim de la sèrie de l'any + 1 (el recompte fallava amb
    // factures esborrades: repetia números).
    const maxRow = await client.query(
      "select coalesce(max(nullif(substring(id from 8), '')::int), 0) as n from invoices where id like $1 and workspace_id=$2",
      ["F-" + year + "-%", workspaceId]
    );
    const num = maxRow.rows[0].n + 1;
    const id = "F-" + year + "-" + String(num).padStart(3, "0");
    const amount = Math.round(c.amount * 1.21);

    await client.query(
      `insert into invoices (id, concert_id, client, band_name, issue_date, due_date, amount, state, workspace_id)
       values ($1,$2,$3,$4,$5,$6,$7,'pendent',$8)`,
      [id, c.id, c.venue, c.band_name, todayStr, addDays(todayStr, 30), amount, workspaceId]
    );
    await client.query("commit");
    await syncClientToContacts(workspaceId, c.venue);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/facturacio");
  revalidatePath("/concerts");
  revalidatePath("/resum");
  revalidatePath("/contactes");
}

export async function saveCompanyInfoAction(data: { nom: string; cif: string; address: string; iban: string }) {
  const { workspaceId } = await requireManagerAction();
  await db().query(
    "update company_info set nom=$1, cif=$2, address=$3, iban=$4 where workspace_id=$5",
    [data.nom, data.cif, data.address, data.iban, workspaceId]
  );
  revalidatePath("/facturacio");
}
