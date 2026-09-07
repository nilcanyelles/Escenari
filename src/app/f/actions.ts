"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { RouteSheet } from "@/lib/route-sheet";
import { syncRouteSheetContactsToContacts } from "@/app/(app)/contactes/actions";
import { validShareLink } from "@/lib/share-link";
import { googlePlacesAutocomplete, googlePlaceDetails, photonSearch, photonReverseGeocode } from "@/lib/geo-search";

export type ShareInfoPayload = {
  date: string;
  time: string;
  city: string;
  venue: string;
  festaEntitat: string;
  // Només per a bolos (vegeu "Informació general" a ConcertDetailView) —
  // l'import no hi és, expressament: és una dada sensible que qui omple el
  // formulari des de fora no ha de poder veure ni tocar.
  canAnnounce?: "" | "yes" | "no";
  announceAfter?: string;
  ticketType?: "" | "gratuit" | "pagament";
};

// Desa el que ha omplert el destinatari del formulari públic. L'enllaç es pot
// reutilitzar (editable fins que caduqui), però només toca els camps del seu
// àmbit — mai l'import ni l'estat.
export async function submitShareFormAction(token: string, payload: {
  info?: ShareInfoPayload;
  routeSheet?: RouteSheet;
  // L'"Hora exacta" (Informació general) i l'"Adreça" (Lloc, dins el full
  // de ruta) són el mateix camp que concerts.exact_time/concerts.address —
  // igual que a RouteSheetEditor, cal desar-los també a la columna en
  // directe, si no withLiveAddress/withLiveConcertStart poden tornar a
  // mostrar el valor vell la propera vegada que es carregui la pàgina
  // (vegeu route-sheet.ts).
  exactTime?: string;
  address?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const link = await validShareLink(token);
  if (!link) return { ok: false, error: "Aquest enllaç ja no és vàlid." };

  const pool = db();
  if (payload.info && (link.scope === "info" || link.scope === "both")) {
    const p = payload.info;
    await pool.query(
      `update concerts set date=$1, time=$2, city=$3, venue=$4, festa_entitat=$5, can_announce=$6, announce_after=$7, ticket_type=$8
       where id=$9 and workspace_id=$10`,
      [p.date, p.time, (p.city || "").trim(), (p.venue || "").trim(), (p.festaEntitat || "").trim(),
        p.canAnnounce || "", p.announceAfter || "", p.ticketType || "", link.concert_id, link.workspace_id]
    );
  }
  if (payload.routeSheet && (link.scope === "ruta" || link.scope === "both")) {
    await pool.query(
      "update concerts set route_sheet=$1 where id=$2 and workspace_id=$3",
      [JSON.stringify(payload.routeSheet), link.concert_id, link.workspace_id]
    );
    // Qui omple el formulari extern no veu ni tria entre els contactes ja
    // desats de l'agència (seria una fuita de dades cap a fora), però el
    // que hi escriu sí que s'hi incorpora — igual que quan es desa el full
    // de ruta des de dins de l'app.
    const contacts = payload.routeSheet.contacts;
    if (contacts && contacts.length) {
      await syncRouteSheetContactsToContacts(link.workspace_id, contacts);
      revalidatePath("/contactes");
    }
  }
  // "Adreça" i l'hora exacta són camps compartits (Informació general ↔
  // Full de ruta) — es poden editar des de qualsevol de les dues seccions
  // que hi hagi al formulari, per això no van lligats a l'àmbit ("info" o
  // "ruta") d'un dels dos blocs de més amunt.
  if (payload.exactTime != null) {
    await pool.query("update concerts set exact_time=$1 where id=$2 and workspace_id=$3", [payload.exactTime, link.concert_id, link.workspace_id]);
  }
  if (payload.address != null) {
    await pool.query("update concerts set address=$1 where id=$2 and workspace_id=$3", [payload.address, link.concert_id, link.workspace_id]);
  }
  await pool.query("update share_links set submitted_at=now() where id=$1", [token]);
  revalidatePath(`/concerts/${link.concert_id}`);
  return { ok: true };
}

export async function markLinkOpenedAction(token: string) {
  await db().query("update share_links set last_opened_at=now() where id=$1 and revoked=false and expires_at > now()", [token]);
}

// ---------- Cerca de recintes/adreces des del formulari públic ----------
// Mateixa API que fa servir l'app (src/lib/geo-search.ts), però validada
// per l'enllaç compartit en comptes de requireManagerAction — qui omple el
// formulari no té sessió ni és necessàriament gestor.

export async function searchVenuesGooglePublicAction(token: string, query: string): Promise<{ description: string; placeId: string }[]> {
  if (!(await validShareLink(token))) return [];
  return googlePlacesAutocomplete(query);
}

export async function getPlaceDetailsPublicAction(token: string, placeId: string): Promise<{ name: string; city: string; street: string; housenumber: string; lat: number | null; lon: number | null } | null> {
  if (!(await validShareLink(token))) return null;
  return googlePlaceDetails(placeId);
}

export async function searchVenuesPublicAction(token: string, query: string): Promise<{ description: string; name: string; city: string; street: string; housenumber: string; lat: number | null; lon: number | null; placeId: string }[]> {
  if (!(await validShareLink(token))) return [];
  return photonSearch(query);
}

export async function reverseGeocodePublicAction(token: string, lat: number, lon: number): Promise<{ street: string; housenumber: string; city: string } | null> {
  if (!(await validShareLink(token))) return null;
  return photonReverseGeocode(lat, lon);
}
