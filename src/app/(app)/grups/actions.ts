"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Person } from "@/lib/types";

export type SaveBandInput = {
  id: string;
  name: string;
  tags: string[];
  city: string;
  rate: string;
  contact: string;
  phone: string;
  members: Person[];
  crew: Person[];
};

export async function saveBandAction(data: SaveBandInput) {
  const pool = db();
  const newName = (data.name || "").trim();
  const tags = data.tags.filter((t) => t && t.trim());
  const members = data.members.filter((p) => p.name && p.name.trim());
  const crew = data.crew.filter((p) => p.name && p.name.trim());
  const city = (data.city || "").trim();
  const rate = parseInt(data.rate, 10) || 0;
  const contact = (data.contact || "").trim();
  const phone = (data.phone || "").trim();

  const existing = (await pool.query("select name from bands where id=$1", [data.id])).rows[0];
  if (!existing) return;

  await pool.query(
    `update bands set name=$1, tags=$2, city=$3, rate=$4, contact=$5, phone=$6, members=$7, crew=$8 where id=$9`,
    [newName || existing.name, JSON.stringify(tags), city, rate, contact, phone, JSON.stringify(members), JSON.stringify(crew), data.id]
  );

  await pool.query(
    "update concerts set band_name=$1, tags=$2 where band_id=$3",
    [newName || existing.name, JSON.stringify(tags), data.id]
  );

  revalidatePath("/grups");
  revalidatePath("/concerts");
  revalidatePath("/");
  revalidatePath("/calendari");
  revalidatePath("/base-de-dades");
}
