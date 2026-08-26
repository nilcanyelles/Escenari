"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireManagerAction } from "@/lib/current-user";
import { normalize } from "@/lib/text";
import type { Person } from "@/lib/types";

// El gestor genera (o recupera) l'enllaç públic de confirmació d'assistència.
export async function createAttendanceLinkAction(concertId: string): Promise<{ token: string }> {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const row = (await pool.query("select att_token from concerts where id=$1 and workspace_id=$2", [concertId, workspaceId])).rows[0];
  if (!row) throw new Error("Concert no trobat");
  if (row.att_token) return { token: row.att_token };
  const token = "at_" + randomBytes(10).toString("base64url");
  await pool.query("update concerts set att_token=$1 where id=$2", [token, concertId]);
  revalidatePath(`/concerts/${concertId}`);
  return { token };
}

// Un músic (identificat amb el seu compte) confirma o rebutja des de l'enllaç.
// Si el membre encara no tenia compte vinculat, el compte que respon queda
// vinculat automàticament com a músic d'aquest grup.
export async function respondConfAction(
  token: string,
  memberName: string,
  answer: "yes" | "no"
): Promise<{ ok: boolean; error?: string }> {
  if (answer !== "yes" && answer !== "no") return { ok: false, error: "Resposta no vàlida" };
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Cal iniciar sessió per confirmar" };

  const pool = db();
  const concert = (await pool.query(
    "select id, band_id, workspace_id from concerts where att_token=$1 and status <> 'cancel·lat'",
    [token]
  )).rows[0];
  if (!concert) return { ok: false, error: "Aquest enllaç ja no és vàlid" };

  const band = (await pool.query("select id, members from bands where id=$1", [concert.band_id])).rows[0];
  if (!band) return { ok: false, error: "El grup ja no existeix" };
  const member = (band.members || []).find((m: Person) => normalize(m.name) === normalize(memberName));
  if (!member) return { ok: false, error: "Aquesta persona no és membre del grup" };

  // Qui pot respondre per aquest membre: el compte ja vinculat, o qualsevol
  // compte nou si el membre encara no en té (queda vinculat en respondre).
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
    // Alta automàtica: si el compte és nou (sense perfil), es crea com a
    // músic amb la informació que ja tenim del membre.
    const hasProfile = (await pool.query("select 1 from profiles where clerk_user_id=$1", [userId])).rows[0];
    if (!hasProfile) {
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
      [userId, concert.workspace_id, member.name]
    );
  }

  if (answer === "yes") {
    await pool.query(
      `update concerts set
         attendance = attendance || jsonb_build_object($1::text, 'yes'),
         substitutes = substitutes - $1,
         no_substitute = no_substitute - $1
       where id = $2`,
      [member.name, concert.id]
    );
  } else {
    await pool.query(
      `update concerts set attendance = attendance || jsonb_build_object($1::text, 'no') where id = $2`,
      [member.name, concert.id]
    );
  }
  revalidatePath(`/conf/${token}`);
  revalidatePath(`/concerts/${concert.id}`);
  revalidatePath("/artista");
  return { ok: true };
}
