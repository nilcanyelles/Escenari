// Genera 10 grups ficticis amb 30 concerts CADASCUN (300 en total) repartits
// durant tot l'any de prova (2026), amb més densitat als mesos d'estiu
// (temporada de festes majors), i informació completa: membres amb
// instruments, crew amb funcions, i assistència. Pensat per a un workspace de
// proves — no toca les dades reals d'altres workspaces.
//
// Reutilitza els 10 grups si ja existeixen (mateix nom, mateix workspace) i
// substitueix únicament els seus concerts, perquè es pugui tornar a executar
// sense duplicar grups.
//
// Ús: node scripts/seed-fictional-test-year.mjs <workspace_id>

import { Pool } from "@neondatabase/serverless";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (posa'l a .env.local).");
  process.exit(1);
}

const WS = process.argv[2];
if (!WS) {
  console.error("Cal indicar el workspace de destí: node scripts/seed-fictional-test-year.mjs <workspace_id>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function pad2(n) { return String(n).padStart(2, "0"); }
function dateStr(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }

function parsePeople(list) {
  return list.map((s) => {
    const idx = s.indexOf(" — ");
    return idx === -1 ? { name: s, role: "" } : { name: s.slice(0, idx), role: s.slice(idx + 3) };
  });
}

const RUN_ID = Date.now();
function newBandId(i) { return `bfic${RUN_ID}${i}`; }
function concertId(i) { return `cfic${RUN_ID}${i}`; }

const RAW_BANDS = [
  {
    name: "Vents del Sud", tags: ["Rock"], city: "Sitges", rate: 2800,
    contact: "Ramon Falgueres", phone: "+34 611 220 384",
    members: ["Ramon Falgueres — veu", "Núria Aloy — guitarra elèctrica", "Ivet Solans — baix elèctric", "Bru Casanovas — bateria"],
    crew: ["Aina Roure — road mànager", "Pau Girbau — tècnic de so", "Marc Iglesias — tècnic de llums"],
  },
  {
    name: "Marea Lila", tags: ["Pop"], city: "Cornellà de Llobregat", rate: 2400,
    contact: "Judit Serracant", phone: "+34 622 774 519",
    members: ["Judit Serracant — veu", "Oriol Bassas — teclats", "Ferran Cabús — baix elèctric", "Clàudia Nogueras — bateria", "Roc Amenós — guitarra elèctrica"],
    crew: ["Meritxell Puigcerver — mànager", "Iu Farrés — tècnic de so"],
  },
  {
    name: "Sabor Antic", tags: ["Flamenc/Rumba"], city: "Santa Coloma de Gramenet", rate: 2100,
    contact: "Antonio Fajardo", phone: "+34 655 903 271",
    members: ["Antonio Fajardo — veu i cajón", "Rocío Maldonado — palmes i veu", "Curro Vela — guitarra"],
    crew: ["Encarna Reyes — mànager", "Josele Amador — tècnic de so"],
  },
  {
    name: "Estol Salvatge", tags: ["Indie"], city: "Granollers", rate: 2000,
    contact: "Berta Camprodon", phone: "+34 633 441 087",
    members: ["Berta Camprodon — veu i guitarra elèctrica", "Guim Sadurní — baix elèctric", "Nora Vendrell — bateria"],
    crew: ["Eloi Massó — tècnic de so"],
  },
  {
    name: "Rugit de Cadena", tags: ["Electrònica"], city: "Barcelona", rate: 1700,
    contact: "Toni Reverte", phone: "+34 677 328 954",
    members: ["Toni Reverte — producció i DJ", "Nadia Ferrando — visuals i sintetitzador"],
    crew: ["Kim Aubets — tècnic de so i llums"],
  },
  {
    name: "Cor de Timbal", tags: ["Folk/Tradicional"], city: "Solsona", rate: 1900,
    contact: "Elvira Portabella", phone: "+34 688 219 640",
    members: ["Elvira Portabella — tible", "Genís Padrosa — tenora", "Alba Miralpeix — flabiol i tamborí", "Jan Estarriola — fiscorn"],
    crew: ["Roser Canadell — road mànager", "Marina Puigjaner — tècnic de so"],
  },
  {
    name: "Nit d'Aram", tags: ["Jazz"], city: "Vilanova i la Geltrú", rate: 1800,
    contact: "Àlex Montardit", phone: "+34 611 570 823",
    members: ["Àlex Montardit — trompeta", "Sofia Llopart — piano", "Dídac Rovirosa — contrabaix", "Queralt Ametller — bateria"],
    crew: ["Glòria Vinyals — mànager"],
  },
  {
    name: "Barri Alt", tags: ["Hip-hop"], city: "Cornellà de Llobregat", rate: 1500,
    contact: "Yusuf Benali", phone: "+34 699 042 617",
    members: ["Yusuf Benali — MC", "Iker Salido — DJ i producció"],
    crew: ["Samir Larbi — tècnic de so"],
  },
  {
    name: "Onada Roja", tags: ["Rock"], city: "El Prat de Llobregat", rate: 2300,
    contact: "Marçal Oller", phone: "+34 622 105 748",
    members: ["Marçal Oller — veu", "Ainhoa Trias — guitarra elèctrica", "Pol Massanet — baix elèctric", "Iris Codina — bateria"],
    crew: ["Xevi Barnils — road mànager", "Laura Fontanet — tècnic de so", "Rai Solernou — backliner"],
  },
  {
    name: "Confetti Groc", tags: ["Pop"], city: "Vilassar de Mar", rate: 2200,
    contact: "Mireia Bosc", phone: "+34 644 387 021",
    members: ["Mireia Bosc — veu", "Adrià Fius — teclats", "Nil Casadellà — guitarra elèctrica", "Txell Argemí — bateria"],
    crew: ["Pere Anglada — mànager", "Sara Buch — tècnic de llums"],
  },
];

const VENUES = [
  { city: "Sitges", venue: "Passeig de la Ribera", festa: "Festa Major de Sitges" },
  { city: "Cornellà de Llobregat", venue: "Plaça de l'Església", festa: "Festes de Sant Ildefons" },
  { city: "Santa Coloma de Gramenet", venue: "Plaça de la Vila", festa: "Festa Major de Santa Coloma" },
  { city: "Granollers", venue: "Plaça de la Porxada", festa: "Festes de l'Ascensió" },
  { city: "Barcelona", venue: "Plaça del Sol", festa: "Festa Major de Gràcia" },
  { city: "Solsona", venue: "Plaça Major", festa: "Festa Major de Solsona" },
  { city: "Vilanova i la Geltrú", venue: "Rambla Principal", festa: "Festa Major de Vilanova" },
  { city: "Cornellà de Llobregat", venue: "Parc de Can Mercader", festa: "Cornellà Jove" },
  { city: "El Prat de Llobregat", venue: "Plaça de la Vila", festa: "Festa Major del Prat" },
  { city: "Vilassar de Mar", venue: "Passeig de Ribes", festa: "Festa Major de Vilassar" },
  { city: "Rubí", venue: "Plaça del Doctor Guardiet", festa: "Festes de Rubí" },
  { city: "Igualada", venue: "Rambla de Sant Isidre", festa: "Festa Major d'Igualada" },
  { city: "Vic", venue: "Plaça Major", festa: "Mercat de Música Viva" },
  { city: "Manresa", venue: "Plaça Major", festa: "Festa Major de Manresa" },
  { city: "Mataró", venue: "La Riera", festa: "Festa Major de Mataró" },
  { city: "Terrassa", venue: "Rambla d'Ègara", festa: "Festa Major de Terrassa" },
  { city: "Girona", venue: "Plaça del Vi", festa: "Festes de Sant Narcís" },
  { city: "Lleida", venue: "Plaça de Sant Joan", festa: "Aplec del Caragol" },
  { city: "Reus", venue: "Plaça del Mercadal", festa: "Festa Major de Reus" },
  { city: "Badalona", venue: "Rambla de Badalona", festa: "Festa Major de Badalona" },
  { city: "Berga", venue: "Plaça de Sant Pere", festa: "Patum de Berga" },
  { city: "Tarragona", venue: "Rambla Nova", festa: "Santa Tecla" },
  { city: "Blanes", venue: "Passeig de Mar", festa: "Festa Major de Blanes" },
  { city: "Calella", venue: "Passeig Marítim", festa: "Festa Major de Calella" },
  { city: "Manlleu", venue: "Plaça Fra Bernadí", festa: "Festa Major de Manlleu" },
  { city: "Olot", venue: "Firal", festa: "Festes del Tura" },
  { city: "Figueres", venue: "La Rambla", festa: "Festes de la Santa Creu" },
  { city: "Banyoles", venue: "Plaça dels Turers", festa: "Festa Major de Banyoles" },
  { city: "Palamós", venue: "Passeig del Mar", festa: "Festa Major de Palamós" },
  { city: "Lloret de Mar", venue: "Plaça de l'Església", festa: "Festa Major de Lloret" },
];

const TODAY = "2026-08-26";
const CONCERTS_PER_BAND = 30;

// Pes per mes: temporada alta (juny–setembre) té bastants més bolos que la
// resta de l'any, com un calendari real de festes majors.
const MONTH_WEIGHTS = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 4, 7: 6, 8: 5, 9: 3, 10: 2, 11: 1, 12: 1 };
const MONTH_POOL = [];
for (let m = 1; m <= 12; m++) for (let k = 0; k < MONTH_WEIGHTS[m]; k++) MONTH_POOL.push(m);
// MONTH_POOL.length === 30 === CONCERTS_PER_BAND

function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed || 1;
  function rand() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let venueCursor = 0;
function nextVenue() {
  const v = VENUES[venueCursor % VENUES.length];
  venueCursor++;
  return v;
}

const STATUSES_PAST = ["confirmat", "confirmat", "confirmat", "cancel·lat"];

function buildConcertsForBand(b, bi) {
  const months = seededShuffle(MONTH_POOL, bi * 97 + 13);
  const occurrenceInMonth = {};
  const out = [];
  months.forEach((month, si) => {
    occurrenceInMonth[month] = occurrenceInMonth[month] || 0;
    const day = 3 + occurrenceInMonth[month] * 5; // fins a 6 bolos/mes -> dies 3,8,13,18,23,28
    occurrenceInMonth[month]++;
    const date = dateStr(2026, month, day);
    const v = nextVenue();
    const isPast = date < TODAY;
    const status = isPast
      ? STATUSES_PAST[(bi + si) % STATUSES_PAST.length]
      : (si % 3 === 2 ? "pendent" : "confirmat");
    const amount = b.rate + (((bi + si) % 3) - 1) * 150;

    const attendance = {};
    const substitutes = {};
    const noSubstitute = {};
    if (status !== "cancel·lat" && (isPast || status === "confirmat")) {
      b.members.forEach((p, pi) => {
        const misses = isPast && pi === (bi + si) % b.members.length && (bi + si) % 4 === 0;
        attendance[p.name] = misses ? "no" : "yes";
        if (misses) {
          if ((bi + si) % 2 === 0) substitutes[p.name] = "Suplent de " + p.role;
          else noSubstitute[p.name] = true;
        }
      });
      b.crew.forEach((p) => { attendance[p.name] = "yes"; });
    } else if (!isPast && status === "confirmat") {
      b.members.forEach((p, pi) => { if (pi % 2 === 0) attendance[p.name] = "yes"; });
    }

    out.push({
      id: concertId(out.length + 1 + bi * 1000),
      date, time: "22:30",
      venue: v.venue, city: v.city, festaEntitat: v.festa,
      bandId: b.id, bandName: b.name, tags: b.tags,
      status, amount,
      attendance, substitutes, noSubstitute,
    });
  });
  return out;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const wsRow = (await client.query("select 1 from workspaces where id=$1", [WS])).rows[0];
    if (!wsRow) throw new Error(`El workspace ${WS} no existeix.`);

    const bandIds = [];
    for (const raw of RAW_BANDS) {
      const existing = (await client.query(
        "select id from bands where workspace_id=$1 and name=$2", [WS, raw.name]
      )).rows[0];
      if (existing) {
        bandIds.push(existing.id);
        console.log(`Grup ja existent, reutilitzat: ${raw.name} (${existing.id})`);
      } else {
        const id = newBandId(bandIds.length + 1);
        await client.query(
          `insert into bands (id, name, city, rate, contact, phone, tags, members, crew, workspace_id, join_code)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, upper(substr(md5(random()::text || $1), 1, 6)))`,
          [id, raw.name, raw.city, raw.rate, raw.contact, raw.phone, JSON.stringify(raw.tags),
            JSON.stringify(parsePeople(raw.members)), JSON.stringify(parsePeople(raw.crew)), WS]
        );
        bandIds.push(id);
        console.log(`Grup creat: ${raw.name} (${id})`);
      }
    }

    const del = await client.query(
      `delete from concerts where workspace_id=$1 and band_id = any($2::text[])`,
      [WS, bandIds]
    );
    console.log(`Concerts antics esborrats: ${del.rowCount}`);

    const BANDS = RAW_BANDS.map((raw, i) => ({ ...raw, id: bandIds[i], members: parsePeople(raw.members), crew: parsePeople(raw.crew) }));

    let total = 0;
    for (let bi = 0; bi < BANDS.length; bi++) {
      const concerts = buildConcertsForBand(BANDS[bi], bi);
      for (const c of concerts) {
        await client.query(
          `insert into concerts (id, date, time, venue, city, festa_entitat, band_id, band_name, tags, status, amount, attendance, substitutes, no_substitute, workspace_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [c.id, c.date, c.time, c.venue, c.city, c.festaEntitat, c.bandId, c.bandName, JSON.stringify(c.tags), c.status, c.amount,
            JSON.stringify(c.attendance), JSON.stringify(c.substitutes), JSON.stringify(c.noSubstitute), WS]
        );
        total++;
      }
      console.log(`${BANDS[bi].name}: ${concerts.length} concerts`);
    }

    await client.query("commit");
    console.log(`Fet. Grups: ${BANDS.length}, concerts: ${total}.`);
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
