"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreatePersonProfile } from "@/lib/person-profile";

// Entrar a una agència des del seu enllaç d'invitació (/j/token): es crea
// el perfil de gestor dins del workspace amb els permisos de la invitació.
export async function acceptAgencyInvitationAction(token: string, input: { name: string; roleLabel: string }): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Cal iniciar sessió." };
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
  const pool = db();
  const inv = (await pool.query("select * from agency_invitations where id=$1", [token])).rows[0];
  if (!inv) return { ok: false, error: "Aquest enllaç no és vàlid." };
  if (inv.status !== "pendent") return { ok: false, error: "Aquesta invitació ja s'ha fet servir." };

  const existing = (await pool.query("select role, workspace_id from profiles where clerk_user_id=$1", [userId])).rows[0];
  if (existing) {
    if (existing.role === "manager" && existing.workspace_id === inv.workspace_id) {
      await pool.query("update agency_invitations set status='acceptada', accepted_by=$1 where id=$2", [userId, token]);
      return { ok: true };
    }
    return {
      ok: false,
      error: existing.role === "artist"
        ? "Aquest compte ja és de músic: per entrar a l'agència, entra amb un altre compte."
        : "Aquest compte ja pertany a una altra agència.",
    };
  }

  const clerkName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "";
  const name = (input.name || "").trim() || inv.name || clerkName;
  if (!name) return { ok: false, error: "Cal un nom." };
  const roleLabel = (input.roleLabel || "").trim() || inv.role_label || "Mànager";

  await pool.query(
    `insert into profiles (clerk_user_id, email, role, name, workspace_id, agency_role, agency_owner, can_create_groups, view_all_groups, assigned_band_ids)
     values ($1, $2, 'manager', $3, $4, $5, false, $6, $7, $8)`,
    [userId, email, name, inv.workspace_id, roleLabel, inv.can_create_groups !== false, inv.view_all_groups !== false, JSON.stringify(inv.assigned_band_ids || [])]
  );
  const ppToken = await getOrCreatePersonProfile(inv.workspace_id, name);
  await pool.query("update person_profiles set clerk_user_id=$1, role_label=$2 where id=$3", [userId, roleLabel, ppToken]);
  await pool.query("update agency_invitations set status='acceptada', accepted_by=$1 where id=$2", [userId, token]);
  return { ok: true };
}
