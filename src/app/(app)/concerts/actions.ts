"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Concert } from "@/lib/types";
import { requireManagerAction } from "@/lib/current-user";
import { requireBandAccess } from "@/lib/band-access";
import { syncRouteSheetContactsToContacts } from "@/app/(app)/contactes/actions";

export type SaveConcertInput = {
  id: string | null;
  bandName: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  festaEntitat: string;
  amount: number;
  status: string;
  attendance: Record<string, string>;
  substitutes: Record<string, string>;
  noSubstitute: Record<string, boolean>;
  skipDefaults?: boolean;
};

function revalidateAll() {
  revalidatePath("/concerts");
  revalidatePath("/resum");
  revalidatePath("/calendari");
  revalidatePath("/base-de-dades");
  revalidatePath("/grups");
  revalidatePath("/artista");
}

// Sense caràcters ambigus (0/O, 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export async function saveConcertAction(data: SaveConcertInput) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const typedName = (data.bandName || "").trim();
  const typedLower = typedName.toLowerCase();

  let bandRow = (await pool.query("select * from bands where lower(name) = $1 and workspace_id=$2", [typedLower, workspaceId])).rows[0];

  if (!bandRow && data.id) {
    const existing = (await pool.query("select * from concerts where id=$1 and workspace_id=$2", [data.id, workspaceId])).rows[0];
    if (existing) {
      bandRow = (await pool.query("select * from bands where id=$1 and workspace_id=$2", [existing.band_id, workspaceId])).rows[0];
      if (bandRow && typedName && bandRow.name !== typedName) {
        await pool.query("update bands set name=$1 where id=$2", [typedName, bandRow.id]);
        await pool.query("update concerts set band_name=$1 where band_id=$2", [typedName, bandRow.id]);
        bandRow.name = typedName;
      }
    }
  }
  if (!bandRow && typedName) {
    const newId = "b" + Date.now();
    await pool.query(
      "insert into bands (id, name, city, rate, contact, phone, tags, members, crew, workspace_id, join_code) values ($1,$2,$3,$4,'','', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $5, $6)",
      [newId, typedName, data.city || "—", Math.round(data.amount) || 0, workspaceId, generateJoinCode()]
    );
    bandRow = (await pool.query("select * from bands where id=$1", [newId])).rows[0];
  }
  if (!bandRow && !data.skipDefaults) {
    bandRow = (await pool.query("select * from bands where workspace_id=$1 order by name limit 1", [workspaceId])).rows[0];
  }
  if (!bandRow && !data.skipDefaults) return;

  const venue = data.skipDefaults ? data.venue.trim() : (data.venue.trim() || "Sala per determinar");
  const city = data.skipDefaults ? data.city.trim() : (data.city.trim() || bandRow.city);

  const id = data.id || "c" + Date.now();
  await pool.query(
    `insert into concerts (id, date, time, venue, city, festa_entitat, band_id, band_name, tags, status, amount, attendance, substitutes, no_substitute, workspace_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     on conflict (id) do update set
       date=$2, time=$3, venue=$4, city=$5, festa_entitat=$6, band_id=$7, band_name=$8, tags=$9, status=$10, amount=$11,
       attendance=$12, substitutes=$13, no_substitute=$14
     where concerts.workspace_id = excluded.workspace_id`,
    [
      id, data.date, data.time, venue, city, (data.festaEntitat || "").trim(),
      bandRow ? bandRow.id : null, bandRow ? bandRow.name : "", JSON.stringify(bandRow?.tags || []), data.status, Math.round(data.amount) || 0,
      JSON.stringify(data.attendance || {}), JSON.stringify(data.substitutes || {}), JSON.stringify(data.noSubstitute || {}),
      workspaceId,
    ]
  );

  revalidateAll();

  return {
    id,
    date: data.date,
    time: data.time,
    venue,
    city,
    festaEntitat: (data.festaEntitat || "").trim(),
    bandId: bandRow ? bandRow.id : "",
    bandName: bandRow ? bandRow.name : "",
    tags: bandRow?.tags || [],
    status: data.status as Concert["status"],
    amount: Math.round(data.amount) || 0,
    attendance: data.attendance || {},
    substitutes: data.substitutes || {},
    noSubstitute: data.noSubstitute || {},
    routeSheet: null,
  } as Concert;
}

export async function saveRouteSheetAction(concertId: string, routeSheet: unknown) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  await pool.query("update concerts set route_sheet = $1 where id = $2 and workspace_id=$3", [JSON.stringify(routeSheet), concertId, workspaceId]);
  const contacts = (routeSheet as { contacts?: { name: string; role: string; phone: string; company: string }[] } | null)?.contacts;
  if (contacts) await syncRouteSheetContactsToContacts(workspaceId, contacts);
  revalidateAll();
  revalidatePath("/contactes");
}

// Recordatori d'assistència: correu als membres vinculats que encara no han
// dit ni sí ni no a un bolo.
export async function nudgeAttendanceAction(concertId: string): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const { workspaceId } = await requireManagerAction();
  const { emailConfigured, sendEmail } = await import("@/lib/email");
  if (!emailConfigured()) return { ok: false, error: "Configura RESEND_API_KEY per enviar correus" };
  const { rows } = await db().query(
    `select c.date, c.time, c.city, c.venue, c.band_name, c.attendance, bm.member_name, p.email
     from concerts c
     join band_members bm on bm.band_id = c.band_id
     join profiles p on p.clerk_user_id = bm.clerk_user_id
     where c.id=$1 and c.workspace_id=$2 and p.email <> ''`,
    [concertId, workspaceId]
  );
  let sent = 0;
  for (const r of rows) {
    const answer = (r.attendance || {})[r.member_name];
    if (answer === "yes" || answer === "no") continue;
    const dateStr = typeof r.date === "string" ? r.date.slice(0, 10) : r.date.toISOString().slice(0, 10);
    const res = await sendEmail({
      to: r.email,
      subject: `Pots venir al bolo de ${r.band_name} el ${dateStr}?`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #12101f; color: #f5f4fa; padding: 28px; border-radius: 16px;">
          <div style="letter-spacing: 4px; font-size: 12px; color: #a99df5; margin-bottom: 18px;">ESCENARI</div>
          <h2 style="margin: 0 0 6px; font-size: 18px;">Encara no has confirmat</h2>
          <p style="color: #b9b5cc; margin: 0 0 16px;">${r.band_name} · ${dateStr}${r.time ? " · " + r.time + "h" : ""}${r.city ? " · " + r.city : ""}</p>
          <p style="color: #d9d6e8;">Entra a Escenari i digues si hi seràs — el gestor necessita tancar la formació.</p>
        </div>`,
    });
    if (res.ok) sent++;
  }
  return { ok: true, sent };
}

// Importació ràpida de bolos passats o futurs: una línia per concert,
// "data; grup; població; ubicació; festa; import; estat".
export async function importConcertsAction(raw: string): Promise<{ imported: number; errors: number }> {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  let imported = 0, errors = 0;
  for (const line of (raw || "").split("\n")) {
    const parts = line.split(/[;\t]/).map((p) => p.trim());
    const dateRaw = parts[0];
    const bandName = parts[1];
    if (!dateRaw || !bandName) { if (line.trim()) errors++; continue; }
    // Accepta aaaa-mm-dd o dd/mm/aaaa.
    let date = dateRaw;
    const dm = dateRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dm) date = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors++; continue; }

    let bandRow = (await pool.query("select id, name, tags from bands where lower(name)=$1 and workspace_id=$2", [bandName.toLowerCase(), workspaceId])).rows[0];
    if (!bandRow) {
      const newId = "b" + Date.now() + imported;
      await pool.query(
        "insert into bands (id, name, city, rate, contact, phone, tags, members, crew, workspace_id, join_code) values ($1,$2,$3,0,'','','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,$4,$5)",
        [newId, bandName, parts[2] || "—", workspaceId, generateJoinCode()]
      );
      bandRow = { id: newId, name: bandName, tags: [] };
    }
    const status = ["confirmat", "pendent", "reservat", "cancel·lat"].includes(parts[6]) ? parts[6] : "confirmat";
    await pool.query(
      `insert into concerts (id, date, time, venue, city, festa_entitat, band_id, band_name, tags, status, amount, attendance, substitutes, no_substitute, workspace_id)
       values ($1,$2,'21:00',$3,$4,$5,$6,$7,$8,$9,$10,'{}','{}','{}',$11)`,
      ["c" + Date.now() + imported, date, parts[3] || "", parts[2] || "", parts[4] || "", bandRow.id, bandRow.name,
        JSON.stringify(bandRow.tags || []), status, parseInt(parts[5], 10) || 0, workspaceId]
    );
    imported++;
  }
  revalidateAll();
  return { imported, errors };
}

// Creació d'un esdeveniment intern (assaig, reunió, altre) amb convidats i
// repetició estil Google Calendar. Torna els ids creats.
export async function createEventAction(input: {
  bandId: string;
  kind: "assaig" | "reunio" | "altre";
  title: string;
  date: string;
  time: string;
  city: string;
  venue: string;
  invited: string[];
  repeat: { freq: "cap" | "setmanal" | "quinzenal" | "mensual"; count: number };
}): Promise<{ created: number; firstId: string | null }> {
  // Gestor, o membre del grup amb el permís "Esdeveniments".
  const { workspaceId } = await requireBandAccess(input.bandId, "events");
  const pool = db();
  const band = (await pool.query("select id, name, tags, city from bands where id=$1 and workspace_id=$2", [input.bandId, workspaceId])).rows[0];
  if (!band) return { created: 0, firstId: null };

  const occurrences = input.repeat.freq === "cap" ? 1 : Math.min(Math.max(input.repeat.count, 1), 30);
  const p0 = input.date.split("-").map(Number);
  let created = 0;
  let firstId: string | null = null;
  for (let i = 0; i < occurrences; i++) {
    let d: Date;
    if (input.repeat.freq === "mensual") d = new Date(p0[0], p0[1] - 1 + i, p0[2]);
    else {
      const stepDays = input.repeat.freq === "quinzenal" ? 14 : input.repeat.freq === "setmanal" ? 7 : 0;
      d = new Date(p0[0], p0[1] - 1, p0[2] + i * stepDays);
    }
    const dateStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const id = "c" + Date.now() + i;
    if (!firstId) firstId = id;
    await pool.query(
      `insert into concerts (id, date, time, venue, city, festa_entitat, band_id, band_name, tags, status, amount,
                             attendance, substitutes, no_substitute, workspace_id, kind, invited)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmat',0,'{}','{}','{}',$10,$11,$12)`,
      [id, dateStr, input.time || "20:00", (input.venue || "").trim(), (input.city || "").trim() || band.city || "",
        (input.title || "").trim(), band.id, band.name,
        JSON.stringify(band.tags || []), workspaceId, input.kind, JSON.stringify(input.invited || [])]
    );
    created++;
  }
  revalidateAll();
  return { created, firstId };
}

// Tipus d'esdeveniment del calendari (bolo, assaig, reunió, altre).
export async function setConcertKindAction(id: string, kind: "bolo" | "assaig" | "reunio" | "altre") {
  const { workspaceId } = await requireManagerAction();
  await db().query("update concerts set kind=$1 where id=$2 and workspace_id=$3", [kind, id, workspaceId]);
  revalidateAll();
  revalidatePath(`/concerts/${id}`);
}

// Repeteix un esdeveniment setmanalment N cops (assajos, residències...).
export async function repeatConcertAction(id: string, weeks: number): Promise<{ created: number }> {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const c = (await pool.query("select * from concerts where id=$1 and workspace_id=$2", [id, workspaceId])).rows[0];
  if (!c) return { created: 0 };
  const n = Math.min(Math.max(weeks, 1), 26);
  const baseDate = typeof c.date === "string" ? c.date.slice(0, 10) : c.date.toISOString().slice(0, 10);
  let created = 0;
  for (let i = 1; i <= n; i++) {
    const p = baseDate.split("-").map(Number);
    const d = new Date(p[0], p[1] - 1, p[2] + i * 7);
    const dateStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const newId = "c" + Date.now() + i;
    await pool.query(
      `insert into concerts (id, date, time, venue, city, festa_entitat, band_id, band_name, tags, status, amount, attendance, substitutes, no_substitute, workspace_id, kind)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'{}','{}','{}',$12,$13)`,
      [newId, dateStr, c.time, c.venue, c.city, c.festa_entitat, c.band_id, c.band_name, JSON.stringify(c.tags || []), c.status, c.amount, workspaceId, c.kind || "bolo"]
    );
    created++;
  }
  revalidateAll();
  return { created };
}

// Repartiment del caixet entre les persones del bolo: { "Nom": import en € }.
export async function savePayoutsAction(concertId: string, payouts: Record<string, number>) {
  const { workspaceId } = await requireManagerAction();
  await db().query("update concerts set payouts=$1 where id=$2 and workspace_id=$3", [JSON.stringify(payouts || {}), concertId, workspaceId]);
  revalidatePath(`/concerts/${concertId}`);
}

// Si l'agència assumeix les despeses del bolo (% sobre el net) o no (%
// sobre el brut, i les despeses les absorbeix només la resta).
export async function setAgencyAssumesExpensesAction(concertId: string, value: boolean) {
  const { workspaceId } = await requireManagerAction();
  await db().query("update concerts set agency_assumes_expenses=$1 where id=$2 and workspace_id=$3", [value, concertId, workspaceId]);
  revalidatePath(`/concerts/${concertId}`);
}

// Percentatge fix de la comissió de l'agència (es manté fix encara que
// canviïn les despeses o el caixet).
export async function setAgencyPctAction(concertId: string, pct: number) {
  const { workspaceId } = await requireManagerAction();
  await db().query("update concerts set agency_pct=$1 where id=$2 and workspace_id=$3", [pct, concertId, workspaceId]);
  revalidatePath(`/concerts/${concertId}`);
}

// Horaris del pòster del concert (l'oficial + els que s'hagin afegit per
// altres actuacions el mateix dia), editables des del modal del pòster.
export async function savePosterScheduleAction(concertId: string, items: { time: string; label: string; isOwn?: boolean }[]) {
  const { workspaceId } = await requireManagerAction();
  await db().query(
    "update concerts set poster_schedule=$1 where id=$2 and workspace_id=$3",
    [JSON.stringify(items || []), concertId, workspaceId]
  );
  revalidatePath(`/concerts/${concertId}`);
}

export async function setInvoiceStateAction(invoiceId: string, state: "pagada" | "pendent" | "vençuda") {
  const { workspaceId } = await requireManagerAction();
  await db().query("update invoices set state=$1 where id=$2 and workspace_id=$3", [state, invoiceId, workspaceId]);
  revalidateAll();
  revalidatePath("/facturacio");
}

export async function setConcertStatusAction(id: string, status: string) {
  const { workspaceId } = await requireManagerAction();
  await db().query("update concerts set status=$1 where id=$2 and workspace_id=$3", [status, id, workspaceId]);
  revalidateAll();
}

export async function deleteConcertAction(id: string) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  await pool.query("delete from invoices where concert_id=$1 and workspace_id=$2", [id, workspaceId]);
  await pool.query("delete from concerts where id=$1 and workspace_id=$2", [id, workspaceId]);
  revalidateAll();
}

// Cerca de poblacions reals de tot el món via Photon (photon.komoot.io), una
// API de geocodificació gratuïta basada en OpenStreetMap que no necessita
// clau. Es filtra per type="city" (la classificació pròpia de Photon per a
// nuclis de població: ciutats, viles i pobles), descartant carrers, comarques
// i altres resultats que no siguin una població.
export async function searchCitiesAction(query: string): Promise<{ description: string; placeId: string }[]> {
  await requireManagerAction();
  const q = (query || "").trim();
  if (!q || q.length < 2) return [];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const features: { properties: Record<string, unknown> }[] = data.features || [];
    const seen = new Set<string>();
    const out: { description: string; placeId: string }[] = [];
    for (const f of features) {
      const p = f.properties || {};
      if (p.type !== "city") continue;
      const name = String(p.name || "").trim();
      if (!name) continue;
      const description = [name, p.state, p.country].filter(Boolean).join(", ");
      const key = description.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ description, placeId: `${p.osm_type || "n"}${p.osm_id ?? out.length}` });
    }
    return out;
  } catch {
    return [];
  }
}

// Cerca de recintes/llocs reals (sales, places, pavellons...) via Photon,
// la mateixa API gratuïta que la de poblacions. Aquí no es filtra per
// type="city" perquè un recinte és un punt d'interès concret, no una
// població — es descarten només els resultats sense nom.
export async function searchVenuesAction(query: string): Promise<{ description: string; name: string; city: string; placeId: string }[]> {
  await requireManagerAction();
  const q = (query || "").trim();
  if (!q || q.length < 2) return [];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const features: { properties: Record<string, unknown> }[] = data.features || [];
    const seen = new Set<string>();
    const out: { description: string; name: string; city: string; placeId: string }[] = [];
    for (const f of features) {
      const p = f.properties || {};
      const name = String(p.name || "").trim();
      if (!name) continue;
      const city = String(p.city || "").trim();
      const context = [city || p.state, p.country].filter(Boolean).join(", ");
      const description = context ? `${name}, ${context}` : name;
      const key = description.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ description, name, city, placeId: `${p.osm_type || "n"}${p.osm_id ?? out.length}` });
    }
    return out;
  } catch {
    return [];
  }
}

// Carrers reals al voltant d'un punt (per al mini-mapa del pòster del
// concert), via Overpass (l'API de consultes d'OpenStreetMap): en comptes
// de descarregar rajoles d'imatge ja renderitzades (que es bloquegen o
// mostren una marca d'aigua si se'n demanen moltes sense compte/clau), aquí
// es demana només la geometria real dels carrers i es dibuixa amb l'estil
// propi de l'app — sense dependre de cap servei de rajoles ni patir el
// mateix límit d'ús. Es crida des del servidor (i no directament des del
// navegador) perquè Overpass no respon amb capçaleres CORS.
export async function getStreetWaysAction(lat: number, lon: number, radiusM = 900): Promise<{
  bbox: [number, number, number, number];
  ways: { highway: string; pts: [number, number][] }[];
}> {
  await requireManagerAction();
  const dLat = radiusM / 111320;
  const dLon = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const south = lat - dLat, north = lat + dLat, west = lon - dLon, east = lon + dLon;
  const bbox: [number, number, number, number] = [south, west, north, east];
  const query = `[out:json][timeout:15];way["highway"](${south},${west},${north},${east});out geom;`;
  // Diversos punts d'accés públics d'Overpass, per si el principal està
  // saturat o bloqueja temporalment per excés de peticions (com ha passat
  // avui) — es proven en ordre i es queda amb el primer que respongui.
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "User-Agent": "Escenari (escenari.app, contacte via l'app)",
        },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        console.error("getStreetWaysAction: Overpass ha respost", url, res.status, await res.text().catch(() => ""));
        continue;
      }
      const data = await res.json();
      const elements: { type: string; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }[] = data.elements || [];
      const ways = elements
        .filter((e) => e.type === "way" && e.geometry && e.geometry.length > 1)
        .map((e) => ({
          highway: e.tags?.highway || "",
          pts: e.geometry!.map((g) => [g.lon, g.lat] as [number, number]),
        }));
      return { bbox, ways };
    } catch (err) {
      console.error("getStreetWaysAction: error cridant Overpass", url, err);
    }
  }
  return { bbox, ways: [] };
}

// Geocodifica un grapat de poblacions (per posar-hi xinxetes en un mapa) amb
// la mateixa API gratuïta. Es deduplica i es fan les cerques en paral·lel;
// una població que no es trobi queda a null perquè el mapa la pugui ometre.
// Un sol punt: prova Photon (ràpid) i, si falla o no respon, Nominatim
// (OpenStreetMap oficial) com a reserva — així un problema puntual amb un
// dels dos serveis gratuïts no deixa el mapa en blanc.
// Punt de referència (Madrid) per desempatar entre diversos resultats amb
// un nom relacionat — mai per excloure'n cap, només per triar el més
// proper quan n'hi ha diversos de plausibles.
const GEOCODE_BIAS_LAT = 40, GEOCODE_BIAS_LON = -3;
function biasDistance(lat: number, lon: number): number {
  const cosLat = Math.cos((GEOCODE_BIAS_LAT * Math.PI) / 180);
  return Math.hypot(lat - GEOCODE_BIAS_LAT, (lon - GEOCODE_BIAS_LON) * cosLat);
}
function normalizeForMatch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
// Un nom que NOMÉS conté el terme buscat, sense ser-hi igual (p. ex.
// "Parisot" conté "Paris" però és un poble ben diferent), es penalitza en
// la distància — un handicap prou gran perquè només guanyi a un nom exacte
// quan hi és MOLT més a prop, mai per una proximitat petita.
const PARTIAL_MATCH_PENALTY = 6;
// D'entre uns quants candidats possibles per al mateix terme de cerca, es
// queda amb el més proper al punt de referència — però NOMÉS entre els que
// el seu nom conté realment el terme buscat (exacte, o com a mínim
// parcial). L'API torna els resultats ordenats per rellevància textual (no
// per distància), i pot incloure-hi coincidències purament fonètiques ben
// allunyades del que es demanava (p. ex. cercant "Tenerife" surt
// "Tenetiše", un poble d'Eslovènia que no té "Tenerife" al nom però hi
// sona semblant) — filtrant primer pel nom i desempatant per distància
// només després, es prioritza bé "Tenerife (Canàries)" per davant de
// "Tenerife (Colòmbia)" sense arriscar-se a triar un resultat sense
// relació. I com que una coincidència NOMÉS parcial porta un handicap,
// cercant "Paris" no guanya "Parisot" pel simple fet de quedar una mica
// més a prop — cal un nom exacte igual de plausible per preferir-lo.
function pickBestCandidate(query: string, candidates: { lat: number; lon: number; name: string }[]): { lat: number; lon: number } | null {
  if (!candidates.length) return null;
  const q = normalizeForMatch(query);
  const nameMatches = candidates.filter((c) => normalizeForMatch(c.name).includes(q));
  const pool = nameMatches.length ? nameMatches : candidates;
  const scored = pool.map((c) => ({
    c,
    score: biasDistance(c.lat, c.lon) + (normalizeForMatch(c.name) === q ? 0 : PARTIAL_MATCH_PENALTY),
  }));
  return scored.reduce((best, s) => (s.score < best.score ? s : best)).c;
}

async function geocodeOne(q: string): Promise<{ lat: number; lon: number } | null> {
  // Un nom sol, sense cap coma (p. ex. "Berga" enlloc de "Berga, Catalonia,
  // Spain"), és ambigu: "Berga" també és una ciutat de Noruega, "Alghero"
  // també és el nom d'un restaurant a Igualada, i "Tenerife" també és un
  // poble a Colòmbia. Com que l'app és per a grups que toquen sobretot a
  // Catalunya/Espanya (però no només: també poblacions de parla catalana
  // com l'Alguer, a Sardenya), NO es restringeix la cerca a Espanya
  // (trencaria "Alghero") — només: (1) es demana explícitament una
  // POBLACIÓ (mai un bar, restaurant, carrer o altre establiment) i (2)
  // d'entre els primers resultats possibles, es tria el més proper a la
  // península Ibèrica, sense descartar la resta d'opcions del món.
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "6");
    url.searchParams.set("lang", "en");
    url.searchParams.set("lat", "40");
    url.searchParams.set("lon", "-3");
    url.searchParams.set("zoom", "6");
    url.searchParams.set("layer", "city");
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const features: { properties: Record<string, unknown>; geometry?: { coordinates?: unknown } }[] = data.features || [];
      const candidates = features
        .filter((f) => f.properties?.type === "city" && Array.isArray(f.geometry?.coordinates))
        .map((f) => {
          const [lon, lat] = f.geometry!.coordinates as [number, number];
          return { lon, lat, name: String(f.properties?.name || "") };
        });
      const best = pickBestCandidate(q, candidates);
      if (best) return best;
    }
  } catch { /* prova Nominatim */ }
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "6");
    url.searchParams.set("featureType", "settlement");
    url.searchParams.set("viewbox", "-10,44,4,36");
    url.searchParams.set("bounded", "0");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "EscenariApp/1.0 (full de ruta - mapa de concerts)" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const rows: { lat: string; lon: string; name?: string; display_name?: string }[] = await res.json();
      const candidates = rows
        .map((r) => ({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), name: r.name || r.display_name || "" }))
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
      const best = pickBestCandidate(q, candidates);
      if (best) return best;
    }
  } catch { /* cap dels dos ha trobat res */ }
  return null;
}

// Executa `fn` sobre `items` amb un màxim de `limit` peticions alhora, per no
// carregar de cop les APIs gratuïtes (que poden bloquejar ràfegues massa grans).
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Geocodifica poblacions amb un cache permanent a la base de dades: un cop es
// resol una població no es torna a demanar mai més a cap API externa.
export async function geocodeCitiesAction(cities: string[]): Promise<Record<string, { lat: number; lon: number } | null>> {
  await requireManagerAction();
  const unique = Array.from(new Set((cities || []).map((c) => (c || "").trim()).filter(Boolean)));
  if (!unique.length) return {};
  const pool = db();
  const out: Record<string, { lat: number; lon: number } | null> = {};

  const { rows } = await pool.query("select query, lat, lon from geocode_cache where query = any($1)", [unique]);
  const cached = new Set<string>();
  for (const r of rows) {
    out[r.query] = r.lat != null && r.lon != null ? { lat: r.lat, lon: r.lon } : null;
    cached.add(r.query);
  }

  const missing = unique.filter((q) => !cached.has(q));
  if (missing.length) {
    const resolved = await mapLimit(missing, 4, geocodeOne);
    for (let i = 0; i < missing.length; i++) {
      const q = missing[i], coord = resolved[i];
      out[q] = coord;
      await pool.query(
        `insert into geocode_cache (query, lat, lon) values ($1,$2,$3)
         on conflict (query) do update set lat=excluded.lat, lon=excluded.lon, updated_at=now()`,
        [q, coord?.lat ?? null, coord?.lon ?? null]
      );
    }
  }
  return out;
}
