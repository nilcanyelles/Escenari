import { MAP_REGIONS, MAP_PROVINCES, MAP_COMARQUES, NEIGHBOUR_COUNTRIES, NEIGHBOUR_PLACES } from "./map-regions";

// Comarca, regió (comunitat autònoma) i país d'un punt [lon, lat], només
// amb els contorns que ja tenim a map-regions.ts — sense cap API: un cop
// una població té coordenades (cache de geocodificació de l'app), la resta
// es calcula aquí a l'instant. Les comarques només existeixen per a
// Catalunya; fora, queda buida.

export type GeoPlace = { comarca: string; provincia: string; regio: string; pais: string };

// Ray casting clàssic: està el punt dins del polígon?
export function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersect = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

type Bbox = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
export function ringsBbox(rings: [number, number][][]): Bbox {
  let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
  rings.forEach((r) => r.forEach(([lo, la]) => {
    if (lo < minLon) minLon = lo; if (lo > maxLon) maxLon = lo;
    if (la < minLat) minLat = la; if (la > maxLat) maxLat = la;
  }));
  return [minLon, minLat, maxLon, maxLat];
}
function inBbox(lon: number, lat: number, b: Bbox): boolean {
  return lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];
}
function inRings(lon: number, lat: number, rings: [number, number][][]): boolean {
  return rings.some((r) => pointInRing(lon, lat, r));
}

// Les bbox dels contorns es calculen un cop (les de map-regions no tenen un
// ordre garantit, així que es recalculen aquí).
const comarcaBoxes = MAP_COMARQUES.map((m) => ringsBbox(m.rings));
const provinceBoxes = MAP_PROVINCES.map((p) => ringsBbox(p.rings));
const countryBoxes = NEIGHBOUR_COUNTRIES.map((n) => ringsBbox(n.rings));

const COUNTRY_CA: Record<string, string> = {
  France: "França", Andorra: "Andorra", Portugal: "Portugal", Italy: "Itàlia", Morocco: "Marroc", Algeria: "Algèria",
  "United Kingdom": "Regne Unit", Germany: "Alemanya", Switzerland: "Suïssa", Belgium: "Bèlgica", Netherlands: "Països Baixos",
  Austria: "Àustria", Ireland: "Irlanda", Denmark: "Dinamarca", Sweden: "Suècia", Norway: "Noruega", Finland: "Finlàndia",
  Poland: "Polònia", Czechia: "Txèquia", Greece: "Grècia", Croatia: "Croàcia", Hungary: "Hongria", Romania: "Romania",
  Luxembourg: "Luxemburg", Monaco: "Mònaco", Malta: "Malta", Tunisia: "Tunísia", Slovenia: "Eslovènia", Slovakia: "Eslovàquia",
};

export function classifyPoint(lon: number, lat: number): GeoPlace {
  let comarca = "";
  for (let i = 0; i < MAP_COMARQUES.length; i++) {
    if (inBbox(lon, lat, comarcaBoxes[i]) && inRings(lon, lat, MAP_COMARQUES[i].rings)) { comarca = MAP_COMARQUES[i].label; break; }
  }
  for (let i = 0; i < MAP_PROVINCES.length; i++) {
    if (inBbox(lon, lat, provinceBoxes[i]) && inRings(lon, lat, MAP_PROVINCES[i].rings)) {
      const p = MAP_PROVINCES[i];
      return { comarca, provincia: p.label, regio: MAP_REGIONS[p.ccaa]?.label || "", pais: "Espanya" };
    }
  }
  const place = NEIGHBOUR_PLACES.find((p) => inRings(lon, lat, p.rings));
  if (place) return { comarca, provincia: "", regio: place.label, pais: COUNTRY_CA[place.country] || place.country };
  for (let i = 0; i < NEIGHBOUR_COUNTRIES.length; i++) {
    if (inBbox(lon, lat, countryBoxes[i]) && inRings(lon, lat, NEIGHBOUR_COUNTRIES[i].rings)) {
      const n = NEIGHBOUR_COUNTRIES[i];
      return { comarca, provincia: "", regio: "", pais: COUNTRY_CA[n.label] || n.label };
    }
  }
  return { comarca, provincia: "", regio: "", pais: "" };
}
