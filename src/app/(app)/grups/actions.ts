"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Person } from "@/lib/types";
import { syncBandPeopleToContacts } from "@/app/(app)/contactes/actions";

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

  await syncBandPeopleToContacts(members.concat(crew));

  revalidatePath("/grups");
  revalidatePath("/concerts");
  revalidatePath("/");
  revalidatePath("/calendari");
  revalidatePath("/base-de-dades");
  revalidatePath("/contactes");
}

// Els músics/crew viuen dins dels grups (sense identitat pròpia): la mateixa
// persona pot aparèixer a diversos grups com a entrades independents amb el
// mateix nom. Editar el seu contacte actualitza totes les entrades que
// coincideixin de nom a tots els grups, perquè es vegi com una sola persona.
export async function updatePersonContactAction(data: { name: string; phone: string; email: string; instruments: string[] }) {
  const pool = db();
  const name = (data.name || "").trim();
  if (!name) return;
  const phone = (data.phone || "").trim();
  const email = (data.email || "").trim();
  const instruments = (data.instruments || []).filter((i) => i && i.trim());

  const { rows } = await pool.query("select id, members, crew from bands");
  for (const row of rows) {
    let changed = false;
    const patch = (list: Person[]) => list.map((p) => {
      if (p.name !== name) return p;
      changed = true;
      return { ...p, phone, email, instruments };
    });
    const members = patch(row.members || []);
    const crew = patch(row.crew || []);
    if (changed) {
      await pool.query("update bands set members=$1, crew=$2 where id=$3", [JSON.stringify(members), JSON.stringify(crew), row.id]);
    }
  }

  await syncBandPeopleToContacts([{ name, role: "", phone, email }]);

  revalidatePath("/grups");
  revalidatePath("/contactes");
}
