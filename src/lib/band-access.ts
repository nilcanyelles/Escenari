import { db } from "./db";
import { getProfile, type Profile } from "./current-user";
import { normalize } from "./text";
import { memberPerms } from "./perms";
import type { MemberPerms, Person } from "./types";

export type BandAccess = {
  profile: Profile;
  workspaceId: string;
  isManager: boolean;
  memberName: string; // buit per al gestor
  perms: MemberPerms;
};

// Autorització dual per a accions dins d'un grup: el gestor del workspace ho
// pot tot; un artista membre del grup només allò que el gestor li ha permès.
export async function requireBandAccess(bandId: string, perm?: keyof MemberPerms): Promise<BandAccess> {
  const profile = await getProfile();
  if (!profile) throw new Error("Sessió no vàlida");
  const band = (await db().query("select workspace_id, members from bands where id=$1", [bandId])).rows[0];
  if (!band) throw new Error("Grup no trobat");

  if (profile.role === "manager" && profile.workspaceId === band.workspace_id) {
    return {
      profile, workspaceId: band.workspace_id, isManager: true, memberName: "",
      perms: { songs: true, riders: true, setlists: true, members: true, events: true },
    };
  }

  const link = (await db().query(
    "select member_name from band_members where band_id=$1 and clerk_user_id=$2",
    [bandId, profile.clerkUserId]
  )).rows[0];
  if (!link) throw new Error("Sense accés a aquest grup");

  const me = (band.members || []).find((m: Person) => normalize(m.name) === normalize(link.member_name)) || null;
  const perms = memberPerms(me);
  if (perm && !perms[perm]) throw new Error("El gestor no t'ha donat aquest permís");
  return { profile, workspaceId: band.workspace_id, isManager: false, memberName: link.member_name, perms };
}
