import { db } from "./db";

export type PracticeGoal = { id: string; name: string };
export type PracticeEntry = { id: string; goalId: string | null; date: string; minutes: number; notes: string };

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  // Un Date d'una columna "date" de Postgres representa mitjanit LOCAL
  // d'aquell dia — amb toISOString() (que sempre passa a UTC) es podia
  // desplaçar un dia enrere segons la zona horària del servidor.
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export async function getPracticeData(clerkUserId: string): Promise<{ goals: PracticeGoal[]; entries: PracticeEntry[] }> {
  const [goals, entries] = await Promise.all([
    db().query("select id, name from practice_goals where clerk_user_id=$1 order by created_at", [clerkUserId]),
    db().query("select id, goal_id, pdate, minutes, notes from practice_entries where clerk_user_id=$1 order by pdate desc limit 400", [clerkUserId]),
  ]);
  return {
    goals: goals.rows.map((r) => ({ id: r.id, name: r.name })),
    entries: entries.rows.map((r) => ({ id: r.id, goalId: r.goal_id, date: toDateStr(r.pdate), minutes: r.minutes, notes: r.notes })),
  };
}
