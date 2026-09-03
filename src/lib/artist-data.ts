import { db } from "./db";
import { normalizeContact } from "./types";

export type ArtistBand = {
  id: string;
  name: string;
  city: string;
  logo: string;
  color1: string;
  color2: string;
  memberCount: number;
  memberName: string;
};

export type ArtistGig = {
  id: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  festaEntitat: string;
  status: "confirmat" | "pendent" | "cancel·lat";
  bandId: string;
  bandName: string;
  bandLogo: string;
  color1: string;
  color2: string;
  myAttendance: "yes" | "no" | null;
  mySubstitute: string;
  myNoSubstitute: boolean;
  bandBackups: { name: string; instruments: string[] }[];
  amount: number | null; // només si el gestor ha activat "els membres veuen el caixet"
};

export type PendingInvitation = {
  id: string;
  bandId: string;
  bandName: string;
  bandLogo: string;
  color1: string;
  color2: string;
  managerName: string;
};

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export async function getArtistBands(clerkUserId: string): Promise<ArtistBand[]> {
  const { rows } = await db().query(
    `select b.id, b.name, b.city, b.logo, b.color1, b.color2,
            jsonb_array_length(b.members) as member_count, bm.member_name
     from band_members bm
     join bands b on b.id = bm.band_id
     where bm.clerk_user_id = $1
     order by b.name`,
    [clerkUserId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    logo: r.logo,
    color1: r.color1,
    color2: r.color2,
    memberCount: Number(r.member_count) || 0,
    memberName: r.member_name,
  }));
}

export async function getArtistGigs(clerkUserId: string): Promise<ArtistGig[]> {
  const { rows } = await db().query(
    `select c.id, c.date, c.time, c.venue, c.city, c.festa_entitat, c.status,
            c.attendance, c.substitutes, c.no_substitute, c.amount, c.kind, c.invited, bm.member_name,
            b.id as band_id, b.name as band_name, b.logo, b.color1, b.color2, b.backups, b.show_fees
     from concerts c
     join band_members bm on bm.band_id = c.band_id and bm.clerk_user_id = $1
     join bands b on b.id = c.band_id
     where c.status <> 'cancel·lat'
       and (coalesce(c.kind, 'bolo') = 'bolo'
            or jsonb_array_length(coalesce(c.invited, '[]'::jsonb)) = 0
            or c.invited ? bm.member_name)
     order by c.date, c.time`,
    [clerkUserId]
  );
  return rows.map((r) => {
    const att = (r.attendance || {})[r.member_name];
    return {
      id: r.id,
      date: toDateStr(r.date),
      time: r.time,
      venue: r.venue,
      city: r.city,
      festaEntitat: r.festa_entitat,
      status: r.status,
      bandId: r.band_id,
      bandName: r.band_name,
      bandLogo: r.logo,
      color1: r.color1,
      color2: r.color2,
      myAttendance: att === "yes" || att === "no" ? att : null,
      mySubstitute: (r.substitutes || {})[r.member_name] || "",
      myNoSubstitute: !!(r.no_substitute || {})[r.member_name],
      bandBackups: (r.backups || []).map((b: { name?: string; instruments?: string[] }) => ({ name: b.name || "", instruments: b.instruments || [] })),
      amount: r.show_fees ? r.amount : null,
    };
  });
}

// Grups complets (forma Band) on l'usuari és membre — per reutilitzar les
// vistes del gestor (calendari, grup, concerts) dins l'àrea d'artista.
export async function getArtistBandsFull(clerkUserId: string): Promise<import("./types").Band[]> {
  const { rows } = await db().query(
    `select b.* from band_members bm join bands b on b.id = bm.band_id
     where bm.clerk_user_id = $1 order by b.name`,
    [clerkUserId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    rate: r.rate,
    contact: r.contact,
    phone: r.phone,
    tags: r.tags,
    members: r.members,
    crew: r.crew,
    joinCode: r.join_code,
    joinCodeActive: r.join_code_active,
    logo: r.logo,
    color1: r.color1,
    color2: r.color2,
    backups: r.backups || [],
    showFees: !!r.show_fees,
    coverUrl: r.cover_url || "",
    socialLinks: r.social_links || {},
    socialStats: r.social_stats || {},
    socialTracking: r.social_tracking || {},
    publicToken: r.public_token || "",
    bio: r.bio || "",
  }));
}

// Concerts complets (forma Concert) dels grups on l'usuari és membre, per a
// les vistes de calendari i llistat de l'àrea d'artista. Amaga els diners:
// amount es posa a 0 tret que el grup mostri caixets, i respecta els convidats
// dels esdeveniments que no són bolos.
export async function getArtistConcertsFull(clerkUserId: string): Promise<import("./types").Concert[]> {
  const { rows } = await db().query(
    `select c.*, b.show_fees, bm.member_name
     from concerts c
     join band_members bm on bm.band_id = c.band_id and bm.clerk_user_id = $1
     join bands b on b.id = c.band_id
     where (coalesce(c.kind, 'bolo') = 'bolo'
            or jsonb_array_length(coalesce(c.invited, '[]'::jsonb)) = 0
            or c.invited ? bm.member_name)
     order by c.date desc`,
    [clerkUserId]
  );
  return rows.map((r) => ({
    id: r.id,
    date: toDateStr(r.date),
    time: r.time,
    exactTime: r.exact_time || "",
    venue: r.venue,
    city: r.city,
    address: r.address || "",
    festaEntitat: r.festa_entitat,
    bandId: r.band_id,
    bandName: r.band_name,
    tags: r.tags,
    status: r.status,
    amount: r.show_fees ? r.amount : 0,
    attendance: r.attendance,
    substitutes: r.substitutes,
    noSubstitute: r.no_substitute,
    convocatoriaExcluded: r.convocatoria_excluded || {},
    contact: normalizeContact(r.contact),
    routeSheet: r.route_sheet,
    payouts: r.payouts || {},
    riderId: r.rider_id || null,
    setlistId: r.setlist_id || null,
    kind: r.kind || "bolo",
    invited: r.invited || [],
  }));
}

// Token del feed iCal personal de l'usuari.
export async function getFeedToken(clerkUserId: string): Promise<string> {
  const { rows } = await db().query("select feed_token from profiles where clerk_user_id=$1", [clerkUserId]);
  return rows[0]?.feed_token || "";
}

export type OpenBackupSearch = {
  id: string;
  date: string;
  city: string;
  venue: string;
  bandId: string;
  bandName: string;
  bandLogo: string;
  color1: string;
  instruments: string[];
  note: string;
  myApplicationStatus: "pendent" | "acceptada" | "rebutjada" | null;
  isMine: boolean;
};

// Borsa de suplències: cerques obertes de qualsevol grup d'Escenari.
export async function getOpenBackupSearches(clerkUserId: string): Promise<OpenBackupSearch[]> {
  const { rows } = await db().query(
    `select br.id, br.instruments, br.note, br.member_name,
            c.date, c.city, c.venue,
            b.id as band_id, b.name as band_name, b.logo, b.color1,
            ba.status as my_status,
            exists (select 1 from band_members bm where bm.band_id = br.band_id and bm.clerk_user_id = $1) as is_mine
     from backup_requests br
     join concerts c on c.id = br.concert_id
     join bands b on b.id = br.band_id
     left join backup_applications ba on ba.request_id = br.id and ba.clerk_user_id = $1
     where br.status = 'oberta' and c.date >= current_date
     order by c.date`,
    [clerkUserId]
  );
  return rows.map((r) => ({
    id: r.id,
    date: toDateStr(r.date),
    city: r.city,
    venue: r.venue,
    bandId: r.band_id,
    bandName: r.band_name,
    bandLogo: r.logo,
    color1: r.color1,
    instruments: r.instruments || [],
    note: r.note || "",
    myApplicationStatus: r.my_status || null,
    isMine: !!r.is_mine,
  }));
}

export async function getPendingInvitations(email: string): Promise<PendingInvitation[]> {
  if (!email) return [];
  const { rows } = await db().query(
    `select i.id, b.id as band_id, b.name as band_name, b.logo, b.color1, b.color2,
            coalesce((select p.name from profiles p
                      where p.workspace_id = b.workspace_id and p.role = 'manager'
                      order by p.created_at limit 1), '') as manager_name
     from invitations i
     join bands b on b.id = i.band_id
     where lower(i.email) = lower($1) and i.status = 'pendent'
     order by i.created_at desc`,
    [email]
  );
  return rows.map((r) => ({
    id: r.id,
    bandId: r.band_id,
    bandName: r.band_name,
    bandLogo: r.logo,
    color1: r.color1,
    color2: r.color2,
    managerName: r.manager_name,
  }));
}
