"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { RouteSheet } from "@/lib/route-sheet";

// Valida un token d'enllaç compartit i torna la fila si és vàlid.
async function validLink(token: string) {
  const row = (await db().query(
    `select * from share_links where id=$1 and revoked=false and expires_at > now()`,
    [token]
  )).rows[0];
  return row || null;
}

export type ShareInfoPayload = {
  date: string;
  time: string;
  city: string;
  venue: string;
  festaEntitat: string;
};

// Desa el que ha omplert el destinatari del formulari públic. L'enllaç es pot
// reutilitzar (editable fins que caduqui), però només toca els camps del seu
// àmbit — mai l'import ni l'estat.
export async function submitShareFormAction(token: string, payload: { info?: ShareInfoPayload; routeSheet?: RouteSheet }): Promise<{ ok: boolean; error?: string }> {
  const link = await validLink(token);
  if (!link) return { ok: false, error: "Aquest enllaç ja no és vàlid." };

  const pool = db();
  if (payload.info && (link.scope === "info" || link.scope === "both")) {
    const p = payload.info;
    await pool.query(
      `update concerts set date=$1, time=$2, city=$3, venue=$4, festa_entitat=$5
       where id=$6 and workspace_id=$7`,
      [p.date, p.time, (p.city || "").trim(), (p.venue || "").trim(), (p.festaEntitat || "").trim(), link.concert_id, link.workspace_id]
    );
  }
  if (payload.routeSheet && (link.scope === "ruta" || link.scope === "both")) {
    await pool.query(
      "update concerts set route_sheet=$1 where id=$2 and workspace_id=$3",
      [JSON.stringify(payload.routeSheet), link.concert_id, link.workspace_id]
    );
  }
  await pool.query("update share_links set submitted_at=now() where id=$1", [token]);
  revalidatePath(`/concerts/${link.concert_id}`);
  return { ok: true };
}

export async function markLinkOpenedAction(token: string) {
  await db().query("update share_links set last_opened_at=now() where id=$1 and revoked=false and expires_at > now()", [token]);
}
