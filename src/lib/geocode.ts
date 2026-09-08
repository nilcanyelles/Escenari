import { db } from "./db";

// Geocodificació de poblacions (nom → lat/lon) amb la mateixa API gratuïta
// que la resta de l'app i un cache permanent a la base de dades: un cop es
// resol una població no es torna a demanar mai més a cap API externa. Ho
// fan servir els mapes (geocodeCitiesAction, gestor) i la borsa de
// suplències (distància des de casa del músic).

// Punt de referència (Madrid) per desempatar entre diversos resultats amb
// un nom relacionat — mai per excloure'n cap, només per triar el més
// proper quan n'hi ha diversos de plausibles.
const GEOCODE_BIAS_LAT = 40, GEOCODE_BIAS_LON = -3;
function biasDistance(lat: number, lon: number): number {
  const cosLat = Math.cos((GEOCODE_BIAS_LAT * Math.PI) / 180);
  return Math.hypot(lat - GEOCODE_BIAS_LAT, (lon - GEOCODE_BIAS_LON) * cosLat);
}
export function normalizeForMatch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
// Un nom que NOMÉS conté el terme buscat, sense ser-hi igual (p. ex.
// "Parisot" conté "Paris" però és un poble ben diferent), es penalitza en
// la distància — un handicap prou gran perquè només guanyi a un nom exacte
// quan hi és MOLT més a prop, mai per una proximitat petita.
const PARTIAL_MATCH_PENALTY = 6;
// D'entre uns quants candidats possibles per al mateix terme de cerca, es
// queda amb el més proper al punt de referència — però NOMÉS entre els que
// el seu nom conté realment el terme buscat (exacte, o com a mínim
// parcial). L'API torna els resultats ordenats per rellevància textual (no
// per distància), i pot incloure-hi coincidències purament fonètiques ben
// allunyades del que es demanava — filtrant primer pel nom i desempatant
// per distància només després, es prioritza bé "Tenerife (Canàries)" per
// davant de "Tenerife (Colòmbia)" sense arriscar-se a triar un resultat
// sense relació.
function pickBestCandidate(query: string, candidates: { lat: number; lon: number; name: string }[]): { lat: number; lon: number } | null {
  if (!candidates.length) return null;
  const q = normalizeForMatch(query);
  const nameMatches = candidates.filter((c) => normalizeForMatch(c.name).includes(q));
  const pool = nameMatches.length ? nameMatches : candidates;
  const scored = pool.map((c) => ({
    c,
    score: biasDistance(c.lat, c.lon) + (normalizeForMatch(c.name) === q ? 0 : PARTIAL_MATCH_PENALTY),
  }));
  return scored.reduce((best, s) => (s.score < best.score ? s : best)).c;
}

// Un sol punt: prova Photon (ràpid) i, si falla o no respon, Nominatim
// (OpenStreetMap oficial) com a reserva. Un nom sol (p. ex. "Berga") és
// ambigu arreu del món: es demana explícitament una POBLACIÓ i es tria la
// més propera a la península Ibèrica, sense descartar la resta.
export async function geocodeOne(q: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "6");
    url.searchParams.set("lang", "en");
    url.searchParams.set("lat", "40");
    url.searchParams.set("lon", "-3");
    url.searchParams.set("zoom", "6");
    url.searchParams.set("layer", "city");
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const features: { properties: Record<string, unknown>; geometry?: { coordinates?: unknown } }[] = data.features || [];
      const candidates = features
        .filter((f) => f.properties?.type === "city" && Array.isArray(f.geometry?.coordinates))
        .map((f) => {
          const [lon, lat] = f.geometry!.coordinates as [number, number];
          return { lon, lat, name: String(f.properties?.name || "") };
        });
      const best = pickBestCandidate(q, candidates);
      if (best) return best;
    }
  } catch { /* prova Nominatim */ }
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "6");
    url.searchParams.set("featureType", "settlement");
    url.searchParams.set("viewbox", "-10,44,4,36");
    url.searchParams.set("bounded", "0");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "EscenariApp/1.0 (full de ruta - mapa de concerts)" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const rows: { lat: string; lon: string; name?: string; display_name?: string }[] = await res.json();
      const candidates = rows
        .map((r) => ({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), name: r.name || r.display_name || "" }))
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
      const best = pickBestCandidate(q, candidates);
      if (best) return best;
    }
  } catch { /* cap dels dos ha trobat res */ }
  return null;
}

// Executa `fn` sobre `items` amb un màxim de `limit` peticions alhora, per no
// carregar de cop les APIs gratuïtes (que poden bloquejar ràfegues massa grans).
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export type LatLon = { lat: number; lon: number };

// Geocodifica un grapat de poblacions: primer el cache, després l'API només
// per a les que falten (que es desen per sempre). Una població que no es
// trobi queda a null.
export async function geocodeCitiesCached(cities: string[]): Promise<Record<string, LatLon | null>> {
  const unique = Array.from(new Set((cities || []).map((c) => (c || "").trim()).filter(Boolean)));
  if (!unique.length) return {};
  const pool = db();
  const out: Record<string, LatLon | null> = {};

  const { rows } = await pool.query("select query, lat, lon from geocode_cache where query = any($1)", [unique]);
  const cached = new Set<string>();
  for (const r of rows) {
    out[r.query] = r.lat != null && r.lon != null ? { lat: r.lat, lon: r.lon } : null;
    cached.add(r.query);
  }

  const missing = unique.filter((q) => !cached.has(q));
  if (missing.length) {
    const resolved = await mapLimit(missing, 4, geocodeOne);
    for (let i = 0; i < missing.length; i++) {
      const q = missing[i], coord = resolved[i];
      out[q] = coord;
      await pool.query(
        `insert into geocode_cache (query, lat, lon) values ($1,$2,$3)
         on conflict (query) do update set lat=excluded.lat, lon=excluded.lon, updated_at=now()`,
        [q, coord?.lat ?? null, coord?.lon ?? null]
      );
    }
  }
  return out;
}

// Distància en línia recta entre dos punts (km).
export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
