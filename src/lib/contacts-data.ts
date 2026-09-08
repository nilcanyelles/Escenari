import { db } from "./db";
import type { Contact, ContactKind } from "./types";

export type ContactInteraction = {
  id: string;
  contactId: string;
  date: string;
  note: string;
  nextDate: string | null;
  nextNote: string;
  done: boolean;
};

function toDateStr(d: Date | string | null): string | null {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  // Un Date d'una columna "date" de Postgres representa mitjanit LOCAL
  // d'aquell dia — amb toISOString() (que sempre passa a UTC) es podia
  // desplaçar un dia enrere segons la zona horària del servidor.
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export async function getContactInteractions(workspaceId: string): Promise<ContactInteraction[]> {
  const { rows } = await db().query(
    "select * from contact_interactions where workspace_id=$1 order by idate desc, created_at desc limit 500",
    [workspaceId]
  );
  return rows.map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    date: toDateStr(r.idate)!,
    note: r.note,
    nextDate: toDateStr(r.next_date),
    nextNote: r.next_note,
    done: r.done,
  }));
}

// ---------- Contactes: pujada, cerca i creació compartides ----------
// Ho fan servir tant les accions del gestor (contactes/actions.ts) com les
// del formulari públic de regidor (f/contact-actions.ts), perquè el que es
// crea des d'un full de ruta — de dins de l'app o des de l'enllaç — acabi
// sempre al mateix magatzem de Contactes de l'agència.

export type ContactSyncFields = {
  name: string;
  kind: ContactKind;
  role?: string;
  phone?: string;
  email?: string;
  company?: string;
  cif?: string;
  address?: string;
  iban?: string;
};

// Puja/actualitza un contacte pel seu nom (sense distingir maj/min): si ja
// existeix, només omple els camps que encara estan buits — mai trepitja una
// dada que s'hagi editat directament a la pestanya de Contactes — i afegeix
// el nou "kind" a la llista si encara no hi era.
export async function upsertContact(workspaceId: string, f: ContactSyncFields): Promise<void> {
  const name = (f.name || "").trim();
  if (!name) return;
  const id = "ct" + Date.now() + Math.floor(Math.random() * 1000);
  await db().query(
    `insert into contacts (id, name, kinds, role, phone, email, company, cif, address, iban, workspace_id)
     values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (workspace_id, lower(name)) do update set
       kinds = (select coalesce(jsonb_agg(distinct k), '[]'::jsonb) from jsonb_array_elements_text(contacts.kinds || excluded.kinds) as k),
       role = case when contacts.role = '' then excluded.role else contacts.role end,
       phone = case when contacts.phone = '' then excluded.phone else contacts.phone end,
       email = case when contacts.email = '' then excluded.email else contacts.email end,
       company = case when contacts.company = '' then excluded.company else contacts.company end,
       cif = case when contacts.cif = '' then excluded.cif else contacts.cif end,
       address = case when contacts.address = '' then excluded.address else contacts.address end,
       iban = case when contacts.iban = '' then excluded.iban else contacts.iban end`,
    [
      id, name, JSON.stringify([f.kind]), f.role || "", f.phone || "", f.email || "",
      f.company || "", f.cif || "", f.address || "", f.iban || "", workspaceId,
    ]
  );
}

export function mapContactRow(r: Record<string, unknown>): Contact {
  return {
    id: r.id as string,
    name: (r.name as string) || "",
    kinds: (r.kinds as ContactKind[]) || [],
    role: (r.role as string) || "",
    phone: (r.phone as string) || "",
    email: (r.email as string) || "",
    company: (r.company as string) || "",
    cif: (r.cif as string) || "",
    address: (r.address as string) || "",
    iban: (r.iban as string) || "",
    notes: (r.notes as string) || "",
  };
}

// Cerca de contactes pel nom o l'empresa (mínim 2 lletres), opcionalment
// només d'uns "kinds" (p. ex. només els del full de ruta).
export async function searchContacts(workspaceId: string, q: string, opts?: { kinds?: ContactKind[]; limit?: number }): Promise<Contact[]> {
  const s = (q || "").trim();
  if (s.length < 2) return [];
  const limit = Math.min(Math.max(opts?.limit || 8, 1), 50);
  const params: unknown[] = [workspaceId, `%${s}%`];
  let kindsCond = "";
  if (opts?.kinds && opts.kinds.length) {
    params.push(opts.kinds);
    kindsCond = ` and kinds ?| $${params.length}::text[]`;
  }
  const { rows } = await db().query(
    `select * from contacts where workspace_id=$1 and (name ilike $2 or company ilike $2)${kindsCond} order by lower(name) limit ${limit}`,
    params
  );
  return rows.map(mapContactRow);
}

// Contacte creat des del full de ruta (normal o públic): la mateixa pujada
// que la sincronització automàtica (kind "ruta"), però a l'instant i
// tornant la fila per poder-la triar de seguida.
export async function createRouteContact(workspaceId: string, input: { name: string; role?: string; phone?: string; company?: string; email?: string }): Promise<Contact | null> {
  const name = (input.name || "").trim();
  if (!name) return null;
  await upsertContact(workspaceId, { name, kind: "ruta", role: input.role, phone: input.phone, company: input.company, email: input.email });
  const row = (await db().query("select * from contacts where workspace_id=$1 and lower(name)=lower($2)", [workspaceId, name])).rows[0];
  return row ? mapContactRow(row) : null;
}

// Només el que pot veure qui omple el formulari públic: nom, càrrec,
// empresa i telèfon — mai correu, CIF, IBAN, adreça ni notes.
export function publicContactFields(c: Contact): Contact {
  return { ...c, email: "", cif: "", address: "", iban: "", notes: "" };
}
