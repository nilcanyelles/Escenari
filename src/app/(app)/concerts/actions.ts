"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Concert } from "@/lib/types";
import { requireManagerAction } from "@/lib/current-user";
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

// Repartiment del caixet entre les persones del bolo: { "Nom": import en € }.
export async function savePayoutsAction(concertId: string, payouts: Record<string, number>) {
  const { workspaceId } = await requireManagerAction();
  await db().query("update concerts set payouts=$1 where id=$2 and workspace_id=$3", [JSON.stringify(payouts || {}), concertId, workspaceId]);
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
export async function searchVenuesAction(query: string): Promise<{ description: string; name: string; placeId: string }[]> {
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
    const out: { description: string; name: string; placeId: string }[] = [];
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
      out.push({ description, name, placeId: `${p.osm_type || "n"}${p.osm_id ?? out.length}` });
    }
    return out;
  } catch {
    return [];
  }
}
