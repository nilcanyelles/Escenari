"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type SaveConcertInput = {
  id: string | null;
  bandName: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  amount: number;
  status: string;
  attendance: Record<string, string>;
  substitutes: Record<string, string>;
  noSubstitute: Record<string, boolean>;
};

function revalidateAll() {
  revalidatePath("/concerts");
  revalidatePath("/");
  revalidatePath("/calendari");
  revalidatePath("/base-de-dades");
  revalidatePath("/grups");
}

export async function saveConcertAction(data: SaveConcertInput) {
  const pool = db();
  const typedName = (data.bandName || "").trim();
  const typedLower = typedName.toLowerCase();

  let bandRow = (await pool.query("select * from bands where lower(name) = $1", [typedLower])).rows[0];

  if (!bandRow && data.id) {
    const existing = (await pool.query("select * from concerts where id=$1", [data.id])).rows[0];
    if (existing) {
      bandRow = (await pool.query("select * from bands where id=$1", [existing.band_id])).rows[0];
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
      "insert into bands (id, name, city, rate, contact, phone, tags, members, crew) values ($1,$2,$3,$4,'','', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)",
      [newId, typedName, data.city || "—", Math.round(data.amount) || 0]
    );
    bandRow = (await pool.query("select * from bands where id=$1", [newId])).rows[0];
  }
  if (!bandRow) {
    bandRow = (await pool.query("select * from bands order by name limit 1")).rows[0];
  }
  if (!bandRow) return;

  const id = data.id || "c" + Date.now();
  await pool.query(
    `insert into concerts (id, date, time, venue, city, band_id, band_name, tags, status, amount, attendance, substitutes, no_substitute)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     on conflict (id) do update set
       date=$2, time=$3, venue=$4, city=$5, band_id=$6, band_name=$7, tags=$8, status=$9, amount=$10,
       attendance=$11, substitutes=$12, no_substitute=$13`,
    [
      id, data.date, data.time, data.venue.trim() || "Sala per determinar", data.city.trim() || bandRow.city,
      bandRow.id, bandRow.name, JSON.stringify(bandRow.tags || []), data.status, Math.round(data.amount) || 0,
      JSON.stringify(data.attendance || {}), JSON.stringify(data.substitutes || {}), JSON.stringify(data.noSubstitute || {}),
    ]
  );

  revalidateAll();
}

export async function deleteConcertAction(id: string) {
  const pool = db();
  await pool.query("delete from invoices where concert_id=$1", [id]);
  await pool.query("delete from concerts where id=$1", [id]);
  revalidateAll();
}
