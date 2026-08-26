import { db } from "./db";

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
  return d.toISOString().slice(0, 10);
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
