import { MAP_REGIONS, MAP_PROVINCES, MAP_COMARQUES, NEIGHBOUR_COUNTRIES, NEIGHBOUR_PLACES } from "./map-regions";

// Comarca, regió i país d'un punt [lon, lat], només amb els contorns que ja
// tenim a map-regions.ts — sense cap API: un cop una població té
// coordenades (cache de geocodificació de l'app), la resta es calcula aquí
// a l'instant. Les comarques (MAP_COMARQUES) cobreixen Catalunya, el País
// Valencià i les Illes Balears; fora d'aquests, queda buida.

export type GeoPlace = { comarca: string; provincia: string; regio: string; ccaa: string; pais: string };

// "Regio" a Catalunya i el País Valencià no és la província real, sinó una
// divisió més fina i coneguda: a Catalunya les vegueries (ja venen
// dibuixades tal qual a MAP_PROVINCES, no cal cap taula) i al País Valencià
// unes zones habituals (Castelló, València, Diània i Alacant i interior)
// que aquí es dedueixen de la comarca — MAP_PROVINCES només hi té dibuixades
// unes zones més imprecises. A la resta d'Espanya, "regio" és la província
// de veritat (ja tal com surt a MAP_PROVINCES). La comunitat autònoma
// pròpiament dita es guarda a part (camp "ccaa"), per a l'estadística que
// hi és independent de com es trossegi "regio".
const PV_ZONE_BY_COMARCA: Record<string, string> = {
  // Castelló (província)
  "l'Alt Maestrat": "Castelló", "el Baix Maestrat": "Castelló", "els Ports": "Castelló",
  "l'Alt Millars": "Castelló", "l'Alcalatén": "Castelló", "la Plana Alta": "Castelló",
  "la Plana Baixa": "Castelló", "l'Alt Palància": "Castelló",
  // Diània: la franja costanera de la Marina i la Safor
  "la Marina Alta": "Diània", "la Marina Baixa": "Diània", "la Safor": "Diània",
  // Alacant i interior (resta de la província d'Alacant)
  "l'Alacantí": "Alacant i interior", "l'Alcoià": "Alacant i interior", "el Comtat": "Alacant i interior",
  "el Vinalopó Mitjà": "Alacant i interior", "l'Alt Vinalopó": "Alacant i interior",
  "el Baix Vinalopó": "Alacant i interior", "el Baix Segura": "Alacant i interior",
  // València (resta de la província de València)
  "la Vall de Cofrents-Aiora": "València", "València": "València", "el Camp de Morvedre": "València",
  "la Canal de Navarrés": "València", "el Racó d'Ademús": "València", "la Ribera Alta": "València",
  "el Camp de Túria": "València", "l'Horta Nord": "València", "la Ribera Baixa": "València",
  "la Vall d'Albaida": "València", "l'Horta Sud": "València", "la Plana d'Utiel-Requena": "València",
  "els Serrans": "València", "la Costera": "València", "la Foia de Bunyol": "València",
};

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
      const regio = p.ccaa === "valencia" ? (PV_ZONE_BY_COMARCA[comarca] || p.label) : p.label;
      return { comarca, provincia: p.label, regio, ccaa: MAP_REGIONS[p.ccaa]?.label || "", pais: "Espanya" };
    }
  }
  const place = NEIGHBOUR_PLACES.find((p) => inRings(lon, lat, p.rings));
  if (place) return { comarca, provincia: "", regio: place.label, ccaa: "", pais: COUNTRY_CA[place.country] || place.country };
  for (let i = 0; i < NEIGHBOUR_COUNTRIES.length; i++) {
    if (inBbox(lon, lat, countryBoxes[i]) && inRings(lon, lat, NEIGHBOUR_COUNTRIES[i].rings)) {
      const n = NEIGHBOUR_COUNTRIES[i];
      return { comarca, provincia: "", regio: "", ccaa: "", pais: COUNTRY_CA[n.label] || n.label };
    }
  }
  return { comarca, provincia: "", regio: "", ccaa: "", pais: "" };
}
