// Esborra les dades de mostra (demo) del workspace ws_legacy: concerts,
// factures, clients, contactes i els grups de prova b1–b20. Conserva els
// perfils, els grups reals (ids llargs "b<timestamp>"), les invitacions i
// les pertinences. Un sol ús, transaccional.
import { Pool } from "@neondatabase/serverless";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (posa'l a .env.local).");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const inv = await client.query("delete from invoices where workspace_id='ws_legacy'");
    const con = await client.query("delete from concerts where workspace_id='ws_legacy'");
    const cli = await client.query("delete from client_details where workspace_id='ws_legacy'");
    const cts = await client.query("delete from contacts where workspace_id='ws_legacy'");
    const bnd = await client.query("delete from bands where workspace_id='ws_legacy' and id ~ '^b[0-9]{1,3}$'");
    await client.query("update company_info set nom='' where workspace_id='ws_legacy' and nom='La Bona Party'");
    await client.query("commit");
    console.log(
      `Esborrat -> factures: ${inv.rowCount}, concerts: ${con.rowCount}, clients: ${cli.rowCount}, contactes: ${cts.rowCount}, grups de mostra: ${bnd.rowCount}`
    );
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  const left = await pool.query("select id, name from bands");
  console.log("Grups restants:", left.rows.map((r) => `${r.name} (${r.id})`).join(", ") || "cap");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
