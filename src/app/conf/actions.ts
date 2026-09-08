"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireManagerAction } from "@/lib/current-user";
import { normalize } from "@/lib/text";
import { today } from "@/lib/format";
import { resolveAttendanceLink } from "@/lib/attendance-link";
import type { Person } from "@/lib/types";

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export type AttendanceLinkConcert = {
  id: string; date: string; time: string; venue: string; city: string; festaEntitat: string; kind: string; status: string;
};

// Concerts propers (a partir d'avui, no cancel·lats) del grup d'aquest
// concert — perquè el gestor triï quins entren a l'enllaç de confirmació.
// Inclou sempre el propi concert.
export async function listAttendanceLinkConcertsAction(concertId: string): Promise<AttendanceLinkConcert[]> {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const c = (await pool.query("select band_id from concerts where id=$1 and workspace_id=$2", [concertId, workspaceId])).rows[0];
  if (!c) throw new Error("Concert no trobat");
  const rows = (await pool.query(
    `select id, date, time, venue, city, festa_entitat, kind, status from concerts
     where band_id=$1 and workspace_id=$2 and status <> 'cancel·lat' and (date >= $3 or id = $4)
     order by date, time`,
    [c.band_id, workspaceId, today(), concertId]
  )).rows;
  return rows.map((r) => ({
    id: r.id, date: toDateStr(r.date), time: r.time || "", venue: r.venue || "", city: r.city || "",
    festaEntitat: r.festa_entitat || "", kind: r.kind || "bolo", status: r.status,
  }));
}

export type CreateAttendanceLinkOptions = {
  // Altres concerts del mateix grup a incloure-hi (el propi concert sempre
  // hi és). Buit i sense allFuture = enllaç d'un sol concert (att_token).
  concertIds?: string[];
  // "Tots els propers concerts": l'enllaç va a tots els del grup a partir
  // d'avui, també els que s'afegeixin després — n'hi ha un de sol per grup,
  // que es reutilitza.
  allFuture?: boolean;
};

// El gestor genera (o recupera) l'enllaç públic de confirmació d'assistència.
export async function createAttendanceLinkAction(concertId: string, opts?: CreateAttendanceLinkOptions): Promise<{ token: string }> {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const row = (await pool.query("select att_token, band_id from concerts where id=$1 and workspace_id=$2", [concertId, workspaceId])).rows[0];
  if (!row) throw new Error("Concert no trobat");

  const allFuture = !!opts?.allFuture;
  const ids = Array.from(new Set([concertId, ...(opts?.concertIds || [])]));
  if (!allFuture && ids.length <= 1) {
    if (row.att_token) return { token: row.att_token };
    const token = "at_" + randomBytes(10).toString("base64url");
    await pool.query("update concerts set att_token=$1 where id=$2", [token, concertId]);
    revalidatePath(`/concerts/${concertId}`);
    return { token };
  }

  if (allFuture) {
    const existing = (await pool.query(
      "select id from attendance_links where band_id=$1 and workspace_id=$2 and all_future order by created_at desc limit 1",
      [row.band_id, workspaceId]
    )).rows[0];
    if (existing) return { token: existing.id };
  }
  // Només concerts del mateix grup i workspace — un id que no ho sigui es
  // descarta en silenci.
  const valid = allFuture ? [] : (await pool.query(
    "select id from concerts where id = any($1::text[]) and band_id=$2 and workspace_id=$3",
    [ids, row.band_id, workspaceId]
  )).rows.map((r) => r.id as string);
  const token = "atm_" + randomBytes(10).toString("base64url");
  await pool.query(
    "insert into attendance_links (id, workspace_id, band_id, concert_ids, all_future) values ($1,$2,$3,$4,$5)",
    [token, workspaceId, row.band_id, JSON.stringify(valid), allFuture]
  );
  return { token };
}

// Qui respon s'identifica sempre amb el seu compte d'Escenari (la pàgina
// /conf ja el fa entrar, o crear-se el compte, abans de mostrar els
// concerts):
// - Si el membre ja té el compte vinculat (band_members), només pot
//   respondre aquell mateix compte.
// - Si no en té cap, el compte que respon queda vinculat automàticament
//   com a músic d'aquest grup (i, si el compte és nou, se li crea el perfil
//   d'artista amb la informació que ja tenim del membre).
export async function respondConfAction(
  token: string,
  concertId: string,
  memberName: string,
  answer: "yes" | "no"
): Promise<{ ok: boolean; error?: string }> {
  if (answer !== "yes" && answer !== "no") return { ok: false, error: "Resposta no vàlida" };
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Cal entrar amb el teu compte per confirmar." };

  const link = await resolveAttendanceLink(token);
  if (!link) return { ok: false, error: "Aquest enllaç ja no és vàlid" };
  if (!link.concertIds.includes(concertId)) return { ok: false, error: "Aquest concert no forma part de l'enllaç" };

  const pool = db();
  const band = (await pool.query("select id, members, crew from bands where id=$1", [link.bandId])).rows[0];
  if (!band) return { ok: false, error: "El grup ja no existeix" };
  const member = [...(band.members || []), ...(band.crew || [])].find((m: Person) => normalize(m.name) === normalize(memberName));
  if (!member) return { ok: false, error: "Aquesta persona no és membre del grup" };

  const memberLink = (await pool.query(
    "select clerk_user_id from band_members where band_id=$1 and lower(member_name)=lower($2)",
    [band.id, member.name]
  )).rows[0];
  if (memberLink && memberLink.clerk_user_id !== userId) {
    return { ok: false, error: `${member.name} ja té el compte vinculat — només pot confirmar la mateixa persona.` };
  }
  const myLink = (await pool.query(
    "select member_name from band_members where band_id=$1 and clerk_user_id=$2",
    [band.id, userId]
  )).rows[0];
  if (myLink && normalize(myLink.member_name) !== normalize(member.name)) {
    return { ok: false, error: `El teu compte ja està vinculat a ${myLink.member_name} en aquest grup.` };
  }

  if (!memberLink) {
    const myProfile = (await pool.query("select role from profiles where clerk_user_id=$1", [userId])).rows[0];
    // Un compte de gestor mai reclama el perfil d'un músic: el gestor marca
    // l'assistència des de la fitxa del concert (si també toca al grup, ja
    // hi tindrà el seu membre vinculat i entra pel cas de més amunt).
    if (myProfile?.role === "manager") {
      return { ok: false, error: "Ets el gestor — marca l'assistència des de la fitxa del concert, no des d'aquest enllaç." };
    }
    if (!myProfile) {
      const cu = await currentUser();
      const email = cu?.primaryEmailAddress?.emailAddress || cu?.emailAddresses?.[0]?.emailAddress || "";
      const instruments: string[] = member.instruments?.length
        ? member.instruments
        : String(member.role || "").split(/[,/]| i /i).map((s: string) => s.trim()).filter(Boolean);
      await pool.query(
        `insert into profiles (clerk_user_id, email, role, name, instruments)
         values ($1, $2, 'artist', $3, $4) on conflict (clerk_user_id) do nothing`,
        [userId, email, member.name, JSON.stringify(instruments)]
      );
    }
    await pool.query(
      `insert into band_members (band_id, clerk_user_id, member_name) values ($1,$2,$3)
       on conflict (band_id, clerk_user_id) do update set member_name = excluded.member_name`,
      [band.id, userId, member.name]
    );
    // Vincula el perfil públic creat pel gestor, si n'hi havia.
    await pool.query(
      "update person_profiles set clerk_user_id=$1 where workspace_id=$2 and lower(person_name)=lower($3) and clerk_user_id is null",
      [userId, link.workspaceId, member.name]
    );
  }

  if (answer === "yes") {
    await pool.query(
      `update concerts set
         attendance = attendance || jsonb_build_object($1::text, 'yes'),
         substitutes = substitutes - $1,
         no_substitute = no_substitute - $1
       where id = $2 and band_id = $3`,
      [member.name, concertId, band.id]
    );
  } else {
    await pool.query(
      `update concerts set attendance = attendance || jsonb_build_object($1::text, 'no') where id = $2 and band_id = $3`,
      [member.name, concertId, band.id]
    );
  }
  revalidatePath(`/conf/${token}`);
  revalidatePath(`/concerts/${concertId}`);
  revalidatePath("/artista");
  return { ok: true };
}
