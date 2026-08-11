import type { Concert } from "./types";

// Placeholder fins que es porti l'editor complet del full de ruta: sense route_sheet, mai està complet.
export function rsIsComplete(c: Concert): boolean {
  return !!c.routeSheet;
}
