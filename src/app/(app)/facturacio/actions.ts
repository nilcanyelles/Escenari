"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { today, addDays } from "@/lib/format";

export async function generateInvoiceAction(concertId: string) {
  const pool = db();
  const c = (await pool.query("select * from concerts where id=$1", [concertId])).rows[0];
  if (!c) return;

  const todayStr = today();
  const year = todayStr.slice(0, 4);
  const countRow = await pool.query(
    "select count(*)::int as n from invoices where issue_date::text like $1",
    [year + "-%"]
  );
  const num = countRow.rows[0].n + 1;
  const id = "F-" + year + "-" + String(num).padStart(3, "0");
  const amount = Math.round(c.amount * 1.21);

  await pool.query(
    `insert into invoices (id, concert_id, client, band_name, issue_date, due_date, amount, state)
     values ($1,$2,$3,$4,$5,$6,$7,'pendent')`,
    [id, c.id, c.venue, c.band_name, todayStr, addDays(todayStr, 30), amount]
  );

  revalidatePath("/facturacio");
  revalidatePath("/concerts");
  revalidatePath("/");
}

export async function saveCompanyInfoAction(data: { nom: string; cif: string; address: string; iban: string }) {
  const pool = db();
  await pool.query(
    "update company_info set nom=$1, cif=$2, address=$3, iban=$4 where id=1",
    [data.nom, data.cif, data.address, data.iban]
  );
  revalidatePath("/facturacio");
}
