// Cerca de recintes/adreces (Google Places + Photon/OSM), sense cap
// comprovació de permisos — la pròpia (requireManagerAction, per a l'app;
// un enllaç compartit vàlid, per al formulari públic de regidor) la fa qui
// crida cada funció des de la seva pròpia "use server" action. Es fa
// servir des de dos llocs (src/app/(app)/concerts/actions.ts i
// src/app/f/actions.ts) perquè la lògica de cerca no es dupliqui entre
// l'accés de gestor i el del formulari públic.

export async function googlePlacesAutocomplete(query: string): Promise<{ description: string; placeId: string }[]> {
  const q = (query || "").trim();
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!q || q.length < 2 || !key) return [];
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  url.searchParams.set("language", "ca");
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== "OK") return [];
    const predictions: { description: string; place_id: string }[] = data.predictions || [];
    return predictions.map((p) => ({ description: p.description, placeId: p.place_id }));
  } catch {
    return [];
  }
}

// Detall d'un recinte triat de l'autocompletat de Google: nom, població,
// carrer i número (buit si aquell lloc no en té, per exemple una plaça) i
// coordenades — per si calgués una geocodificació inversa de reserva.
export async function googlePlaceDetails(placeId: string): Promise<{ name: string; city: string; street: string; housenumber: string; lat: number | null; lon: number | null } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!placeId || !key) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("language", "ca");
  url.searchParams.set("fields", "name,address_component,geometry");
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK") return null;
    const r = data.result || {};
    const comps: { long_name: string; types: string[] }[] = r.address_components || [];
    const find = (type: string) => comps.find((c) => c.types.includes(type))?.long_name || "";
    return {
      name: String(r.name || "").trim(),
      city: find("locality") || find("postal_town") || find("administrative_area_level_2"),
      street: find("route"),
      housenumber: find("street_number"),
      lat: r.geometry?.location?.lat ?? null,
      lon: r.geometry?.location?.lng ?? null,
    };
  } catch {
    return null;
  }
}

// Cerca de recintes/llocs reals (sales, places, pavellons...) via Photon,
// la mateixa API gratuïta que la de poblacions. Aquí no es filtra per
// type="city" perquè un recinte és un punt d'interès concret, no una
// població — es descarten només els resultats sense nom.
export async function photonSearch(query: string): Promise<{ description: string; name: string; city: string; street: string; housenumber: string; lat: number | null; lon: number | null; placeId: string }[]> {
  const q = (query || "").trim();
  if (!q || q.length < 2) return [];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const features: { properties: Record<string, unknown>; geometry?: { coordinates?: [number, number] } }[] = data.features || [];
    const seen = new Set<string>();
    const out: { description: string; name: string; city: string; street: string; housenumber: string; lat: number | null; lon: number | null; placeId: string }[] = [];
    for (const f of features) {
      const p = f.properties || {};
      const name = String(p.name || "").trim();
      if (!name) continue;
      const city = String(p.city || "").trim();
      const context = [city || p.state, p.country].filter(Boolean).join(", ");
      const description = context ? `${name}, ${context}` : name;
      const key = description.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const coords = f.geometry?.coordinates;
      out.push({
        description, name, city,
        street: String(p.street || "").trim(), housenumber: String(p.housenumber || "").trim(),
        lon: coords ? coords[0] : null, lat: coords ? coords[1] : null,
        placeId: `${p.osm_type || "n"}${p.osm_id ?? out.length}`,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// Molts recintes (sales, teatres...) no tenen número de carrer etiquetat a
// OSM tot i tenir-hi el nom — només un punt dins la ciutat. Quan passa, es
// completa amb una geocodificació inversa de les seves coordenades: la
// direcció etiquetada més propera (amb carrer i número de veritat).
export async function photonReverseGeocode(lat: number, lon: number): Promise<{ street: string; housenumber: string; city: string } | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("lang", "en");
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const p = (data.features || [])[0]?.properties || {};
    const street = String(p.street || "").trim();
    const housenumber = String(p.housenumber || "").trim();
    if (!street && !housenumber) return null;
    return { street, housenumber, city: String(p.city || "").trim() };
  } catch {
    return null;
  }
}

// Resol un detall de recinte (Google Place o Photon) en {venue, city,
// address} — versió de servidor de la mateixa lògica que fa servir
// VenueSearchField (resolvePlaceToVenueFields), per a la importació
// d'Excel: allà no hi ha cap desplegable per triar, així que es fa servir
// directament amb el detall de la primera opció de la cerca.
export async function resolveVenueFromDetails(v: { name: string; city: string; street: string; housenumber: string; lat: number | null; lon: number | null }): Promise<{ venue: string; city?: string; address?: string }> {
  let street = v.street || "", housenumber = v.housenumber || "", city = v.city;
  if (!housenumber && v.lat != null && v.lon != null) {
    const rev = await photonReverseGeocode(v.lat, v.lon);
    if (rev) {
      if (rev.street) street = rev.street;
      if (rev.housenumber) housenumber = rev.housenumber;
      if (!city && rev.city) city = rev.city;
    }
  }
  const addressParts = [[street, housenumber].filter(Boolean).join(" "), city].filter(Boolean);
  return {
    venue: v.name,
    ...(city ? { city } : {}),
    ...(addressParts.length ? { address: addressParts.join(", ") } : {}),
  };
}

// Geocodificació d'un recinte (no només poblacions, com geocodeOne a
// lib/geocode.ts — aquí no es filtra per tipus "ciutat", perquè el que es
// busca sol ser una sala, un parc o una plaça) amb reserva: Photon primer
// (ràpid) i, si falla, no respon a temps o no en troba cap, Nominatim
// (OpenStreetMap oficial) com a segon intent — dues APIs independents
// perquè una caiguda puntual de la primera no deixi el mapa del pòster
// sense punt on marcar.
export async function geocodePlace(query: string): Promise<{ lat: number; lon: number } | null> {
  const q = (query || "").trim();
  if (!q) return null;
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const c = data.features?.[0]?.geometry?.coordinates;
      if (c) return { lat: c[1], lon: c[0] };
    }
  } catch { /* prova Nominatim */ }
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "EscenariApp/1.0 (pòster del concert - mini-mapa)" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const rows: { lat: string; lon: string }[] = await res.json();
      const r = rows[0];
      if (r) {
        const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
      }
    }
  } catch { /* cap dels dos ha trobat res */ }
  return null;
}
