import { db } from "./db";

export type ChecklistItem = {
  id: string;
  parentId: string | null;
  text: string;
  assignee: string;
  due: string | null;
  status: "pendent" | "en curs" | "fet";
  position: number;
};

export type Checklist = {
  id: string;
  concertId: string | null;
  name: string;
  items: ChecklistItem[];
};

function toDateStr(d: Date | string | null): string | null {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export async function getChecklists(workspaceId: string, concertId?: string): Promise<Checklist[]> {
  const params: unknown[] = [workspaceId];
  let cond = "cl.workspace_id=$1";
  if (concertId) { params.push(concertId); cond += " and cl.concert_id=$2"; }
  const { rows } = await db().query(
    `select cl.*, coalesce(json_agg(json_build_object(
        'id', it.id, 'parentId', it.parent_id, 'text', it.text, 'assignee', it.assignee,
        'due', it.due, 'status', it.status, 'position', it.position
      ) order by it.position, it.id) filter (where it.id is not null), '[]') as item_list
     from checklists cl
     left join checklist_items it on it.checklist_id = cl.id
     where ${cond}
     group by cl.id
     order by cl.created_at`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    concertId: r.concert_id,
    name: r.name,
    items: (r.item_list || []).map((it: Record<string, unknown>) => ({
      id: it.id,
      parentId: it.parentId || null,
      text: it.text || "",
      assignee: it.assignee || "",
      due: toDateStr(it.due as string | null),
      status: it.status,
      position: it.position,
    })) as ChecklistItem[],
  }));
}

const DEFAULT_CHECKLIST_NAME = "Rider";
const DEFAULT_CHECKLIST_ITEMS = ["Enviar rider", "Rider aprovat?"];

// Cada concert ha de tenir sempre la checklist de sèrie del rider — si
// encara no en té cap (concert nou, o un de vell que encara no la tenia),
// es crea aquí mateix en carregar la pàgina, amb els seus dos ítems fixos,
// assignats per defecte al gestor.
export async function ensureDefaultChecklist(workspaceId: string, concertId: string, managerName: string): Promise<void> {
  const pool = db();
  const existing = (await pool.query(
    "select 1 from checklists where workspace_id=$1 and concert_id=$2 and name=$3",
    [workspaceId, concertId, DEFAULT_CHECKLIST_NAME]
  )).rows[0];
  if (existing) return;
  const id = "cl" + Date.now();
  await pool.query(
    "insert into checklists (id, workspace_id, concert_id, name) values ($1,$2,$3,$4)",
    [id, workspaceId, concertId, DEFAULT_CHECKLIST_NAME]
  );
  for (let i = 0; i < DEFAULT_CHECKLIST_ITEMS.length; i++) {
    const itemId = "ci" + Date.now() + i;
    await pool.query(
      "insert into checklist_items (id, checklist_id, parent_id, text, assignee, position) values ($1,$2,null,$3,$4,$5)",
      [itemId, id, DEFAULT_CHECKLIST_ITEMS[i], managerName, i]
    );
  }
}
