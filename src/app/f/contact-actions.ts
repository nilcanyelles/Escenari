"use server";

import { revalidatePath } from "next/cache";
import { validShareLink } from "@/lib/share-link";
import { searchContacts, createRouteContact, publicContactFields } from "@/lib/contacts-data";
import type { Contact } from "@/lib/types";

// Contactes des del formulari públic de regidor (/f/token), validat per
// l'enllaç compartit en comptes de la sessió: la cerca només arriba als
// contactes del full de ruta (kind "ruta" — promotors, tècnics de sala,
// ajuntaments...), mai als músics de l'agència ni a les empreses de
// facturació, i sense correu, CIF, IBAN, adreça ni notes.

export async function searchContactsPublicAction(token: string, q: string): Promise<Contact[]> {
  const link = await validShareLink(token);
  if (!link) return [];
  return (await searchContacts(link.workspace_id, q, { kinds: ["ruta"], limit: 8 })).map(publicContactFields);
}

// Qui omple el formulari pot crear el contacte nou a l'instant (queda a
// Contactes de l'agència, com si s'hagués creat des de dins).
export async function createContactPublicAction(token: string, input: { name: string; role: string; phone: string; company: string }): Promise<Contact | null> {
  const link = await validShareLink(token);
  if (!link) return null;
  const c = await createRouteContact(link.workspace_id, input);
  if (c) { revalidatePath("/contactes"); revalidatePath("/agencia"); }
  return c ? publicContactFields(c) : null;
}
