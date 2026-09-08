"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Contact } from "@/lib/types";
import { requireManagerAction } from "@/lib/current-user";
// La pujada/creació de contactes viu a contacts-data.ts, compartida amb el
// formulari públic de regidor (f/contact-actions.ts).
import { upsertContact, createRouteContact } from "@/lib/contacts-data";

function revalidateAll() {
  revalidatePath("/contactes");
  revalidatePath("/agencia");
}

export async function syncBandPeopleToContacts(workspaceId: string, people: { name: string; role: string; phone?: string; email?: string }[]) {
  for (const p of people) {
    await upsertContact(workspaceId, { name: p.name, kind: "grup", role: p.role, phone: p.phone, email: p.email });
  }
}

// Contacte creat a mà des del full de ruta d'un concert (botó "Crea «nom»
// com a contacte nou" del desplegable de Contactes): queda a Contactes de
// l'agència a l'instant i es torna per omplir la fila.
export async function createRouteSheetContactAction(input: { name: string; role: string; phone: string; company: string }): Promise<Contact | null> {
  const { workspaceId } = await requireManagerAction();
  const c = await createRouteContact(workspaceId, input);
  if (c) revalidateAll();
  return c;
}

// Passada completa: sincronitza tots els músics i crew de tots els grups del
// workspace, no només els que s'han desat des d'un formulari concret. Cobreix
// dades que ja existien abans que aquest sincronitzador es cridés puntualment
// (p. ex. grups creats per script o important d'una altra font). Es limita a
// una consulta de comptatge quan ja no hi ha res per posar al dia, perquè no
// pesi a cada visita a la pestanya un cop tot està sincronitzat.
export async function syncAllBandPeopleToContacts(workspaceId: string) {
  const pool = db();
  const { rows } = await pool.query("select members, crew from bands where workspace_id=$1", [workspaceId]);
  const people: { name: string; role: string; phone?: string; email?: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const p of [...(row.members || []), ...(row.crew || [])]) {
      const key = (p.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      people.push({ name: p.name, role: p.role, phone: p.phone, email: p.email });
    }
  }
  const { rows: countRows } = await pool.query(
    "select count(*) from contacts where workspace_id=$1 and kinds @> '[\"grup\"]'::jsonb", [workspaceId]
  );
  if (Number(countRows[0].count) >= people.length) return;
  await syncBandPeopleToContacts(workspaceId, people);
}

export async function syncRouteSheetContactsToContacts(workspaceId: string, contacts: { name: string; role: string; phone: string; company: string; email?: string }[]) {
  for (const c of contacts) {
    await upsertContact(workspaceId, { name: c.name, kind: "ruta", role: c.role, phone: c.phone, company: c.company, email: c.email });
  }
}

export async function syncClientToContacts(workspaceId: string, clientName: string, details?: { cif?: string; nom?: string; address?: string }) {
  await upsertContact(workspaceId, {
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

// ---------- Historial d'interaccions i seguiments ----------

export async function addInteractionAction(input: { contactId: string; date: string; note: string; nextDate: string | null; nextNote: string }): Promise<{ id: string }> {
  const { workspaceId } = await requireManagerAction();
  const id = "in" + Date.now();
  await db().query(
    `insert into contact_interactions (id, workspace_id, contact_id, idate, note, next_date, next_note)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, workspaceId, input.contactId, input.date, input.note || "", input.nextDate, input.nextNote || ""]
  );
  revalidatePath("/contactes");
  return { id };
}

export async function markInteractionDoneAction(id: string, done: boolean) {
  const { workspaceId } = await requireManagerAction();
  await db().query("update contact_interactions set done=$1 where id=$2 and workspace_id=$3", [done, id, workspaceId]);
  revalidatePath("/contactes");
}

export async function deleteInteractionAction(id: string) {
  const { workspaceId } = await requireManagerAction();
  await db().query("delete from contact_interactions where id=$1 and workspace_id=$2", [id, workspaceId]);
  revalidatePath("/contactes");
}
