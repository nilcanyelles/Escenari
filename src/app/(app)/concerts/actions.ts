"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Concert } from "@/lib/types";
import { requireManagerAction } from "@/lib/current-user";
import { syncRouteSheetContactsToContacts } from "@/app/(app)/contactes/actions";

export type SaveConcertInput = {
  id: string | null;
  bandName: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  festaEntitat: string;
  amount: number;
  status: string;
  attendance: Record<string, string>;
  substitutes: Record<string, string>;
  noSubstitute: Record<string, boolean>;
  skipDefaults?: boolean;
};

function revalidateAll() {
  revalidatePath("/concerts");
  revalidatePath("/resum");
  revalidatePath("/calendari");
  revalidatePath("/base-de-dades");
  revalidatePath("/grups");
  revalidatePath("/artista");
}

// Sense caràcters ambigus (0/O, 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export async function saveConcertAction(data: SaveConcertInput) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const typedName = (data.bandName || "").trim();
  const typedLower = typedName.toLowerCase();

  let bandRow = (await pool.query("select * from bands where lower(name) = $1 and workspace_id=$2", [typedLower, workspaceId])).rows[0];

  if (!bandRow && data.id) {
    const existing = (await pool.query("select * from concerts where id=$1 and workspace_id=$2", [data.id, workspaceId])).rows[0];
    if (existing) {
      bandRow = (await pool.query("select * from bands where id=$1 and workspace_id=$2", [existing.band_id, workspaceId])).rows[0];
      if (bandRow && typedName && bandRow.name !== typedName) {
        await pool.query("update bands set name=$1 where id=$2", [typedName, bandRow.id]);
        await pool.query("update concerts set band_name=$1 where band_id=$2", [typedName, bandRow.id]);
        bandRow.name = typedName;
      }
    }
  }
  if (!bandRow && typedName) {
    const newId = "b" + Date.now();
    await pool.query(
      "insert into bands (id, name, city, rate, contact, phone, tags, members, crew, workspace_id, join_code) values ($1,$2,$3,$4,'','', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $5, $6)",
      [newId, typedName, data.city || "—", Math.round(data.amount) || 0, workspaceId, generateJoinCode()]
    );
    bandRow = (await pool.query("select * from bands where id=$1", [newId])).rows[0];
  }
  if (!bandRow && !data.skipDefaults) {
    bandRow = (await pool.query("select * from bands where workspace_id=$1 order by name limit 1", [workspaceId])).rows[0];
  }
  if (!bandRow && !data.skipDefaults) return;

  const venue = data.skipDefaults ? data.venue.trim() : (data.venue.trim() || "Sala per determinar");
  const city = data.skipDefaults ? data.city.trim() : (data.city.trim() || bandRow.city);

  const id = data.id || "c" + Date.now();
  await pool.query(
    `insert into concerts (id, date, time, venue, city, festa_entitat, band_id, band_name, tags, status, amount, attendance, substitutes, no_substitute, workspace_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     on conflict (id) do update set
       date=$2, time=$3, venue=$4, city=$5, festa_entitat=$6, band_id=$7, band_name=$8, tags=$9, status=$10, amount=$11,
       attendance=$12, substitutes=$13, no_substitute=$14
     where concerts.workspace_id = excluded.workspace_id`,
    [
      id, data.date, data.time, venue, city, (data.festaEntitat || "").trim(),
      bandRow ? bandRow.id : null, bandRow ? bandRow.name : "", JSON.stringify(bandRow?.tags || []), data.status, Math.round(data.amount) || 0,
      JSON.stringify(data.attendance || {}), JSON.stringify(data.substitutes || {}), JSON.stringify(data.noSubstitute || {}),
      workspaceId,
    ]
  );

  revalidateAll();

  return {
    id,
    date: data.date,
    time: data.time,
    venue,
    city,
    festaEntitat: (data.festaEntitat || "").trim(),
    bandId: bandRow ? bandRow.id : "",
    bandName: bandRow ? bandRow.name : "",
    tags: bandRow?.tags || [],
    status: data.status as Concert["status"],
    amount: Math.round(data.amount) || 0,
    attendance: data.attendance || {},
    substitutes: data.substitutes || {},
    noSubstitute: data.noSubstitute || {},
    routeSheet: null,
  } as Concert;
}

export async function saveRouteSheetAction(concertId: string, routeSheet: unknown) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  await pool.query("update concerts set route_sheet = $1 where id = $2 and workspace_id=$3", [JSON.stringify(routeSheet), concertId, workspaceId]);
  const contacts = (routeSheet as { contacts?: { name: string; role: string; phone: string; company: string }[] } | null)?.contacts;
  if (contacts) await syncRouteSheetContactsToContacts(workspaceId, contacts);
  revalidateAll();
  revalidatePath("/contactes");
}

export async function setConcertStatusAction(id: string, status: string) {
  const { workspaceId } = await requireManagerAction();
  await db().query("update concerts set status=$1 where id=$2 and workspace_id=$3", [status, id, workspaceId]);
  revalidateAll();
}

export async function deleteConcertAction(id: string) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  await pool.query("delete from invoices where concert_id=$1 and workspace_id=$2", [id, workspaceId]);
  await pool.query("delete from concerts where id=$1 and workspace_id=$2", [id, workspaceId]);
  revalidateAll();
}
