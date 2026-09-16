// Reset i regenera la base de dades de proves (workspace ws1787602904596,
// nilcanyelles@gmail.com) amb 20 grups fictícis, ~1 any de concerts passats
// i ~4 mesos de propers, riders/setlists, factures i perfils d'agència.
// NOMÉS toca aquesta workspace — mai "ws_legacy" ni cap altra.
import { randomBytes } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();
if (!process.env.DATABASE_URL) { console.error("Falta DATABASE_URL"); process.exit(1); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const WS = "ws1787602904596";
const OWNER_CLERK_ID = "user_3INQzRnriFSlQRSF1agu82QYFmc";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
function toDateStr(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
let seedCounter = 0;
function rnd() { // deterministic-ish PRNG (mulberry32) seeded from a counter, good enough for variety
  seedCounter += 1;
  let t = (seedCounter * 2654435761 + Date.now() % 1000) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function pickN(arr, n) { const a = [...arr]; const out = []; while (out.length < n && a.length) { out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); } return out; }
function randInt(min, max) { return Math.floor(rnd() * (max - min + 1)) + min; }
function id(prefix) { return prefix + Date.now().toString(36) + randomBytes(4).toString("hex"); }

// ---------------------------------------------------------------- Dades base
const FIRST_NAMES_M = ["Marc", "Jordi", "Pau", "Oriol", "Pol", "Biel", "Arnau", "Roger", "Eloi", "Gerard", "Adrià", "Bernat", "Ferran", "Guillem", "Ivan", "Jan", "Lluc", "Martí", "Nil", "Quim", "Sergi", "Toni", "Víctor", "Xavi"];
const FIRST_NAMES_F = ["Laia", "Anna", "Marta", "Judit", "Clara", "Berta", "Emma", "Gemma", "Irene", "Júlia", "Maria", "Meritxell", "Nuri", "Paula", "Queralt", "Roser", "Sara", "Tània", "Vera", "Aina", "Carla", "Elna", "Filipa", "Gal·la"];
const LAST_NAMES = ["Puig", "Vidal", "Ferrer", "Roca", "Soler", "Bosch", "Serra", "Camps", "Font", "Vila", "Costa", "Pons", "Riera", "Vives", "Prats", "Vall", "Sala", "Martí", "Gil", "Amat", "Coll", "Duran", "Oliva", "Reig", "Torres", "Alsina", "Bassas", "Casals", "Domènech", "Escuder"];
function personName() { return `${pick([...FIRST_NAMES_M, ...FIRST_NAMES_F])} ${pick(LAST_NAMES)}`; }

const INSTRUMENTS = ["Veu", "Guitarra", "Baix", "Bateria", "Teclats", "Saxo", "Trompeta", "Trombó", "Percussió", "Violí", "DJ", "Producció"];
const CREW_ROLES = ["Tècnic de so", "Tècnic de llums", "Regidor", "Tour manager", "Backline"];

const BAND_WORDS_A = ["Confetti", "Vermell", "Groc", "Nòmades", "Elèctric", "Salvatge", "Urbà", "Diagonal", "Batec", "Trencaclosques", "Mirall", "Costa", "Blau", "Foc", "Pols", "Ritme", "Arrel", "Estrella", "Marea", "Xarop"];
const BAND_WORDS_B = ["Groc", "Club", "Sound", "Live", "Band", "Orquestra", "Project", "Collectiu", "So", "Beat", "Corda", "Vent", "Nit", "Dia", "Festa", "Riu", "Serra", "Vela", "Llamp", "Trip"];
function bandName(i) { return `${pick(BAND_WORDS_A)} ${pick(BAND_WORDS_B)}${rnd() < 0.15 ? " " + pick(["Big Band", "Trio", "Quartet", "Sound System"]) : ""} ${i}`.replace(/\s+\d+$/, m => rnd() < 0.5 ? "" : m); }

const CITIES = ["Barcelona", "Girona", "Lleida", "Tarragona", "Mataró", "Sabadell", "Terrassa", "Manresa", "Vic", "Figueres", "Reus", "Blanes", "Cornellà de Llobregat", "Sant Cugat del Vallès", "Vilafranca del Penedès", "Igualada", "Olot", "Palamós", "Calella", "Granollers", "Berga", "Ripoll", "La Bisbal d'Empordà", "Sant Feliu de Guíxols", "Cambrils", "Valls", "Amposta", "Tortosa", "Banyoles", "Puigcerdà"];
const VENUE_TYPES = ["Pavelló Municipal", "Plaça Major", "Casal de Cultura", "Envelat Municipal", "Pista Poliesportiva", "Passeig Marítim", "Recinte Firal", "Parc de la Vila", "Rambla", "Auditori Municipal"];
function venueName(city) { return `${pick(VENUE_TYPES)} de ${city.split(",")[0]}`; }
const FESTA_TYPES = ["Festa Major de", "Festes de Primavera de", "Revetlla de Sant Joan de", "Festa de la Verema de", "Fira de", "Nit Jove de", "Aplec de"];
function festaName(city) { return `${pick(FESTA_TYPES)} ${city.split(",")[0]}`; }

const ORG_SUFFIX = ["Ajuntament de", "Comissió de Festes de", "Associació Cultural de", "Penya Barraquistes de"];
function orgName(city) { return `${pick(ORG_SUFFIX)} ${city.split(",")[0]}`; }

// -------------------------------------------------------- Temporada / ritme
function seasonOf(month1to12) { return (month1to12 >= 5 && month1to12 <= 9) ? "alta" : "baixa"; }
function monthlyCount(season) { return season === "alta" ? randInt(7, 15) : randInt(2, 4); }

// -------------------------------------------------- Full de ruta progressiu
// Percentatge de camps omplerts segons dies fins al concert (0 = ja passat).
function rsFillPct(daysUntil) {
  if (daysUntil <= 0) return 1;
  if (daysUntil <= 14) return 1;
  if (daysUntil <= 30) return 0.8;
  if (daysUntil <= 60) return 0.55;
  if (daysUntil <= 90) return 0.35;
  if (daysUntil <= 150) return 0.18;
  return 0.08;
}
// Ordre real de com sol arribar la informació d'un promotor: primer el
// lloc/horaris, després contacte, després hospitalitat, tècnic al final.
function buildRouteSheet(c, contact, pct) {
  const slots = [];
  const rs = {
    lloc: [
      { label: "Adreça", value: "" },
      { label: "Descàrrega", value: "" },
      { label: "Parking", value: "", plates: "" },
      { label: "Número de vehicles", value: "", plates: "" },
    ],
    contacts: [{ role: "Promotor", name: contact.name, phone: contact.phone, company: contact.company }],
    schedule: [
      { phase: "Arribada", start: "", end: "" },
      { phase: "Muntatge", start: "", end: "" },
      { phase: "Proves de so", start: "", end: "" },
      { phase: "Concert", start: c.time, end: "" },
    ],
    hospitalitat: [
      { label: "Dietes", value: "" },
      { label: "Catering", value: "" },
      { label: "Camerino", value: "" },
      { label: "Allotjament", value: "", phone: "", location: "", parkingPlates: "", checkIn: "", checkOut: "", breakfastTime: "" },
    ],
    tecnic: [
      { label: "Mesures escenari", value: "" },
      { label: "Tarimes", value: "" },
      { label: "Contra rider", value: "" },
      { label: "Backline", value: "" },
      { label: "Pantalla LED", value: "" },
    ],
  };
  // Slots en ordre de prioritat (primer els que arriben abans a la vida real).
  slots.push(() => { rs.lloc[0].value = `Carrer ${pick(["Major", "Nou", "de l'Església", "del Carme", "de la Pau"])}, ${randInt(1, 90)}`; });
  slots.push(() => {
    const st = randInt(9, 11); const ct = parseInt(c.time, 10);
    rs.schedule[0].start = `${String(st).padStart(2, "0")}:00`;
    rs.schedule[1].start = `${String(st + 1).padStart(2, "0")}:00`;
    rs.schedule[2].start = `${String(Math.max(st + 3, ct - 2)).padStart(2, "0")}:00`;
  });
  slots.push(() => { rs.contacts[0].name = contact.name; rs.contacts[0].phone = contact.phone; });
  slots.push(() => { rs.lloc[3].value = String(randInt(1, 3)); });
  slots.push(() => { rs.lloc[2].value = rnd() < 0.6 ? "Sí, al costat del recinte" : "No hi ha pàrquing reservat"; });
  slots.push(() => { rs.hospitalitat[0].value = rnd() < 0.5 ? `${randInt(10, 15)} € / persona` : "Inclòs a l'àpat"; });
  slots.push(() => { rs.hospitalitat[1].value = pick(["Sopar calent al camerino", "Càtering fred", "Restaurant proper", "Pícnic al bus"]); });
  slots.push(() => { rs.hospitalitat[2].value = pick(["Sala annexa al pavelló", "Caravana pròpia", "Vestidor municipal", "Sala d'actes"]); });
  slots.push(() => { rs.lloc[1].value = pick(["Accés directe per la part de darrere", "Cal descarregar al carrer i portar-ho a mà", "Moll de càrrega disponible"]); });
  slots.push(() => { rs.tecnic[0].value = pick(["8x6 m", "10x7 m", "6x4 m", "12x8 m"]); });
  slots.push(() => { rs.tecnic[3].value = pick(["Bateria completa inclosa", "Cal portar bateria pròpia", "Amplis de baix i guitarra inclosos"]); });
  slots.push(() => { rs.tecnic[1].value = rnd() < 0.5 ? "2 tarimes de bateria" : "Sense tarimes"; });
  slots.push(() => { rs.tecnic[4].value = rnd() < 0.4 ? "Pantalla LED disponible, 4x3 m" : "Sense pantalla"; });
  slots.push(() => { rs.hospitalitat[3].value = pick(["Hotel Can Roure", "Hostal La Plaça", "Pensió Central", ""]); rs.hospitalitat[3].phone = "972" + randInt(100000, 999999); });
  slots.push(() => { rs.tecnic[2].value = pick(["Enviat i acceptat", "Pendent d'enviar", "En revisió pel tècnic"]); });

  const n = Math.round(pct * slots.length);
  for (let i = 0; i < n; i++) slots[i]();
  return rs;
}

// ---------------------------------------------------------- Rider / Setlist
const SONG_TITLES = ["Nit de Revetlla", "Llum de Tardor", "Ball de Gegants", "Camí de Sorra", "Rumba del Vent", "Foc a la Sang", "Cançó del Mar", "Trencaneu", "Set de Mel", "Somni de Vidre", "Balada del Riu", "Xardor", "Passa-ho Bé", "Marea Baixa", "Vint Anys", "Nit Blava", "Terra Endins", "Salta-taulells", "Cel de Ponent", "Ritme Salvatge", "Cançó per Ballar", "Tornarem", "Estels", "Costa Amunt", "Verd i Groc"];
function makeSetlist(bandId) {
  const n = randInt(12, 18);
  const songs = pickN(SONG_TITLES, Math.min(n, SONG_TITLES.length)).map((title) => ({
    title, duration: `${randInt(2, 5)}:${String(randInt(0, 59)).padStart(2, "0")}`,
    key: pick(["Do", "Re", "Mi", "Fa", "Sol", "La", "Si", "Lam", "Rem", "Solm"]), notes: rnd() < 0.2 ? "Intro allargada en directe" : "",
  }));
  while (songs.length < n) songs.push({ title: `${pick(SONG_TITLES)} (versió)`, duration: `${randInt(2, 5)}:${String(randInt(0, 59)).padStart(2, "0")}`, key: pick(["Do", "Re", "Mi"]), notes: "" });
  return { id: id("sl"), bandId, name: "Setlist principal", songs, publicToken: id("pt"), workspace_id: WS };
}
function makeRider(bandId, members) {
  const inputs = members.slice(0, 8).map((m, i) => ({ ch: String(i + 1), source: m.instruments?.[0] || m.role, mic: pick(["SM58", "SM57", "Beta 58", "DI box", "e935", "Overheads"]), stand: pick(["Alt recte", "Petit de taula", "Boom llarg", "—"]), notes: "" }));
  return {
    id: id("r"), bandId, name: "Rider tècnic",
    content: {
      intro: "Rider tècnic estàndard de la formació — qualsevol canvi cal parlar-lo amb el tècnic del grup amb antelació.",
      contacts: [{ role: "Tècnic de so", name: personName(), phone: "6" + randInt(10000000, 99999999), email: "so@" + "grup.cat" }],
      stage: { widthM: randInt(6, 12), depthM: randInt(4, 8), items: [] },
      inputs, outputs: [{ ch: "L/R", dest: "PA principal", kind: "XLR", notes: "" }, { ch: "Mon 1-3", dest: "Monitors escenari", kind: "XLR", notes: "" }],
      monitors: members.slice(0, 4).map((m) => ({ who: m.name, kind: pick(["Falca", "In-ear"]), notes: "" })),
      backline: [{ item: "Bateria completa", providedBy: rnd() < 0.5 ? "grup" : "organitzacio", notes: "" }, { item: "Amplis guitarra/baix", providedBy: "grup", notes: "" }],
      audio: "PA mínim 2x 2000W amb subgreus, taula digital 24 canals.",
      lighting: "Joc de llums bàsic amb foquistes des de FOH, moving heads si n'hi ha disponibles.",
      power: "2 línies de 16A independents a menys de 20m de l'escenari.",
      hospitality: "Aigua i beguda isotònica des del muntatge, àpat calent si el concert és de nit.",
      notes: "",
      customFields: [], detailsOrder: ["audio", "power", "lighting", "hospitality"], pages: [],
    },
    publicToken: id("pt"), workspace_id: WS,
  };
}

// -------------------------------------------------------------- Generació
async function main() {
  console.log("Comprovant workspace...");
  const wsRow = (await pool.query("select id from workspaces where id=$1", [WS])).rows[0];
  if (!wsRow) throw new Error("Workspace " + WS + " no existeix — atura't.");
  const prof = (await pool.query("select clerk_user_id from profiles where clerk_user_id=$1 and workspace_id=$2", [OWNER_CLERK_ID, WS])).rows[0];
  if (!prof) throw new Error("El perfil propietari no coincideix amb la workspace — atura't per seguretat.");

  console.log("Esborrant dades existents de " + WS + "...");
  const del = async (sql) => { await pool.query(sql, [WS]); };
  await del("delete from backup_requests where workspace_id=$1");
  await del("delete from attendance_links where workspace_id=$1");
  await del("delete from share_links where workspace_id=$1");
  await del("delete from rider_approvals where workspace_id=$1");
  await del("delete from invoices where workspace_id=$1");
  await del("delete from transactions where workspace_id=$1");
  await del("delete from checklists where workspace_id=$1");
  await del("delete from contact_interactions where workspace_id=$1");
  await del("delete from contacts where workspace_id=$1");
  await del("delete from concerts where workspace_id=$1");
  await del("delete from riders where workspace_id=$1");
  await del("delete from setlists where workspace_id=$1");
  await del("delete from songs where workspace_id=$1");
  await del("delete from files where workspace_id=$1");
  await del("delete from person_profiles where workspace_id=$1");
  await del("delete from client_details where workspace_id=$1");
  await del("delete from company_info where workspace_id=$1");
  await del("delete from bands where workspace_id=$1");
  await del("delete from agency_invitations where workspace_id=$1");
  await pool.query("delete from subs_availability where clerk_user_id=$1", [OWNER_CLERK_ID]);
  await pool.query("delete from unavailability_events where clerk_user_id=$1", [OWNER_CLERK_ID]);
  console.log("Esborrat fet.");

  // ---- Company info (l'agència) ----
  await pool.query(
    `insert into company_info (nom, cif, address, iban, workspace_id, iva_rate, irpf_rate) values ($1,$2,$3,$4,$5,21,0)
     on conflict (workspace_id) do update set nom=excluded.nom, cif=excluded.cif, address=excluded.address, iban=excluded.iban`,
    ["Nil Canyelles Produccions SL", "B" + randInt(10000000, 99999999), "Carrer de la Música, 12, Barcelona", "ES" + randInt(1000000000000000000, 9999999999999999), WS]
  );

  // ---- Contactes (promotors/organitzadors reutilitzats) ----
  const contacts = [];
  const contactCities = pickN(CITIES, 24);
  for (const city of contactCities) {
    const c = {
      id: id("ct"), name: personName(), company: orgName(city), phone: "6" + randInt(10000000, 99999999),
      email: "cultura@" + city.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "") + ".cat",
      cif: "P" + randInt(1000000, 9999999) + pick(["A", "B", "C"]), address: `Plaça de l'Ajuntament, 1, ${city}`,
      iban: "ES" + randInt(1000000000000000000, 9999999999999999), city,
      payTermDays: pick([15, 30, 30, 30, 45, 60, 90]),
    };
    contacts.push(c);
    await pool.query(
      `insert into contacts (id, name, kinds, role, phone, email, company, cif, address, iban, notes, workspace_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'',$11)`,
      [c.id, c.name, JSON.stringify(["promotor"]), "Regidoria de Cultura", c.phone, c.email, c.company, c.cif, c.address, c.iban, WS]
    );
    await pool.query(
      `insert into client_details (client_name, cif, nom, address, workspace_id) values ($1,$2,$3,$4,$5)
       on conflict (workspace_id, client_name) do nothing`,
      [c.company, c.cif, c.company, c.address, WS]
    );
  }

  // ---- Finestra temporal: 7 mesos enrere, 4 endavant (cicle estacional sencer) ----
  const months = [];
  for (let off = -7; off <= 4; off++) {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() + off, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth() + 1, daysInMonth: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() });
  }

  const allPersonProfiles = new Map(); // name -> {name, role, instruments}
  let totalConcerts = 0, totalInvoices = 0;

  for (let bi = 1; bi <= 20; bi++) {
    const city0 = pick(CITIES);
    const memberCount = randInt(4, 7);
    const members = Array.from({ length: memberCount }, () => ({
      name: personName(), role: "Músic", instruments: pickN(INSTRUMENTS, randInt(1, 2)),
      phone: "6" + randInt(10000000, 99999999), email: "", perms: {},
    }));
    const crewCount = randInt(1, 3);
    const crew = pickN(CREW_ROLES, crewCount).map((role) => ({ name: personName(), role, instruments: [], phone: "6" + randInt(10000000, 99999999), email: "", perms: {} }));
    const backups = Array.from({ length: randInt(2, 4) }, () => ({ name: personName(), instruments: pickN(INSTRUMENTS, randInt(1, 2)), phone: "6" + randInt(10000000, 99999999), email: "" }));
    [...members, ...crew].forEach((p) => { if (!allPersonProfiles.has(p.name)) allPersonProfiles.set(p.name, p); });

    const bandId = id("b");
    const c1 = pick(["#8b7bff", "#ff6b6b", "#4ecdc4", "#ffd93d", "#6bcb77", "#ff9f45", "#5a67d8", "#e94560", "#00b8a9", "#f8961e"]);
    const c2 = pick(["#5f4bcc", "#c44536", "#2a9d8f", "#e0a800", "#3c8c40", "#d97706", "#3730a3", "#a4133c", "#007f73", "#c9720f"]);
    const vehicles = Array.from({ length: randInt(1, 2) }, () => ({ type: pick(["Furgoneta", "Camió", "Turisme"]), brand: pick(["Mercedes", "Iveco", "Renault", "Volkswagen", "Ford"]), color: pick(["Blanc", "Gris", "Negre", "Blau"]), owner: pick(members).name, plate: `${randInt(1000, 9999)}${pick(["BCD", "FGH", "JKL", "MNP"])}` }));

    const name = bandName(bi);
    await pool.query(
      `insert into bands (id, name, city, rate, contact, phone, tags, members, crew, workspace_id, join_code, logo, color1, color2, backups, show_fees, vehicles, bio, active_since)
       values ($1,$2,$3,$4,'','',$5,$6,$7,$8,$9,'',$10,$11,$12,true,$13,$14,$15)`,
      [bandId, name, city0, randInt(800, 4000), JSON.stringify(pick([["verbena"], ["festa major"], ["revetlla"], ["ball"], ["festival"]])),
        JSON.stringify(members), JSON.stringify(crew), WS, randomBytes(3).toString("hex").toUpperCase(),
        c1, c2, JSON.stringify(backups), JSON.stringify(vehicles),
        `Formació de referència a la comarca, amb repertori de ball i verbena per a tot tipus de públic.`,
        String(randInt(1998, 2022))]
    );

    const setlist = makeSetlist(bandId);
    await pool.query(
      `insert into setlists (id, workspace_id, band_id, name, songs, public_token) values ($1,$2,$3,$4,$5,$6)`,
      [setlist.id, WS, bandId, setlist.name, JSON.stringify(setlist.songs), setlist.publicToken]
    );
    const rider = makeRider(bandId, members);
    await pool.query(
      `insert into riders (id, workspace_id, band_id, name, content, public_token) values ($1,$2,$3,$4,$5,$6)`,
      [rider.id, WS, bandId, rider.name, JSON.stringify(rider.content), rider.publicToken]
    );

    // ---- Concerts ----
    const activePeople = [...members, ...crew];
    for (const mo of months) {
      const season = seasonOf(mo.m);
      const count = monthlyCount(season);
      const usedDays = new Set();
      for (let k = 0; k < count; k++) {
        let day;
        do { day = randInt(1, mo.daysInMonth); } while (usedDays.has(day));
        usedDays.add(day);
        const date = new Date(mo.y, mo.m - 1, day);
        const dateStr = toDateStr(date);
        const daysUntil = Math.round((date - TODAY) / 86400000);
        const isPast = daysUntil < 0;

        const city = pick(CITIES);
        const contact = pick(contacts);
        const venue = venueName(city);
        const festa = rnd() < 0.7 ? festaName(city) : "";
        const time = pick(["20:00", "21:00", "22:00", "23:00", "00:00"]);
        const amount = randInt(800, 4000);
        let status = "confirmat";
        if (!isPast) status = pick(["confirmat", "confirmat", "confirmat", "reservat", "reservat", "pendent"]);
        if (rnd() < 0.04) status = "cancel·lat";

        const attendance = {};
        const attProb = isPast ? 1 : Math.min(1, rsFillPct(daysUntil) + 0.15);
        activePeople.forEach((p) => { if (rnd() < attProb) attendance[p.name] = rnd() < 0.9 ? "yes" : "no"; });
        const substitutes = {};
        Object.entries(attendance).forEach(([n, v]) => { if (v === "no" && rnd() < 0.6) substitutes[n] = pick(backups).name; });

        const pct = status === "cancel·lat" ? rsFillPct(daysUntil) * 0.4 : rsFillPct(daysUntil);
        const routeSheet = buildRouteSheet({ time }, contact, pct);
        const useSetlist = rnd() < (isPast ? 0.85 : 0.5);
        const useRider = rnd() < (isPast ? 0.7 : 0.4);

        const cid = id("c");
        await pool.query(
          `insert into concerts (id, date, time, venue, city, band_id, band_name, tags, status, amount, attendance, substitutes, no_substitute, route_sheet, festa_entitat, workspace_id, payouts, rider_id, setlist_id, kind, contact, agency_pct, agency_assumes_expenses)
           values ($1,$2,$3,$4,$5,$6,$7,'[]',$8,$9,$10,$11,'{}',$12,$13,$14,'{}',$15,$16,'bolo',$17,20,true)`,
          [cid, dateStr, time, venue, city, bandId, name, status, amount, JSON.stringify(attendance), JSON.stringify(substitutes),
            JSON.stringify(routeSheet), festa, WS, useRider ? rider.id : null, useSetlist ? setlist.id : null,
            JSON.stringify({ email: contact.email, name: contact.name, phone: contact.phone, company: contact.company })]
        );
        totalConcerts++;

        // ---- Factura (només concerts passats i no cancel·lats) ----
        if (isPast && status !== "cancel·lat") {
          const issue = new Date(date); issue.setDate(issue.getDate() + randInt(0, 5));
          const due = new Date(issue); due.setDate(due.getDate() + contact.payTermDays);
          const base = amount;
          const total = Math.round(base * 1.21);
          const paid = rnd() < 0.85;
          const invId = id("inv");
          await pool.query(
            `insert into invoices (id, concert_id, client, band_name, issue_date, due_date, amount, state, workspace_id, base_amount, iva_rate, irpf_rate, deposit_amount, deposit_paid)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,21,0,0,false)`,
            [invId, cid, contact.company, name, toDateStr(issue), toDateStr(due), total, paid ? "pagada" : "pendent", WS, base]
          );
          totalInvoices++;
        }
      }
    }
    console.log(`Grup ${bi}/20 "${name}" fet.`);
  }

  // ---- Perfils de músics/crew de l'agència (persones amb fitxa pública) ----
  let profilesMade = 0;
  for (const [nameKey, p] of allPersonProfiles) {
    if (rnd() > 0.35) continue; // no calen fitxa tots — només una part realista
    await pool.query(
      `insert into person_profiles (id, workspace_id, person_name, bio, ig_handle, role_label, phone, open_to_subs, profile_public)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
      [id("pp"), WS, nameKey,
        `${p.instruments?.length ? p.instruments.join(", ") : p.role} a temps parcial des de fa uns anys, sempre amb ganes de tocar per tota Catalunya.`,
        "@" + nameKey.toLowerCase().normalize("NFD").replace(/[^a-z]/g, ""),
        p.instruments?.length ? p.instruments.join(" / ") : p.role, p.phone || "", rnd() < 0.3]
    );
    profilesMade++;
  }

  console.log(`\nFet: 20 grups, ${totalConcerts} concerts, ${totalInvoices} factures, ${profilesMade} perfils de músic.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
