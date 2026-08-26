import { cookies } from "next/headers";
import type { Band, Concert, Invoice } from "./types";

export const BAND_COOKIE = "escenari_band";

// Grup seleccionat a la barra lateral ("" = tots els grups). Es guarda en una
// cookie perquè totes les pàgines de gestor comparteixin la mateixa selecció.
export async function getSelectedBandId(): Promise<string> {
  const store = await cookies();
  return store.get(BAND_COOKIE)?.value || "";
}

// Valida la selecció contra els grups reals del workspace (una cookie envellida
// no ha de deixar la vista buida). Amb un sol grup, sempre queda seleccionat:
// no té sentit l'estat "tots els grups".
export function resolveBandScope(bands: Band[], selectedBandId: string): string {
  if (bands.length === 1) return bands[0].id;
  if (!selectedBandId) return "";
  return bands.some((b) => b.id === selectedBandId) ? selectedBandId : "";
}

export function scopeConcerts(concerts: Concert[], bandId: string): Concert[] {
  return bandId ? concerts.filter((c) => c.bandId === bandId) : concerts;
}

export function scopeInvoices(invoices: Invoice[], concerts: Concert[], bandId: string): Invoice[] {
  if (!bandId) return invoices;
  const ids: Record<string, boolean> = {};
  concerts.forEach((c) => { if (c.bandId === bandId) ids[c.id] = true; });
  return invoices.filter((i) => ids[i.concertId]);
}
