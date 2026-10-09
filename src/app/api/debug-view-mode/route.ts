import { NextResponse } from "next/server";
import { getProfile, hasBandMembership } from "@/lib/current-user";
import { db } from "@/lib/db";

// Endpoint temporal de diagnòstic per esbrinar per què el botó "Vista de
// músic" no surt en producció per a un compte concret — es treu un cop
// resolt. Només retorna dades del propi compte autenticat, cap secret.
export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "no session" }, { status: 401 });
  const isMusician = await hasBandMembership(profile.clerkUserId);
  const memberships = (await db().query(
    "select band_id, member_name from band_members where clerk_user_id=$1",
    [profile.clerkUserId]
  )).rows;
  return NextResponse.json({
    clerkUserId: profile.clerkUserId,
    email: profile.email,
    role: profile.role,
    workspaceId: profile.workspaceId,
    isMusician,
    memberships,
  });
}
