import { Pool } from "@neondatabase/serverless";
import { loadEnvLocal } from "./load-env.mjs";
import { APP_DATA } from "./generate-data.mjs";

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (posa'l a .env.local).");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Workspace de destí: `node scripts/seed.mjs ws_XXXX` (per defecte, ws_legacy).
const WS = process.argv[2] || "ws_legacy";

// Mateixa lògica que fictitiousClientInfo() a app.js: CIF/nom/adreça fictícis
// però deterministes (mateix hash del nom del client -> mateixos valors sempre).
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const CIF_LETTERS = "ABCDEFGHJNPQRSUVW";
const LEGAL_SUFFIXES = ["S.L.", "S.A.", "S.L.U.", "S.C.P."];
const STREET_NAMES = ["Carrer Major", "Carrer Nou", "Avinguda del Comerç", "Carrer de la Pau", "Passeig de la Rambla", "Carrer Sant Josep", "Carrer de la Indústria", "Carrer del Mar", "Avinguda de la Llibertat", "Carrer del Sol"];
function fictitiousClientInfo(name, city) {
  const h = hashStr(name);
  const letter = CIF_LETTERS[h % CIF_LETTERS.length];
  const digits = String(10000000 + (h % 90000000)).slice(-8);
  const suffix = LEGAL_SUFFIXES[Math.floor(h / 7) % LEGAL_SUFFIXES.length];
  const street = STREET_NAMES[Math.floor(h / 13) % STREET_NAMES.length];
  const num = (h % 98) + 1;
  return {
    cif: letter + digits,
    nom: `${name} ${suffix}`,
    address: `${street}, ${num}${city ? ", " + city : ""}`,
  };
}

async function main() {
  const { BANDS, CONCERTS, INVOICES } = APP_DATA;
  const client = await pool.connect();
  try {
    await client.query("begin");

    console.log(`Workspace de destí: ${WS}`);
    const wsRow = (await client.query("select 1 from workspaces where id=$1", [WS])).rows[0];
    if (!wsRow) throw new Error(`El workspace ${WS} no existeix.`);

    console.log(`Bands: ${BANDS.length}`);
    for (const b of BANDS) {
      await client.query(
        `insert into bands (id, name, city, rate, contact, phone, tags, members, crew, workspace_id, join_code)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, upper(substr(md5(random()::text || $1), 1, 6)))
         on conflict (id) do update set name=$2, city=$3, rate=$4, contact=$5, phone=$6, tags=$7, members=$8, crew=$9`,
        [b.id, b.name, b.city, b.rate, b.contact, b.phone, JSON.stringify(b.tags), JSON.stringify(b.members), JSON.stringify(b.crew), WS]
      );
    }

    console.log(`Concerts: ${CONCERTS.length}`);
    for (const c of CONCERTS) {
      await client.query(
        `insert into concerts (id, date, time, venue, city, band_id, band_name, tags, status, amount, workspace_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (id) do update set date=$2, time=$3, venue=$4, city=$5, band_id=$6, band_name=$7, tags=$8, status=$9, amount=$10`,
        [c.id, c.date, c.time, c.venue, c.city, c.bandId, c.bandName, JSON.stringify(c.tags), c.status, c.amount, WS]
      );
    }

    console.log(`Invoices: ${INVOICES.length}`);
    for (const i of INVOICES) {
      await client.query(
        `insert into invoices (id, concert_id, client, band_name, issue_date, due_date, amount, state, workspace_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (workspace_id, id) do update set concert_id=$2, client=$3, band_name=$4, issue_date=$5, due_date=$6, amount=$7, state=$8`,
        [i.id, i.concertId, i.client, i.bandName, i.issueDate, i.dueDate, i.amount, i.state, WS]
      );
    }

    // Clients = venues únics dels concerts + clients únics de les factures (mateixa lògica que renderBaseDades a app.js).
    const cityByClient = {};
    CONCERTS.forEach((c) => { if (c.venue && !(c.venue in cityByClient)) cityByClient[c.venue] = c.city; });
    const clientNames = new Set();
    CONCERTS.forEach((c) => { if (c.venue) clientNames.add(c.venue); });
    INVOICES.forEach((i) => { if (i.client) clientNames.add(i.client); });

    console.log(`Clients: ${clientNames.size}`);
    for (const name of clientNames) {
      const info = fictitiousClientInfo(name, cityByClient[name] || "");
      await client.query(
        `insert into client_details (client_name, cif, nom, address, workspace_id)
         values ($1,$2,$3,$4,$5)
         on conflict (workspace_id, client_name) do nothing`,
        [name, info.cif, info.nom, info.address, WS]
      );
    }

    await client.query("commit");
    console.log("Seed completat.");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
