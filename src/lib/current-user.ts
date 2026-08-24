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
};

// cache(): una sola consulta per petició encara que la cridin layout i pàgina.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  const { rows } = await db().query(
    "select clerk_user_id, email, role, name, instruments, workspace_id from profiles where clerk_user_id = $1",
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
  };
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

// Per a pàgines d'artista.
export async function requireArtist(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  if (profile.role !== "artist") redirect("/resum");
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
  if (!profile || profile.role !== "artist") throw new Error("Sessió d'artista no vàlida");
  return profile;
}
