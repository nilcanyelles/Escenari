// Omple la taula `contacts` a partir de les dades que ja hi ha a l'app:
// músics/crew de cada grup, contactes de cada full de ruta, i clients
// facturats. Idempotent: es pot tornar a executar sense duplicar res.
import { Pool } from "@neondatabase/serverless";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (posa'l a .env.local).");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let seq = 0;
function nextId() {
  seq += 1;
  return "ct" + Date.now() + "-" + seq;
}

async function upsert(f) {
  const name = (f.name || "").trim();
  if (!name) return false;
  await pool.query(
    `insert into contacts (id, name, kinds, role, phone, email, company, cif, address, iban)
     values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10)
     on conflict (lower(name)) do update set
       kinds = (select coalesce(jsonb_agg(distinct k), '[]'::jsonb) from jsonb_array_elements_text(contacts.kinds || excluded.kinds) as k),
       role = case when contacts.role = '' then excluded.role else contacts.role end,
       phone = case when contacts.phone = '' then excluded.phone else contacts.phone end,
       email = case when contacts.email = '' then excluded.email else contacts.email end,
       company = case when contacts.company = '' then excluded.company else contacts.company end,
       cif = case when contacts.cif = '' then excluded.cif else contacts.cif end,
       address = case when contacts.address = '' then excluded.address else contacts.address end,
       iban = case when contacts.iban = '' then excluded.iban else contacts.iban end`,
    [
      nextId(), name, JSON.stringify([f.kind]), f.role || "", f.phone || "", f.email || "",
      f.company || "", f.cif || "", f.address || "", f.iban || "",
    ]
  );
  return true;
}

async function main() {
  let fromBands = 0, fromRoute = 0, fromClients = 0;

  const bands = (await pool.query("select name, members, crew from bands")).rows;
  for (const b of bands) {
    for (const p of [...(b.members || []), ...(b.crew || [])]) {
      if (await upsert({ name: p.name, kind: "grup", role: p.role, phone: p.phone, email: p.email })) fromBands++;
    }
  }

  const concerts = (await pool.query("select route_sheet from concerts where route_sheet is not null")).rows;
  for (const c of concerts) {
    for (const ct of c.route_sheet?.contacts || []) {
      if (await upsert({ name: ct.name, kind: "ruta", role: ct.role, phone: ct.phone, company: ct.company })) fromRoute++;
    }
  }

  const clientRows = (await pool.query(
    `select distinct i.client as name, cd.cif, cd.nom, cd.address
     from invoices i left join client_details cd on cd.client_name = i.client
     where coalesce(i.client, '') <> ''`
  )).rows;
  for (const c of clientRows) {
    if (await upsert({ name: c.name, kind: "empresa", company: c.nom || c.name, cif: c.cif, address: c.address })) fromClients++;
  }

  const total = (await pool.query("select count(*) from contacts")).rows[0].count;
  console.log(`Entrades processades — grups: ${fromBands}, fulls de ruta: ${fromRoute}, clients: ${fromClients}`);
  console.log(`Contactes únics a la taula: ${total}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
