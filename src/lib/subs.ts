import { db } from "./db";

// Suplències: disponibilitat diària dels músics i la borsa de candidats que
// els gestors poden consultar.

export type SubCandidate = {
  profileId: string;          // token del perfil públic (/p/token)
  clerkUserId: string | null;
  name: string;
  instruments: string[];
  photoFileId: string | null;
  bio: string;
  // Només si el músic ha marcat "Perfil visible": telèfon, correu, Instagram.
  contactVisible: boolean;
  phone: string;
  email: string;
  igHandle: string;
  bands: string[];
  // Propers dies marcats en verd (aaaa-mm-dd), per ordre.
  availableDays: string[];
};

// Dies marcats pel músic (true = disponible, false = no disponible).
export async function getAvailability(clerkUserId: string): Promise<Record<string, boolean>> {
  const { rows } = await db().query(
    "select to_char(day, 'YYYY-MM-DD') as day, available from subs_availability where clerk_user_id=$1",
    [clerkUserId]
  );
  const out: Record<string, boolean> = {};
  rows.forEach((r) => { out[r.day] = !!r.available; });
  return out;
}

// Tots els músics que s'han declarat disponibles per a suplències (a
// qualsevol workspace d'Escenari), un per compte.
export async function getSubCandidates(): Promise<SubCandidate[]> {
  const pool = db();
  const { rows } = await pool.query(
    `select pp.id, pp.clerk_user_id, pp.person_name, pp.photo_file_id, pp.bio, pp.phone, pp.contact_email,
            pp.ig_handle, pp.profile_public, p.instruments, p.email as account_email
     from person_profiles pp
     left join profiles p on p.clerk_user_id = pp.clerk_user_id
     where pp.open_to_subs
     order by lower(pp.person_name), pp.photo_file_id nulls last`
  );
  // Una persona té un perfil per workspace: es fusionen pel compte.
  const byKey = new Map<string, SubCandidate>();
  rows.forEach((r) => {
    const key = r.clerk_user_id || r.id;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.photoFileId && r.photo_file_id) existing.photoFileId = r.photo_file_id;
      if (!existing.bio && r.bio) existing.bio = r.bio;
      if (!existing.phone && r.phone) existing.phone = r.phone;
      if (!existing.igHandle && r.ig_handle) existing.igHandle = r.ig_handle;
      return;
    }
    byKey.set(key, {
      profileId: r.id,
      clerkUserId: r.clerk_user_id,
      name: r.person_name,
      instruments: r.instruments || [],
      photoFileId: r.photo_file_id,
      bio: r.bio || "",
      contactVisible: !!r.profile_public,
      phone: r.phone || "",
      email: r.contact_email || r.account_email || "",
      igHandle: r.ig_handle || "",
      bands: [],
      availableDays: [],
    });
  });
  const list = Array.from(byKey.values());
  const userIds = list.map((c) => c.clerkUserId).filter((v): v is string => !!v);
  if (userIds.length) {
    const [bandRows, availRows] = await Promise.all([
      pool.query(
        `select bm.clerk_user_id, b.name from band_members bm join bands b on b.id = bm.band_id
         where bm.clerk_user_id = any($1) order by b.name`,
        [userIds]
      ),
      pool.query(
        `select clerk_user_id, to_char(day, 'YYYY-MM-DD') as day from subs_availability
         where clerk_user_id = any($1) and available and day >= current_date and day < current_date + 90
         order by day`,
        [userIds]
      ),
    ]);
    const byUser = new Map(list.filter((c) => c.clerkUserId).map((c) => [c.clerkUserId as string, c]));
    bandRows.rows.forEach((r) => { const c = byUser.get(r.clerk_user_id); if (c && !c.bands.includes(r.name)) c.bands.push(r.name); });
    availRows.rows.forEach((r) => { byUser.get(r.clerk_user_id)?.availableDays.push(r.day); });
  }
  // Sense contacte visible, no s'exposa res de contacte.
  list.forEach((c) => { if (!c.contactVisible) { c.phone = ""; c.email = ""; c.igHandle = ""; } });
  return list;
}
