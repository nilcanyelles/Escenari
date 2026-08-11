import { readdirSync, readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (posa'l a .env.local).");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = new Set(
    (await pool.query("select name from _migrations")).rows.map((r) => r.name)
  );

  const dir = new URL("../migrations/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(new URL(file, dir), "utf8");
    console.log(`Aplicant ${file}...`);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into _migrations (name) values ($1)", [file]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw new Error(`Error aplicant ${file}: ${err.message}`);
    } finally {
      client.release();
    }
    ran++;
  }

  console.log(ran ? `Fetes ${ran} migracions noves.` : "Cap migració nova per aplicar.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
