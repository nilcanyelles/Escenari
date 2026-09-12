import { db } from "./db";
import { normalizeRouteSheet, type RouteSheet } from "./route-sheet";
import type { Vehicle } from "./types";
import { ALL_SHARE_SECTIONS } from "./share-sections";

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  // Un Date d'una columna "date" de Postgres representa mitjanit LOCAL
  // d'aquell dia — amb toISOString() (que sempre passa a UTC) es podia
  // desplaçar un dia enrere segons la zona horària del servidor.
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export type PublicShareFormData = {
  sections: string[];
  recipientName: string;
  alreadySubmitted: boolean;
  concert: {
    id: string;
    date: string;
    time: string;
    venue: string;
    city: string;
    festaEntitat: string;
    bandName: string;
    kind: "bolo" | "assaig" | "reunio" | "altre";
    canAnnounce: "" | "yes" | "no";
    announceAfter: string;
    ticketType: "" | "gratuit" | "pagament";
    address: string;
    exactTime: string;
  };
  routeSheet: RouteSheet;
  vehicles: Vehicle[];
  assignedRider: { name: string; publicToken: string } | null;
  agency: { name: string; logo: string } | null;
};

// Munta tot el que necessita PublicShareForm a partir d'una fila de
// share_links ja validada (existeix, no revocada, no caducada, i si té
// codi d'accés, ja s'ha comprovat) — compartit entre la ruta sense codi
// (page.tsx la crida directament) i verifyShareLinkAccessCodeAction (la
// crida un cop el codi és correcte).
export async function assemblePublicShareData(link: { id: string; concert_id: string; workspace_id: string; sections?: unknown; recipient_name: string; submitted_at: unknown }): Promise<PublicShareFormData | null> {
  const pool = db();
  const c = (await pool.query("select * from concerts where id=$1 and workspace_id=$2", [link.concert_id, link.workspace_id])).rows[0];
  if (!c) return null;
  const band = (await pool.query("select vehicles from bands where id=$1", [c.band_id])).rows[0];
  // Rider assignat a aquest concert (només per veure'l — s'edita a la
  // pestanya Documents del formulari normal, mai des d'aquí).
  const rider = c.rider_id
    ? (await pool.query("select name, public_token from riders where id=$1", [c.rider_id])).rows[0]
    : null;
  const ws = (await pool.query("select name, logo from workspaces where id=$1", [link.workspace_id])).rows[0];

  await pool.query("update share_links set last_opened_at=now(), open_count = open_count + 1 where id=$1", [link.id]);

  return {
    sections: Array.isArray(link.sections) ? link.sections as string[] : ALL_SHARE_SECTIONS,
    recipientName: link.recipient_name || "",
    alreadySubmitted: !!link.submitted_at,
    concert: {
      id: c.id,
      date: toDateStr(c.date),
      time: c.time,
      venue: c.venue,
      city: c.city,
      festaEntitat: c.festa_entitat,
      bandName: c.band_name,
      kind: (c.kind || "bolo") as "bolo" | "assaig" | "reunio" | "altre",
      canAnnounce: (c.can_announce || "") as "" | "yes" | "no",
      announceAfter: c.announce_after || "",
      ticketType: (c.ticket_type || "") as "" | "gratuit" | "pagament",
      // "Adreça" (Lloc) i l'hora d'inici de la fase "Concert" (Horaris) són
      // el mateix camp que aquestes columnes — vegeu RouteSheetEditor i el
      // comentari de submitShareFormAction.
      address: c.address || "",
      exactTime: c.exact_time || "",
    },
    routeSheet: normalizeRouteSheet(c.route_sheet as RouteSheet | null, { venue: c.venue, time: c.time }),
    vehicles: band?.vehicles || [],
    assignedRider: rider ? { name: rider.name, publicToken: rider.public_token } : null,
    agency: ws ? { name: ws.name || "", logo: ws.logo || "" } : null,
  };
}
