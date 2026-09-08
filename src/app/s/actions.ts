"use server";

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// El suplent proposat (des de l'enllaç /s/token que li ha enviat el membre
// que no pot venir) es presenta a la cerca: si el compte és nou, se li crea
// el perfil d'artista amb el nom i els instruments que ha escrit; i queda
// com a candidatura pendent perquè el gestor l'accepti o la rebutgi des de
// la fitxa del concert (Convocatòria).
export async function applySubstituteLinkAction(token: string, input: { name: string; instruments: string[]; message: string }): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Cal entrar amb el teu compte." };
  const pool = db();
  const req = (await pool.query("select id, concert_id, status from backup_requests where token=$1", [token])).rows[0];
  if (!req) return { ok: false, error: "Aquest enllaç no és vàlid." };
  if (req.status !== "oberta") return { ok: false, error: "Aquesta cerca de suplent ja està tancada." };

  const name = (input.name || "").trim();
  if (!name) return { ok: false, error: "Cal el teu nom." };
  const instruments = (input.instruments || []).map((s) => s.trim()).filter(Boolean);

  const existing = (await pool.query("select 1 from profiles where clerk_user_id=$1", [userId])).rows[0];
  if (!existing) {
    const cu = await currentUser();
    const email = cu?.primaryEmailAddress?.emailAddress || cu?.emailAddresses?.[0]?.emailAddress || "";
    await pool.query(
      `insert into profiles (clerk_user_id, email, role, name, instruments)
       values ($1, $2, 'artist', $3, $4) on conflict (clerk_user_id) do nothing`,
      [userId, email, name, JSON.stringify(instruments)]
    );
  } else if (instruments.length) {
    // Un perfil que ja existia només s'omple si encara no tenia instruments.
    await pool.query(
      "update profiles set instruments = case when jsonb_array_length(instruments) = 0 then $1::jsonb else instruments end where clerk_user_id=$2",
      [JSON.stringify(instruments), userId]
    );
  }

  await pool.query(
    `insert into backup_applications (request_id, clerk_user_id, message) values ($1,$2,$3)
     on conflict (request_id, clerk_user_id) do update set message = excluded.message`,
    [req.id, userId, (input.message || "").slice(0, 500)]
  );
  revalidatePath(`/concerts/${req.concert_id}`);
  revalidatePath("/grup");
  revalidatePath("/suplencies");
  return { ok: true };
}
