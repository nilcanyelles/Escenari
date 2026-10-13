import { db } from "./db";
import { getProfile, type Profile } from "./current-user";
import { normalize } from "./text";
import { memberPerms, ALL_PERMS } from "./perms";
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
  const band = (await db().query("select workspace_id, members, crew from bands where id=$1", [bandId])).rows[0];
  if (!band) throw new Error("Grup no trobat");

  // Admin de l'agència (o gestor sense restricció de visibilitat): accés
  // total a qualsevol grup del workspace. Un gestor no-admin amb visibilitat
  // restringida a certs grups (assignedBandIds) només hi té aquest accés
  // total si el grup hi és — si no, cau a la comprovació de membre de grup
  // de sota (igual que un músic qualsevol, no per ser de l'agència).
  if (profile.role === "manager" && profile.workspaceId === band.workspace_id) {
    if (profile.viewAllGroups || profile.assignedBandIds.includes(bandId)) {
      return {
        profile, workspaceId: band.workspace_id, isManager: true, memberName: "",
        perms: { ...ALL_PERMS },
      };
    }
  }

  const link = (await db().query(
    "select member_name from band_members where band_id=$1 and clerk_user_id=$2",
    [bandId, profile.clerkUserId]
  )).rows[0];
  if (!link) throw new Error("Sense accés a aquest grup");

  // La persona pot ser músic o de l'equip tècnic (crew) — els permisos es
  // guarden a totes dues llistes (vegeu setMemberPermAction), així que cal
  // buscar-hi a totes dues; si no, un admin de la crew perdia el permís
  // aquí encara que la casella "Admin" el mostrés marcat.
  const me = (band.members || []).find((m: Person) => normalize(m.name) === normalize(link.member_name)) ||
    (band.crew || []).find((m: Person) => normalize(m.name) === normalize(link.member_name)) || null;
  const perms = memberPerms(me);
  if (perm && !perms[perm]) throw new Error("El gestor no t'ha donat aquest permís");
  return { profile, workspaceId: band.workspace_id, isManager: false, memberName: link.member_name, perms };
}

// Com requireBandAccess, però a partir d'un concert (resol el grup a qui
// pertany) — per a accions sobre UN concert concret (full de ruta,
// assistència, caixet, despeses...) on un admin del grup hi ha de poder fer
// exactament el mateix que el gestor.
export async function requireConcertAccess(concertId: string, perm?: keyof MemberPerms): Promise<BandAccess & { bandId: string }> {
  const row = (await db().query("select band_id from concerts where id=$1", [concertId])).rows[0];
  if (!row || !row.band_id) throw new Error("Concert no trobat");
  const access = await requireBandAccess(row.band_id, perm);
  return { ...access, bandId: row.band_id };
}
