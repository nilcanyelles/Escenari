"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Person } from "@/lib/types";
import { requireManagerAction } from "@/lib/current-user";
import { requireBandAccess } from "@/lib/band-access";
import { syncBandPeopleToContacts } from "@/app/(app)/contactes/actions";
import { getOrCreatePersonProfile } from "@/lib/person-profile";

export type SaveBandInput = {
  id: string;
  name: string;
  tags: string[];
  city: string;
  rate: string;
  contact: string;
  phone: string;
  members: Person[];
  crew: Person[];
};

export async function saveBandAction(data: SaveBandInput) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const newName = (data.name || "").trim();
  const tags = data.tags.filter((t) => t && t.trim());
  const members = data.members.filter((p) => p.name && p.name.trim());
  const crew = data.crew.filter((p) => p.name && p.name.trim());
  const city = (data.city || "").trim();
  const rate = parseInt(data.rate, 10) || 0;
  const contact = (data.contact || "").trim();
  const phone = (data.phone || "").trim();

  const existing = (await pool.query("select name from bands where id=$1 and workspace_id=$2", [data.id, workspaceId])).rows[0];
  if (!existing) return;

  await pool.query(
    `update bands set name=$1, tags=$2, city=$3, rate=$4, contact=$5, phone=$6, members=$7, crew=$8 where id=$9 and workspace_id=$10`,
    [newName || existing.name, JSON.stringify(tags), city, rate, contact, phone, JSON.stringify(members), JSON.stringify(crew), data.id, workspaceId]
  );

  await pool.query(
    "update concerts set band_name=$1, tags=$2 where band_id=$3 and workspace_id=$4",
    [newName || existing.name, JSON.stringify(tags), data.id, workspaceId]
  );

  await syncBandPeopleToContacts(workspaceId, members.concat(crew));

  revalidatePath("/grups");
  revalidatePath("/concerts");
  revalidatePath("/resum");
  revalidatePath("/calendari");
  revalidatePath("/base-de-dades");
  revalidatePath("/contactes");
}

// Els músics/crew viuen dins dels grups (sense identitat pròpia): la mateixa
// persona pot aparèixer a diversos grups com a entrades independents amb el
// mateix nom. Editar el seu contacte actualitza totes les entrades que
// coincideixin de nom a tots els grups, perquè es vegi com una sola persona.
// Els instruments ja NO es toquen aquí: són propis de la persona
// (updatePersonInstrumentsAction) i, dins de cada grup, un subconjunt propi
// (updateMembershipInstrumentsAction) — vegeu els comentaris de sota.
export async function updatePersonContactAction(data: { name: string; newName?: string; phone: string; email: string }) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const name = (data.name || "").trim();
  if (!name) return;
  const newName = (data.newName || "").trim() || name;
  const phone = (data.phone || "").trim();
  const email = (data.email || "").trim();

  const { rows } = await pool.query("select id, members, crew from bands where workspace_id=$1", [workspaceId]);
  for (const row of rows) {
    let changed = false;
    const patch = (list: Person[]) => list.map((p) => {
      if (p.name !== name) return p;
      changed = true;
      return { ...p, name: newName, phone, email };
    });
    const members = patch(row.members || []);
    const crew = patch(row.crew || []);
    if (changed) {
      await pool.query("update bands set members=$1, crew=$2 where id=$3", [JSON.stringify(members), JSON.stringify(crew), row.id]);
    }
  }

  await syncBandPeopleToContacts(workspaceId, [{ name: newName, role: "", phone, email }]);

  revalidatePath("/grups");
  revalidatePath("/contactes");
}

// Instrument/funció d'una persona dins d'UN grup concret (a diferència del
// contacte i els instruments propis, el rol pot variar de grup a grup).
export async function updateMembershipRoleAction(data: { bandId: string; listType: "members" | "crew"; name: string; role: string }) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const name = (data.name || "").trim();
  if (!name || !data.bandId) return;
  const role = (data.role || "").trim();
  const column = data.listType === "crew" ? "crew" : "members";

  const { rows } = await pool.query(`select ${column} as list from bands where id=$1 and workspace_id=$2`, [data.bandId, workspaceId]);
  if (!rows.length) return;
  const list: Person[] = rows[0].list || [];
  const next = list.map((p) => (p.name === name ? { ...p, role } : p));
  await pool.query(`update bands set ${column}=$1 where id=$2 and workspace_id=$3`, [JSON.stringify(next), data.bandId, workspaceId]);

  revalidatePath("/grups");
}

// Instruments PROPIS d'una persona (person_profiles.instruments) —
// independents de cap grup: és "tot el que sap tocar", i a cada grup se'n
// tria un subconjunt (updateMembershipInstrumentsAction). Es poden editar
// en qualsevol moment, com el telèfon o el correu.
export async function getPersonInstrumentsAction(name: string): Promise<string[]> {
  const { workspaceId } = await requireManagerAction();
  const trimmed = (name || "").trim();
  if (!trimmed) return [];
  const row = (await db().query(
    "select instruments from person_profiles where workspace_id=$1 and lower(person_name)=lower($2)",
    [workspaceId, trimmed]
  )).rows[0];
  return row?.instruments || [];
}

export async function updatePersonInstrumentsAction(name: string, instruments: string[]) {
  const { workspaceId } = await requireManagerAction();
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const clean = (instruments || []).filter((i) => i && i.trim());
  const pool = db();
  const token = await getOrCreatePersonProfile(workspaceId, trimmed);
  await pool.query("update person_profiles set instruments=$1 where id=$2", [JSON.stringify(clean), token]);

  // Neteja: si un instrument surt de la llista pròpia, tampoc té sentit que
  // es quedi marcat com a tocat a cap grup.
  const allowed = new Set(clean.map((i) => i.toLowerCase()));
  const { rows } = await pool.query("select id, members, crew from bands where workspace_id=$1", [workspaceId]);
  for (const row of rows) {
    let changed = false;
    const prune = (list: Person[]) => list.map((p) => {
      if (p.name !== trimmed || !p.instruments?.length) return p;
      const kept = p.instruments.filter((i) => allowed.has(i.toLowerCase()));
      if (kept.length === p.instruments.length) return p;
      changed = true;
      return { ...p, instruments: kept };
    });
    const members = prune(row.members || []);
    const crew = prune(row.crew || []);
    if (changed) {
      await pool.query("update bands set members=$1, crew=$2 where id=$3", [JSON.stringify(members), JSON.stringify(crew), row.id]);
    }
  }

  revalidatePath("/grups");
  revalidatePath("/contactes");
}

// Quins dels instruments propis d'una persona toca en UN grup concret —
// sempre un subconjunt del que torna getPersonInstrumentsAction, però cada
// grup en pot triar un de diferent (p. ex. a un grup només hi toca la
// gralla, a un altre també el baix).
export async function updateMembershipInstrumentsAction(data: { bandId: string; listType: "members" | "crew"; name: string; instruments: string[] }) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const name = (data.name || "").trim();
  if (!name || !data.bandId) return;
  const instruments = (data.instruments || []).filter((i) => i && i.trim());
  const column = data.listType === "crew" ? "crew" : "members";

  const { rows } = await pool.query(`select ${column} as list from bands where id=$1 and workspace_id=$2`, [data.bandId, workspaceId]);
  if (!rows.length) return;
  const list: Person[] = rows[0].list || [];
  const next = list.map((p) => (p.name === name ? { ...p, instruments } : p));
  await pool.query(`update bands set ${column}=$1 where id=$2 and workspace_id=$3`, [JSON.stringify(next), data.bandId, workspaceId]);

  revalidatePath("/grups");
}

// Sense caràcters ambigus (0/O, 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export async function generateJoinCodeAction(bandId: string): Promise<string | null> {
  // Gestor, o membre amb el permís "Admin" en aquest grup.
  const { workspaceId } = await requireBandAccess(bandId, "admin");
  const pool = db();
  let joinCode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    joinCode = generateJoinCode();
    const clash = (await pool.query("select 1 from bands where join_code=$1", [joinCode])).rows[0];
    if (!clash) break;
  }
  const { rowCount } = await pool.query("update bands set join_code=$1, join_code_active=true where id=$2 and workspace_id=$3", [joinCode, bandId, workspaceId]);
  if (!rowCount) return null;
  revalidatePath("/grups");
  revalidatePath("/grup");
  revalidatePath("/artista/grup");
  return joinCode;
}

export async function revokeJoinCodeAction(bandId: string) {
  const { workspaceId } = await requireBandAccess(bandId, "admin");
  const pool = db();
  await pool.query("update bands set join_code_active=false where id=$1 and workspace_id=$2", [bandId, workspaceId]);
  revalidatePath("/grups");
  revalidatePath("/grup");
  revalidatePath("/artista/grup");
}

// Autocompletat de ciutat real via Photon (photon.komoot.io), la mateixa
// API gratuïta i sense clau que ja fa servir la resta de l'app (concerts,
// full de ruta...) — abans feia servir Google Places, que necessitava
// GOOGLE_MAPS_API_KEY i sense la clau no tornava mai cap resultat.
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

