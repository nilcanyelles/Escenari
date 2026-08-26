import { db } from "./db";

export type PracticeGoal = { id: string; name: string };
export type PracticeEntry = { id: string; goalId: string | null; date: string; minutes: number; notes: string };

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
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
