import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "./db";

export type Profile = {
  clerkUserId: string;
  email: string;
  role: "manager" | "artist";
  name: string;
  instruments: string[];
  workspaceId: string | null;
  // Membre d'agència (gestors): càrrec, si mana a l'agència i permisos.
  agencyRole: string;
  agencyOwner: boolean;
  canCreateGroups: boolean;
  viewAllGroups: boolean;
  assignedBandIds: string[];
};

// cache(): una sola consulta per petició encara que la cridin layout i pàgina.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  const { rows } = await db().query(
    `select clerk_user_id, email, role, name, instruments, workspace_id,
            agency_role, agency_owner, can_create_groups, view_all_groups, assigned_band_ids
     from profiles where clerk_user_id = $1`,
    [userId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    clerkUserId: r.clerk_user_id,
    email: r.email,
    role: r.role,
    name: r.name,
    instruments: r.instruments || [],
    workspaceId: r.workspace_id,
    agencyRole: r.agency_role || "",
    agencyOwner: !!r.agency_owner,
    canCreateGroups: r.agency_owner || r.can_create_groups !== false,
    viewAllGroups: r.agency_owner || r.view_all_groups !== false,
    assignedBandIds: r.assigned_band_ids || [],
  };
});

// Grups que el gestor de la petició pot veure: null = tots (mana a
// l'agència, veu tots els grups, o no és gestor); si no, només els que té
// assignats. Ho apliquen getBands/getConcerts/getInvoices.
export const visibleBandIds = cache(async (): Promise<Set<string> | null> => {
  const p = await getProfile();
  if (!p || p.role !== "manager" || p.viewAllGroups) return null;
  return new Set(p.assignedBandIds);
});

// Email principal del compte de Clerk (per casar invitacions).
export const getClerkEmail = cache(async (): Promise<string> => {
  const user = await currentUser();
  return user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
});

// Per a pàgines de gestor: redirigeix qui no toca (sense perfil → alta;
// artista → la seva àrea).
export async function requireManager(): Promise<Profile & { workspaceId: string }> {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  if (profile.role !== "manager" || !profile.workspaceId) redirect("/artista");
  return profile as Profile & { workspaceId: string };
}

// Un gestor que també toca (ha creat el seu grup com a músic, o s'hi ha
// afegit com a músic) entra a l'àrea de músic igual que un artista.
export const hasBandMembership = cache(async (clerkUserId: string): Promise<boolean> => {
  const { rows } = await db().query("select 1 from band_members where clerk_user_id=$1 limit 1", [clerkUserId]);
  return rows.length > 0;
});

// Per a pàgines d'artista.
export async function requireArtist(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  if (profile.role !== "artist" && !(await hasBandMembership(profile.clerkUserId))) redirect("/resum");
  return profile;
}

// Per a server actions: mai redirigeix, llança error (una action amb sessió
// invàlida no ha d'escriure res).
export async function requireManagerAction(): Promise<Profile & { workspaceId: string }> {
  const profile = await getProfile();
  if (!profile || profile.role !== "manager" || !profile.workspaceId) {
    throw new Error("Sessió de gestor no vàlida");
  }
  return profile as Profile & { workspaceId: string };
}

export async function requireArtistAction(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) throw new Error("Sessió d'artista no vàlida");
  if (profile.role !== "artist" && !(await hasBandMembership(profile.clerkUserId))) throw new Error("Sessió d'artista no vàlida");
  return profile;
}
