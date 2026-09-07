"use client";

import { useEffect, useRef, useState } from "react";
import { searchVenuesGoogleAction, getPlaceDetailsAction, reverseGeocodeAction } from "@/app/(app)/concerts/actions";

// Resol una predicció de cerca de Google (o qualsevol recinte amb lat/lon)
// en {venue, city, address} — molts recintes no tenen número de carrer
// etiquetat ells mateixos (només un punt dins la ciutat), així que si en
// falta es completa amb una geocodificació inversa de les coordenades.
export async function resolvePlaceToVenueFields(
  v: { name: string; city?: string; street?: string; housenumber?: string; lat?: number | null; lon?: number | null },
  // Injectable perquè el formulari públic de regidor (sense sessió) hi
  // passa la seva pròpia acció, validada per l'enllaç compartit en comptes
  // de requireManagerAction.
  reverseGeocode: (lat: number, lon: number) => Promise<{ street: string; housenumber: string; city: string } | null> = reverseGeocodeAction
): Promise<{ venue: string; city?: string; address?: string }> {
  let street = v.street || "", housenumber = v.housenumber || "", city = v.city;
  if (!housenumber && v.lat != null && v.lon != null) {
    const rev = await reverseGeocode(v.lat, v.lon);
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

// Cerca de recinte (Google Places) amb desplegable de resultats — en triar-
// ne un, resol el detall (nom, població, carrer i número) i crida onCommit
// amb el {venue, city?, address?} ja fet. Compartit entre la fitxa del
// concert, el modal ràpid de "Nou esdeveniment" i el formulari públic de
// regidor (que hi passa les seves pròpies accions, validades per l'enllaç
// compartit en comptes de requireManagerAction).
export default function VenueSearchField({ venue, onCommit, searchAction = searchVenuesGoogleAction, detailsAction = getPlaceDetailsAction, reverseGeocodeAction: reverseGeocode = reverseGeocodeAction }: {
  venue: string;
  onCommit: (v: { venue: string; city?: string; address?: string }) => void;
  searchAction?: (query: string) => Promise<{ description: string; placeId: string }[]>;
  detailsAction?: (placeId: string) => Promise<{ name: string; city: string; street: string; housenumber: string; lat: number | null; lon: number | null } | null>;
  reverseGeocodeAction?: (lat: number, lon: number) => Promise<{ street: string; housenumber: string; city: string } | null>;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ description: string; placeId: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    const q = search.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      const r = await searchAction(q);
      setResults(r);
      setSearching(false);
    }, 300);
    return () => { if (searchTimer.current) window.clearTimeout(searchTimer.current); };
  }, [search, searchAction]);

  async function selectVenue(placeId: string) {
    setResolving(placeId);
    const details = await detailsAction(placeId);
    setResolving(null);
    setDropdownOpen(false);
    if (!details) return;
    onCommit(await resolvePlaceToVenueFields(details, reverseGeocode));
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        className="field-input form-field" type="text" autoComplete="off" placeholder="Cerca un recinte…"
        value={dropdownOpen ? search : venue}
        onFocus={() => { setSearch(venue); setDropdownOpen(true); }}
        onChange={(e) => setSearch(e.target.value)}
      />
      {dropdownOpen && (
        <>
          <div className="year-picker-overlay" onClick={() => { if (!search.trim() && venue) onCommit({ venue: "" }); setDropdownOpen(false); }}></div>
          <div className="year-dropdown cf-band-dropdown" onClick={(e) => e.stopPropagation()}>
            {search.trim().length < 2 ? (
              <div className="cf-band-noresults">Escriu almenys 2 lletres… (o deixa-ho buit i tanca per esborrar)</div>
            ) : searching ? (
              <div className="cf-band-noresults">Cercant…</div>
            ) : results.length ? results.map((v) => (
              <button key={v.placeId} type="button" className="year-option" disabled={resolving === v.placeId}
                onClick={() => selectVenue(v.placeId)}>{resolving === v.placeId ? "Carregant…" : v.description}</button>
            )) : <div className="cf-band-noresults">Cap recinte coincideix</div>}
          </div>
        </>
      )}
    </div>
  );
}
