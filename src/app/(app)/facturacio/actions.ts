"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { today, addDays } from "@/lib/format";
import { syncClientToContacts } from "@/app/(app)/contactes/actions";

// Bloqueig d'assessorament (advisory lock) perquè dues generacions simultànies
// no calculin el mateix número de factura.
const INVOICE_LOCK_KEY = 982451;

export async function generateInvoiceAction(concertId: string) {
  const pool = db();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [INVOICE_LOCK_KEY]);

    const c = (await client.query("select * from concerts where id=$1", [concertId])).rows[0];
    const existing = (await client.query("select id from invoices where concert_id=$1", [concertId])).rows[0];
    if (!c || existing) {
      await client.query("rollback");
      return;
    }

    const todayStr = today();
    const year = todayStr.slice(0, 4);
    // Següent número = màxim de la sèrie de l'any + 1 (el recompte fallava amb
    // factures esborrades: repetia números).
    const maxRow = await client.query(
      "select coalesce(max(nullif(substring(id from 8), '')::int), 0) as n from invoices where id like $1",
      ["F-" + year + "-%"]
    );
    const num = maxRow.rows[0].n + 1;
    const id = "F-" + year + "-" + String(num).padStart(3, "0");
    const amount = Math.round(c.amount * 1.21);

    await client.query(
      `insert into invoices (id, concert_id, client, band_name, issue_date, due_date, amount, state)
       values ($1,$2,$3,$4,$5,$6,$7,'pendent')`,
      [id, c.id, c.venue, c.band_name, todayStr, addDays(todayStr, 30), amount]
    );
    await client.query("commit");
    await syncClientToContacts(c.venue);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/facturacio");
  revalidatePath("/concerts");
  revalidatePath("/");
  revalidatePath("/contactes");
}

export async function saveCompanyInfoAction(data: { nom: string; cif: string; address: string; iban: string }) {
  const pool = db();
  await pool.query(
    "update company_info set nom=$1, cif=$2, address=$3, iban=$4 where id=1",
    [data.nom, data.cif, data.address, data.iban]
  );
  revalidatePath("/facturacio");
}
