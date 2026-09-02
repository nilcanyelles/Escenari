"use client";

import { registerCustomInstruments, type CustomInstrument } from "@/lib/tags";

// Omple el registre d'instruments personalitzats al client abans que es
// pinti res que en necessiti la icona (va el primer dins del <body>).
export default function InstrumentRegistry({ items }: { items: CustomInstrument[] }) {
  registerCustomInstruments(items);
  return null;
}
