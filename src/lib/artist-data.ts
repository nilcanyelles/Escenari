import { db } from "./db";

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
            c.attendance, bm.member_name,
            b.id as band_id, b.name as band_name, b.logo, b.color1, b.color2
     from concerts c
     join band_members bm on bm.band_id = c.band_id and bm.clerk_user_id = $1
     join bands b on b.id = c.band_id
     where c.status <> 'cancel·lat'
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
    };
  });
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
