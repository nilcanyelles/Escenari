"use server";

import { Pool } from "@neondatabase/serverless";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ContactKind } from "@/lib/types";
import { requireManagerAction } from "@/lib/current-user";

function revalidateAll() {
  revalidatePath("/contactes");
}

type SyncFields = {
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
async function upsertContact(pool: Pool, workspaceId: string, f: SyncFields) {
  const name = (f.name || "").trim();
  if (!name) return;
  const id = "ct" + Date.now() + Math.floor(Math.random() * 1000);
  await pool.query(
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

export async function syncBandPeopleToContacts(workspaceId: string, people: { name: string; role: string; phone?: string; email?: string }[]) {
  const pool = db();
  for (const p of people) {
    await upsertContact(pool, workspaceId, { name: p.name, kind: "grup", role: p.role, phone: p.phone, email: p.email });
  }
}

export async function syncRouteSheetContactsToContacts(workspaceId: string, contacts: { name: string; role: string; phone: string; company: string }[]) {
  const pool = db();
  for (const c of contacts) {
    await upsertContact(pool, workspaceId, { name: c.name, kind: "ruta", role: c.role, phone: c.phone, company: c.company });
  }
}

export async function syncClientToContacts(workspaceId: string, clientName: string, details?: { cif?: string; nom?: string; address?: string }) {
  const pool = db();
  await upsertContact(pool, workspaceId, {
    name: clientName, kind: "empresa",
    company: details?.nom || clientName, cif: details?.cif, address: details?.address,
  });
}

export type SaveContactInput = {
  id: string | null;
  name: string;
  role: string;
  phone: string;
  email: string;
  company: string;
  cif: string;
  address: string;
  iban: string;
  notes: string;
};

export async function saveContactAction(data: SaveContactInput) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const name = (data.name || "").trim();
  if (!name) return;

  if (data.id) {
    await pool.query(
      `update contacts set name=$1, role=$2, phone=$3, email=$4, company=$5, cif=$6, address=$7, iban=$8, notes=$9
       where id=$10 and workspace_id=$11`,
      [name, data.role.trim(), data.phone.trim(), data.email.trim(), data.company.trim(), data.cif.trim(), data.address.trim(), data.iban.trim(), data.notes.trim(), data.id, workspaceId]
    );
  } else {
    const id = "ct" + Date.now();
    await pool.query(
      `insert into contacts (id, name, kinds, role, phone, email, company, cif, address, iban, notes, workspace_id)
       values ($1,$2,'[]'::jsonb,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (workspace_id, lower(name)) do update set
         role=excluded.role, phone=excluded.phone, email=excluded.email, company=excluded.company,
         cif=excluded.cif, address=excluded.address, iban=excluded.iban, notes=excluded.notes`,
      [id, name, data.role.trim(), data.phone.trim(), data.email.trim(), data.company.trim(), data.cif.trim(), data.address.trim(), data.iban.trim(), data.notes.trim(), workspaceId]
    );
  }
  revalidateAll();
}

export async function deleteContactAction(id: string) {
  const { workspaceId } = await requireManagerAction();
  await db().query("delete from contacts where id=$1 and workspace_id=$2", [id, workspaceId]);
  revalidateAll();
}
