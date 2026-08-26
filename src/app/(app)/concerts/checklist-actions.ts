"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";

export async function createChecklistAction(concertId: string, name: string): Promise<{ id: string }> {
  const { workspaceId } = await requireManagerAction();
  const id = "cl" + Date.now();
  await db().query(
    "insert into checklists (id, workspace_id, concert_id, name) values ($1,$2,$3,$4)",
    [id, workspaceId, concertId, (name || "Checklist").trim()]
  );
  revalidatePath(`/concerts/${concertId}`);
  return { id };
}

export async function deleteChecklistAction(checklistId: string) {
  const { workspaceId } = await requireManagerAction();
  const cl = (await db().query("select concert_id from checklists where id=$1 and workspace_id=$2", [checklistId, workspaceId])).rows[0];
  await db().query("delete from checklists where id=$1 and workspace_id=$2", [checklistId, workspaceId]);
  if (cl?.concert_id) revalidatePath(`/concerts/${cl.concert_id}`);
}

async function ownChecklist(checklistId: string, workspaceId: string) {
  const cl = (await db().query("select * from checklists where id=$1 and workspace_id=$2", [checklistId, workspaceId])).rows[0];
  if (!cl) throw new Error("Checklist no trobada");
  return cl;
}

export async function addChecklistItemAction(checklistId: string, parentId: string | null, text: string): Promise<{ id: string }> {
  const { workspaceId } = await requireManagerAction();
  const cl = await ownChecklist(checklistId, workspaceId);
  const id = "ci" + Date.now() + Math.floor(Math.random() * 1000);
  const max = (await db().query("select coalesce(max(position),0)+1 as p from checklist_items where checklist_id=$1", [checklistId])).rows[0].p;
  await db().query(
    "insert into checklist_items (id, checklist_id, parent_id, text, position) values ($1,$2,$3,$4,$5)",
    [id, checklistId, parentId, (text || "").trim(), max]
  );
  if (cl.concert_id) revalidatePath(`/concerts/${cl.concert_id}`);
  return { id };
}

export async function updateChecklistItemAction(checklistId: string, itemId: string, patch: { text?: string; assignee?: string; due?: string | null; status?: "pendent" | "en curs" | "fet" }) {
  const { workspaceId } = await requireManagerAction();
  const cl = await ownChecklist(checklistId, workspaceId);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.text !== undefined) { params.push(patch.text); sets.push(`text=$${params.length}`); }
  if (patch.assignee !== undefined) { params.push(patch.assignee); sets.push(`assignee=$${params.length}`); }
  if (patch.due !== undefined) { params.push(patch.due); sets.push(`due=$${params.length}`); }
  if (patch.status !== undefined) { params.push(patch.status); sets.push(`status=$${params.length}`); }
  if (!sets.length) return;
  params.push(itemId, checklistId);
  await db().query(
    `update checklist_items set ${sets.join(", ")} where id=$${params.length - 1} and checklist_id=$${params.length}`,
    params
  );
  if (cl.concert_id) revalidatePath(`/concerts/${cl.concert_id}`);
}

export async function deleteChecklistItemAction(checklistId: string, itemId: string) {
  const { workspaceId } = await requireManagerAction();
  const cl = await ownChecklist(checklistId, workspaceId);
  await db().query("delete from checklist_items where id=$1 and checklist_id=$2", [itemId, checklistId]);
  if (cl.concert_id) revalidatePath(`/concerts/${cl.concert_id}`);
}

// Copia una checklist d'un altre concert (plantilla reutilitzable) amb tots
// els estats reiniciats.
export async function copyChecklistAction(sourceChecklistId: string, targetConcertId: string): Promise<{ id: string }> {
  const { workspaceId } = await requireManagerAction();
  const src = await ownChecklist(sourceChecklistId, workspaceId);
  const items = (await db().query("select * from checklist_items where checklist_id=$1 order by position", [sourceChecklistId])).rows;
  const id = "cl" + Date.now();
  await db().query(
    "insert into checklists (id, workspace_id, concert_id, name) values ($1,$2,$3,$4)",
    [id, workspaceId, targetConcertId, src.name]
  );
  const idMap: Record<string, string> = {};
  for (const it of items) {
    const nid = "ci" + Date.now() + Math.floor(Math.random() * 100000);
    idMap[it.id] = nid;
    await db().query(
      "insert into checklist_items (id, checklist_id, parent_id, text, assignee, position) values ($1,$2,$3,$4,$5,$6)",
      [nid, id, it.parent_id ? idMap[it.parent_id] || null : null, it.text, it.assignee, it.position]
    );
  }
  revalidatePath(`/concerts/${targetConcertId}`);
  return { id };
}

// Llista de checklists d'altres concerts, per copiar-les com a plantilles.
export async function listChecklistTemplatesAction(excludeConcertId: string): Promise<{ id: string; name: string; concertLabel: string }[]> {
  const { workspaceId } = await requireManagerAction();
  const { rows } = await db().query(
    `select cl.id, cl.name, c.date, c.city from checklists cl
     left join concerts c on c.id = cl.concert_id
     where cl.workspace_id=$1 and (cl.concert_id is null or cl.concert_id <> $2)
     order by cl.created_at desc limit 30`,
    [workspaceId, excludeConcertId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    concertLabel: r.date ? `${String(r.date).slice(0, 10)}${r.city ? " · " + r.city : ""}` : "—",
  }));
}
