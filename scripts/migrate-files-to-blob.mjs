// Migra els fitxers ja pujats (encara guardats com a bytea a Postgres) cap
// a Vercel Blob: puja cada un, desa la seva blob_url a la fila, i buida la
// columna "data" per alliberar espai i deixar de comptar per a la
// transferència de Neon. Es pot tornar a executar sense perill: només
// toca les files que encara no tinguin blob_url.
import { Pool } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Falta BLOB_READ_WRITE_TOKEN.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function fmtSize(bytes) {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

async function main() {
  const rows = (await pool.query(
    "select id, name, mime, size from files where blob_url is null and data is not null order by size desc nulls last"
  )).rows;

  if (rows.length === 0) {
    console.log("No hi ha cap fitxer per migrar.");
    await pool.end();
    return;
  }

  const totalBytes = rows.reduce((s, r) => s + (r.size || 0), 0);
  console.log(`${rows.length} fitxers per migrar (${fmtSize(totalBytes)} en total).`);

  let done = 0;
  let failed = 0;
  for (const row of rows) {
    const idx = done + failed + 1;
    process.stdout.write(`[${idx}/${rows.length}] ${row.name} (${fmtSize(row.size || 0)})... `);
    try {
      const dataRes = await pool.query("select data from files where id=$1", [row.id]);
      const data = dataRes.rows[0].data;
      const blob = await put("files/" + row.id, data, {
        access: "private",
        contentType: row.mime || "application/octet-stream",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      await pool.query("update files set blob_url=$1, data=null where id=$2", [blob.url, row.id]);
      console.log("fet.");
      done++;
    } catch (err) {
      console.log("ERROR: " + err.message);
      failed++;
    }
  }

  console.log(`\nMigrats: ${done}. Errors: ${failed}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
