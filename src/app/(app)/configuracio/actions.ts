"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
import { requireFeature, groupCap } from "@/lib/billing";
import { createAgencyInvitations, type AgencyInviteInput } from "@/lib/agency";
import { createBandWithPeople, type CreateGroupInput, type CreateGroupResult } from "@/lib/group-create";
import { syncBandPeopleToContacts } from "@/app/(app)/contactes/actions";

// Configuració de l'agència: membres, permisos, invitacions i alta de grups.

async function requireOwner() {
  const p = await requireManagerAction();
  if (!p.agencyOwner) throw new Error("Només qui mana a l'agència pot fer això");
  return p;
}

function revalidateAll() {
  revalidatePath("/configuracio");
  revalidatePath("/grup");
  revalidatePath("/agenda");
  revalidatePath("/concerts");
  revalidatePath("/resum");
}

export async function inviteAgencyMembersAction(list: AgencyInviteInput[]): Promise<{ id: string; name: string; email: string; url: string }[]> {
  const p = await requireOwner();
  await requireFeature(p.workspaceId, "agency");
  const out = await createAgencyInvitations(p.workspaceId, p.name, list);
  revalidatePath("/configuracio");
  return out;
}

export async function revokeAgencyInvitationAction(id: string) {
  const p = await requireOwner();
  await db().query("update agency_invitations set status='revocada' where id=$1 and workspace_id=$2", [id, p.workspaceId]);
  revalidatePath("/configuracio");
}

export type AgencyMemberPatch = {
  agencyRole?: string;
  agencyOwner?: boolean;
  canCreateGroups?: boolean;
  viewAllGroups?: boolean;
  assignedBandIds?: string[];
};

// Permisos d'un membre de l'agència. Ningú es pot treure a si mateix el
// comandament si és l'únic que en té.
export async function setAgencyMemberAction(clerkUserId: string, patch: AgencyMemberPatch) {
  const p = await requireOwner();
  const pool = db();
  const target = (await pool.query(
    "select agency_owner from profiles where clerk_user_id=$1 and workspace_id=$2 and role='manager'",
    [clerkUserId, p.workspaceId]
  )).rows[0];
  if (!target) throw new Error("Membre no trobat");
  if (patch.agencyOwner === false && target.agency_owner) {
    const owners = (await pool.query("select count(*)::int as n from profiles where workspace_id=$1 and role='manager' and agency_owner", [p.workspaceId])).rows[0].n;
    if (owners <= 1) throw new Error("L'agència ha de tenir algú que hi mani");
  }
  await pool.query(
    `update profiles set
       agency_role = coalesce($1, agency_role),
       agency_owner = coalesce($2, agency_owner),
       can_create_groups = coalesce($3, can_create_groups),
       view_all_groups = coalesce($4, view_all_groups),
       assigned_band_ids = coalesce($5, assigned_band_ids)
     where clerk_user_id=$6 and workspace_id=$7`,
    [patch.agencyRole ?? null, patch.agencyOwner ?? null, patch.canCreateGroups ?? null, patch.viewAllGroups ?? null,
      patch.assignedBandIds ? JSON.stringify(patch.assignedBandIds) : null, clerkUserId, p.workspaceId]
  );
  revalidateAll();
}

// Treu un membre de l'agència: el seu compte torna a l'alta (no es pot
// treure qui hi mana ni un mateix).
export async function removeAgencyMemberAction(clerkUserId: string) {
  const p = await requireOwner();
  if (clerkUserId === p.clerkUserId) throw new Error("No et pots treure a tu mateix");
  await db().query(
    "delete from profiles where clerk_user_id=$1 and workspace_id=$2 and role='manager' and not agency_owner",
    [clerkUserId, p.workspaceId]
  );
  revalidateAll();
}

// ---------- Alta d'un grup amb el seu equip ----------

export type { CreateGroupPerson, CreateGroupInput, CreateGroupResult } from "@/lib/group-create";

// Crea el grup amb els músics i l'equip tècnic ja a dins i una invitació
// amb enllaç per a cada persona: en entrar-hi reclamen el seu perfil (amb
// correu també se'ls envia, si el correu està configurat). Amb `self`, el
// gestor també hi entra com a músic.
export async function createGroupAction(input: CreateGroupInput, self?: { instruments: string[] } | null): Promise<CreateGroupResult> {
  const p = await requireManagerAction();
  if (!p.canCreateGroups) throw new Error("No tens permís per crear grups");
  const cap = await groupCap(p.workspaceId);
  if (cap.reached) throw new Error(`El teu pla permet ${cap.cap} ${cap.cap === 1 ? "grup" : "grups"}. Passa a un pla d'Agència per crear-ne més.`);
  const res = await createBandWithPeople({
    workspaceId: p.workspaceId,
    creatorName: p.name,
    input,
    self: self ? { clerkUserId: p.clerkUserId, name: p.name, email: p.email, instruments: (self.instruments || []).filter(Boolean) } : null,
  });
  // Qui només veu els grups assignats ha de veure el que acaba de crear.
  if (!p.viewAllGroups) {
    await db().query(
      "update profiles set assigned_band_ids = coalesce(assigned_band_ids, '[]'::jsonb) || to_jsonb($1::text) where clerk_user_id=$2",
      [res.bandId, p.clerkUserId]
    );
  }
  await syncBandPeopleToContacts(p.workspaceId, res.members.concat(res.crew));
  revalidateAll();
  revalidatePath("/contactes");
  revalidatePath("/artista");
  return { bandId: res.bandId, invites: res.invites };
}
