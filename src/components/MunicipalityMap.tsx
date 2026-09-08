"use client";

import { useEffect, useState } from "react";
import { geocodeCitiesAction, getMunicipalityBoundaryAction } from "@/app/(app)/concerts/actions";

type CityCount = { name: string; count: number };
type Boundary = { rings: [number, number][][]; bbox: [number, number, number, number] } | null;

// Mapa acolorit (choropleth) de tots els municipis on hi ha hagut
// actuacions: cada límit municipal real (OSM) es tenyeix més suau o més
// intens segons el nombre de bolos que hi ha hagut. Es demana un cop per
// municipi (Overpass, amb cache permanent a la BD) i es projecta amb la
// mateixa equirectangular + correcció de cos(lat) que fa servir la resta
// de mapes petits de l'app.
export default function MunicipalityMap({ cities }: { cities: CityCount[] }) {
  const [boundaries, setBoundaries] = useState<Record<string, Boundary>>({});
  const [loading, setLoading] = useState(true);
  const key = cities.map((c) => c.name).join("|");

  useEffect(() => {
    let cancelled = false;
    setBoundaries({});
    if (!cities.length) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const coords = await geocodeCitiesAction(cities.map((c) => c.name));
      let idx = 0;
      async function worker() {
        while (idx < cities.length && !cancelled) {
          const city = cities[idx++];
          const coord = coords[city.name];
          const b = coord ? await getMunicipalityBoundaryAction(city.name, coord.lat, coord.lon) : null;
          if (!cancelled) setBoundaries((prev) => ({ ...prev, [city.name]: b as Boundary }));
        }
      }
      // Com a molt 3 peticions Overpass alhora — no saturar el servei gratuït.
      await Promise.all(Array.from({ length: Math.min(3, cities.length) }, worker));
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const resolved = cities
    .map((c) => ({ ...c, boundary: boundaries[c.name] }))
    .filter((c): c is CityCount & { boundary: NonNullable<Boundary> } => !!c.boundary && c.boundary.rings.length > 0);

  if (!resolved.length) {
    return (
      <div className="card muni-map-card">
        <div className="t-dim" style={{ fontSize: 12.5 }}>
          {loading ? "Localitzant els municipis…" : "No s'ha pogut dibuixar cap municipi (Overpass no disponible ara mateix)."}
        </div>
      </div>
    );
  }

  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  resolved.forEach((c) => c.boundary.rings.forEach((ring) => ring.forEach(([lo, la]) => {
    minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
    minLon = Math.min(minLon, lo); maxLon = Math.max(maxLon, lo);
  })));
  const padLat = (maxLat - minLat) * 0.1 || 0.05;
  const padLon = (maxLon - minLon) * 0.1 || 0.05;
  minLat -= padLat; maxLat += padLat; minLon -= padLon; maxLon += padLon;

  const W = 640, H = 420;
  const cosLat = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const lonSpan = (maxLon - minLon) * cosLat || 1;
  const latSpan = maxLat - minLat || 1;
  const scale = Math.min(W / lonSpan, H / latSpan);
  const offX = (W - lonSpan * scale) / 2, offY = (H - latSpan * scale) / 2;
  function project([lon, lat]: [number, number]): string {
    const x = offX + (lon - minLon) * cosLat * scale;
    const y = offY + (maxLat - lat) * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }
  function ringPath(ring: [number, number][]): string {
    return ring.map((p, i) => (i === 0 ? "M" : "L") + project(p)).join(" ") + " Z";
  }

  const counts = resolved.map((c) => c.count);
  const maxCount = Math.max(...counts), minCount = Math.min(...counts);

  return (
    <div className="card muni-map-card">
      <svg viewBox={`0 0 ${W} ${H}`} className="muni-map-svg">
        {resolved.map((c) => {
          const t = maxCount > minCount ? (c.count - minCount) / (maxCount - minCount) : 1;
          const alpha = 0.16 + t * 0.74;
          const d = c.boundary.rings.map(ringPath).join(" ");
          return (
            <path key={c.name} d={d} fillRule="evenodd"
              fill={`oklch(0.62 0.19 290 / ${alpha.toFixed(2)})`}
              stroke="oklch(0.62 0.19 290 / 0.75)" strokeWidth={1}>
              <title>{c.name} — {c.count} {c.count === 1 ? "bolo" : "bolos"}</title>
            </path>
          );
        })}
      </svg>
      <div className="muni-map-legend">
        <span>Poc</span>
        <span className="muni-map-legend-bar"></span>
        <span>Molt</span>
        {loading && <span className="t-dim" style={{ marginLeft: "auto" }}>Localitzant més municipis…</span>}
      </div>
    </div>
  );
}
