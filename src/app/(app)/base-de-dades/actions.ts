"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  revalidatePath("/base-de-dades");
  revalidatePath("/concerts");
  revalidatePath("/grups");
  revalidatePath("/");
  revalidatePath("/calendari");
  revalidatePath("/facturacio");
}

export async function updateConcertFieldAction(id: string, field: "bandName" | "city" | "venue" | "amount" | "date" | "status", value: string | number) {
  const pool = db();
  const columns: Record<string, string> = { bandName: "band_name", city: "city", venue: "venue", amount: "amount", date: "date", status: "status" };
  const col = columns[field];
  if (!col) return;
  await pool.query(`update concerts set ${col} = $1 where id = $2`, [value, id]);
  revalidateAll();
}

export async function cycleConcertStatusAction(id: string) {
  const pool = db();
  const order = ["confirmat", "pendent", "cancel·lat"];
  const row = (await pool.query("select status from concerts where id=$1", [id])).rows[0];
  if (!row) return;
  const next = order[(order.indexOf(row.status) + 1) % order.length];
  await pool.query("update concerts set status=$1 where id=$2", [next, id]);
  revalidateAll();
}

export async function updateBandFieldAction(id: string, field: "name" | "rate", value: string | number) {
  const pool = db();
  const col = field === "name" ? "name" : "rate";
  await pool.query(`update bands set ${col} = $1 where id = $2`, [value, id]);
  if (field === "name") {
    await pool.query("update concerts set band_name = $1 where band_id = $2", [value, id]);
  }
  revalidateAll();
}

export async function upsertClientDetailsAction(clientName: string, field: "cif" | "nom" | "address", value: string) {
  const pool = db();
  await pool.query(
    `insert into client_details (client_name, cif, nom, address) values ($1, '', '', '')
     on conflict (client_name) do nothing`,
    [clientName]
  );
  await pool.query(`update client_details set ${field} = $1 where client_name = $2`, [value, clientName]);
  revalidateAll();
}

let resetInFlight = false;

export async function resetSampleDataAction() {
  if (resetInFlight) return;
  resetInFlight = true;
  const pool = db();
  try {
    const { APP_DATA } = await import("../../../../scripts/generate-data.mjs");
    const { CONCERTS, INVOICES } = APP_DATA as {
      BANDS: { id: string }[];
      CONCERTS: { id: string; date: string; time: string; venue: string; city: string; bandId: string; bandName: string; tags: string[]; status: string; amount: number }[];
      INVOICES: { id: string; concertId: string; client: string; bandName: string; issueDate: string; dueDate: string; amount: number; state: string }[];
    };

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from invoices");
      await client.query("delete from concerts");
      await client.query("delete from client_details");

      for (const c of CONCERTS) {
        await client.query(
          `insert into concerts (id, date, time, venue, city, band_id, band_name, tags, status, amount)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [c.id, c.date, c.time, c.venue, c.city, c.bandId, c.bandName, JSON.stringify(c.tags), c.status, c.amount]
        );
      }
      for (const i of INVOICES) {
        await client.query(
          `insert into invoices (id, concert_id, client, band_name, issue_date, due_date, amount, state)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [i.id, i.concertId, i.client, i.bandName, i.issueDate, i.dueDate, i.amount, i.state]
        );
      }

      function hashStr(str: string) {
        let h = 0;
        for (let k = 0; k < str.length; k++) h = (Math.imul(h, 31) + str.charCodeAt(k)) | 0;
        return Math.abs(h);
      }
      const CIF_LETTERS = "ABCDEFGHJNPQRSUVW";
      const LEGAL_SUFFIXES = ["S.L.", "S.A.", "S.L.U.", "S.C.P."];
      const STREET_NAMES = ["Carrer Major", "Carrer Nou", "Avinguda del Comerç", "Carrer de la Pau", "Passeig de la Rambla", "Carrer Sant Josep", "Carrer de la Indústria", "Carrer del Mar", "Avinguda de la Llibertat", "Carrer del Sol"];
      const cityByClient: Record<string, string> = {};
      CONCERTS.forEach((c) => { if (c.venue && !(c.venue in cityByClient)) cityByClient[c.venue] = c.city; });
      const clientNames = new Set<string>();
      CONCERTS.forEach((c) => { if (c.venue) clientNames.add(c.venue); });
      INVOICES.forEach((i) => { if (i.client) clientNames.add(i.client); });

      for (const name of clientNames) {
        const h = hashStr(name);
        const letter = CIF_LETTERS[h % CIF_LETTERS.length];
        const digits = String(10000000 + (h % 90000000)).slice(-8);
        const suffix = LEGAL_SUFFIXES[Math.floor(h / 7) % LEGAL_SUFFIXES.length];
        const street = STREET_NAMES[Math.floor(h / 13) % STREET_NAMES.length];
        const num = (h % 98) + 1;
        const city = cityByClient[name] || "";
        await client.query(
          "insert into client_details (client_name, cif, nom, address) values ($1,$2,$3,$4) on conflict (client_name) do nothing",
          [name, letter + digits, `${name} ${suffix}`, `${street}, ${num}${city ? ", " + city : ""}`]
        );
      }

      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  } finally {
    resetInFlight = false;
  }

  revalidateAll();
}
