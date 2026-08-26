"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/current-user";

async function requireUser() {
  const profile = await getProfile();
  if (!profile) throw new Error("Sessió no vàlida");
  return profile;
}

export async function addPracticeGoalAction(name: string): Promise<{ id: string }> {
  const profile = await requireUser();
  const id = "pg" + Date.now();
  await db().query("insert into practice_goals (id, clerk_user_id, name) values ($1,$2,$3)", [id, profile.clerkUserId, (name || "").trim()]);
  revalidatePath("/practica");
  return { id };
}

export async function deletePracticeGoalAction(id: string) {
  const profile = await requireUser();
  await db().query("delete from practice_goals where id=$1 and clerk_user_id=$2", [id, profile.clerkUserId]);
  revalidatePath("/practica");
}

export async function logPracticeAction(input: { goalId: string | null; date: string; minutes: number; notes: string }): Promise<{ id: string }> {
  const profile = await requireUser();
  const id = "pe" + Date.now();
  await db().query(
    "insert into practice_entries (id, clerk_user_id, goal_id, pdate, minutes, notes) values ($1,$2,$3,$4,$5,$6)",
    [id, profile.clerkUserId, input.goalId, input.date, Math.max(0, Math.round(input.minutes) || 0), input.notes || ""]
  );
  revalidatePath("/practica");
  return { id };
}

export async function deletePracticeEntryAction(id: string) {
  const profile = await requireUser();
  await db().query("delete from practice_entries where id=$1 and clerk_user_id=$2", [id, profile.clerkUserId]);
  revalidatePath("/practica");
}
