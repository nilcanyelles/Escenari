import { db } from "@/lib/db";

// Valida un token d'enllaç compartit del formulari públic (/f/[token]) i
// en torna la fila si és vàlid — es fa servir tant des de les seves pròpies
// "use server" actions (src/app/f/actions.ts) com des de la ruta d'API que
// hi puja documents (sense sessió, per això mai requireManagerAction).
export async function validShareLink(token: string) {
  const row = (await db().query(
    `select * from share_links where id=$1 and revoked=false and expires_at > now()`,
    [token]
  )).rows[0];
  return row || null;
}
