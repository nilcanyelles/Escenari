"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { INSTRUMENT_ICON_CHOICES, INSTRUMENT_PRESETS } from "@/lib/tags";

// Afegeix un instrument personalitzat (qualsevol compte, també a l'alta,
// que encara no té perfil) amb la icona triada d'entre les d'altres
// instruments. Si ja existeix, només se li actualitza la icona.
export async function addCustomInstrumentAction(name: string, icon: string): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Sessió no vàlida" };
  const clean = (name || "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!clean) return { ok: false, error: "Falta el nom" };
  if (INSTRUMENT_PRESETS.some((p) => p.toLowerCase() === clean.toLowerCase())) return { ok: true };
  const file = INSTRUMENT_ICON_CHOICES.some((c) => c.file === icon) ? icon : "";
  await db().query(
    `insert into custom_instruments (name_key, name, icon, created_by) values ($1,$2,$3,$4)
     on conflict (name_key) do update set icon = case when excluded.icon <> '' then excluded.icon else custom_instruments.icon end`,
    [clean.toLowerCase(), clean, file, userId]
  );
  return { ok: true };
}
