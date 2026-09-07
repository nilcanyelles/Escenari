import { db } from "./db";

export type LinkedMember = {
  memberName: string;
  clerkUserId: string;
  profileName: string;
  email: string;
  instruments: string[];
};

export type BackupRequest = {
  id: string;
  bandId: string;
  concertId: string;
  memberName: string;
  instruments: string[];
  // Càrrec buscat quan és una cerca per a algú de la crew (no músic) —
  // s'utilitza l'un o l'altre, mai tots dos alhora.
  role: string;
  note: string;
  status: "oberta" | "coberta" | "cancel·lada";
  createdAt: string;
  applications: BackupApplication[];
};

export type BackupApplication = {
  clerkUserId: string;
  name: string;
  email: string;
  instruments: string[];
  message: string;
  status: "pendent" | "acceptada" | "rebutjada";
};

// Membres d'un grup que tenen compte d'Escenari (via band_members).
export async function getLinkedMembers(bandId: string): Promise<LinkedMember[]> {
  const { rows } = await db().query(
    `select bm.member_name, bm.clerk_user_id, p.name as profile_name, p.email, p.instruments
     from band_members bm
     join profiles p on p.clerk_user_id = bm.clerk_user_id
     where bm.band_id = $1`,
    [bandId]
  );
  return rows.map((r) => ({
    memberName: r.member_name,
    clerkUserId: r.clerk_user_id,
    profileName: r.profile_name,
    email: r.email,
    instruments: r.instruments || [],
  }));
}

export async function getLinkedMembersForBands(bandIds: string[]): Promise<Record<string, LinkedMember[]>> {
  if (!bandIds.length) return {};
  const { rows } = await db().query(
    `select bm.band_id, bm.member_name, bm.clerk_user_id, p.name as profile_name, p.email, p.instruments
     from band_members bm
     join profiles p on p.clerk_user_id = bm.clerk_user_id
     where bm.band_id = any($1)`,
    [bandIds]
  );
  const map: Record<string, LinkedMember[]> = {};
  rows.forEach((r) => {
    (map[r.band_id] = map[r.band_id] || []).push({
      memberName: r.member_name,
      clerkUserId: r.clerk_user_id,
      profileName: r.profile_name,
      email: r.email,
      instruments: r.instruments || [],
    });
  });
  return map;
}

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  // Un Date d'una columna "date" de Postgres representa mitjanit LOCAL
  // d'aquell dia — amb toISOString() (que sempre passa a UTC) es podia
  // desplaçar un dia enrere segons la zona horària del servidor.
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export async function getBackupRequests(workspaceId: string, opts?: { bandId?: string; concertId?: string }): Promise<BackupRequest[]> {
  const conds = ["br.workspace_id = $1"];
  const params: unknown[] = [workspaceId];
  if (opts?.bandId) { params.push(opts.bandId); conds.push(`br.band_id = $${params.length}`); }
  if (opts?.concertId) { params.push(opts.concertId); conds.push(`br.concert_id = $${params.length}`); }
  const { rows } = await db().query(
    `select br.*, coalesce(json_agg(json_build_object(
        'clerkUserId', ba.clerk_user_id, 'message', ba.message, 'status', ba.status,
        'name', p.name, 'email', p.email, 'instruments', p.instruments
      ) order by ba.created_at) filter (where ba.clerk_user_id is not null), '[]') as apps
     from backup_requests br
     left join backup_applications ba on ba.request_id = br.id
     left join profiles p on p.clerk_user_id = ba.clerk_user_id
     where ${conds.join(" and ")}
     group by br.id
     order by br.created_at desc`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    bandId: r.band_id,
    concertId: r.concert_id,
    memberName: r.member_name,
    instruments: r.instruments || [],
    role: r.role || "",
    note: r.note,
    status: r.status,
    createdAt: toDateStr(r.created_at),
    applications: (r.apps || []).map((a: Record<string, unknown>) => ({
      clerkUserId: a.clerkUserId,
      name: a.name || "",
      email: a.email || "",
      instruments: a.instruments || [],
      message: a.message || "",
      status: a.status,
    })),
  }));
}
