import { db } from "./db";

// Esdeveniments de "no disponible" al perfil personal (vacances, etc.): no
// pertanyen a cap grup — són de la persona, i s'apliquen a qualsevol grup on
// toqui. Serveixen perquè un gestor/admin, en convocar-la a un bolo, vegi
// un avís si coincideix amb un dia marcat.

export type UnavailabilityEvent = {
  id: string;
  title: string;
  startDate: string; // "aaaa-mm-dd"
  startTime: string; // hora representativa del tram ("" si és tot el dia)
  endDate: string;
  endTime: string;
  allDay: boolean;
};

function fromRow(r: { id: string; title: string; start_date: string; start_time: string; end_date: string; end_time: string; all_day: boolean }): UnavailabilityEvent {
  return {
    id: r.id,
    title: r.title,
    startDate: typeof r.start_date === "string" ? r.start_date : new Date(r.start_date).toISOString().slice(0, 10),
    startTime: r.start_time || "",
    endDate: typeof r.end_date === "string" ? r.end_date : new Date(r.end_date).toISOString().slice(0, 10),
    endTime: r.end_time || "",
    allDay: !!r.all_day,
  };
}

export async function getUnavailability(clerkUserId: string): Promise<UnavailabilityEvent[]> {
  const { rows } = await db().query(
    `select id, title, to_char(start_date, 'YYYY-MM-DD') as start_date, start_time,
            to_char(end_date, 'YYYY-MM-DD') as end_date, end_time, all_day
     from unavailability_events where clerk_user_id=$1 order by start_date`,
    [clerkUserId]
  );
  return rows.map(fromRow);
}

export async function createUnavailabilityEvent(clerkUserId: string, input: {
  title: string; startDate: string; startTime: string; endDate: string; endTime: string; allDay: boolean;
}): Promise<UnavailabilityEvent> {
  const id = "u" + Date.now();
  const endDate = input.endDate && input.endDate >= input.startDate ? input.endDate : input.startDate;
  await db().query(
    `insert into unavailability_events (id, clerk_user_id, title, start_date, start_time, end_date, end_time, all_day)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, clerkUserId, input.title.trim() || "No disponible", input.startDate, input.allDay ? "" : input.startTime, endDate, input.allDay ? "" : input.endTime, input.allDay]
  );
  return { id, title: input.title.trim() || "No disponible", startDate: input.startDate, startTime: input.allDay ? "" : input.startTime, endDate, endTime: input.allDay ? "" : input.endTime, allDay: input.allDay };
}

export async function deleteUnavailabilityEvent(clerkUserId: string, id: string): Promise<void> {
  await db().query("delete from unavailability_events where id=$1 and clerk_user_id=$2", [id, clerkUserId]);
}

// Per a l'avís a la convocatòria d'un concert: dels comptes indicats
// (clerk_user_id de cada membre convocat que té usuari vinculat), quins
// tenen un esdeveniment de "no disponible" que cobreix aquesta data — i amb
// quin títol. Un sol dia pot tenir més d'un esdeveniment: es queda el
// primer que troba.
export async function getUnavailabilityTitlesOnDate(clerkUserIds: string[], date: string): Promise<Record<string, string>> {
  if (clerkUserIds.length === 0) return {};
  const { rows } = await db().query(
    `select clerk_user_id, title from unavailability_events
     where clerk_user_id = any($1::text[]) and start_date <= $2 and end_date >= $2
     order by created_at`,
    [clerkUserIds, date]
  );
  const out: Record<string, string> = {};
  rows.forEach((r) => { if (!out[r.clerk_user_id]) out[r.clerk_user_id] = r.title; });
  return out;
}
