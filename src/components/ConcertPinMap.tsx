"use client";

import { useMemo } from "react";
import { MAP_REGIONS, NEIGHBOUR_COUNTRIES, type MapRegionKey } from "@/lib/map-regions";
import { ringsBbox } from "@/lib/geo-stats";

export type ConcertPin = { name: string; count: number; lat: number; lon: number };

// Mapa de país amb una xinxeta per població on hi ha hagut concerts (la
// mida creix amb el nombre de bolos i les més repetides porten etiqueta).
// Contorns locals (comunitats autònomes i països veïns de map-regions.ts),
// projecció equirectangular amb correcció de cos(lat) com la resta de mapes
// petits de l'app. L'enquadrament s'ajusta sol a on hi ha xinxetes.
const CCAA_KEYS = (Object.keys(MAP_REGIONS) as MapRegionKey[]).filter((k) => k !== "paisos_catalans" && k !== "espanya");

export default function ConcertPinMap({ pins, loading = false, emptyText = "Sense concerts localitzats en aquest període." }: {
  pins: ConcertPin[];
  loading?: boolean;
  emptyText?: string;
}) {
  const W = 720, H = 440;

  const view = useMemo(() => {
    let minLon: number, minLat: number, maxLon: number, maxLat: number;
    if (pins.length) {
      minLon = Math.min(...pins.map((p) => p.lon)); maxLon = Math.max(...pins.map((p) => p.lon));
      minLat = Math.min(...pins.map((p) => p.lat)); maxLat = Math.max(...pins.map((p) => p.lat));
    } else {
      [minLon, minLat, maxLon, maxLat] = ringsBbox(MAP_REGIONS.catalunya.rings);
    }
    // Marge al voltant i una amplada mínima perquè un sol punt no surti
    // com un zoom absurd.
    const spanLon = Math.max(maxLon - minLon, 2.4), spanLat = Math.max(maxLat - minLat, 1.6);
    const cLon = (minLon + maxLon) / 2, cLat = (minLat + maxLat) / 2;
    minLon = cLon - spanLon * 0.62; maxLon = cLon + spanLon * 0.62;
    minLat = cLat - spanLat * 0.62; maxLat = cLat + spanLat * 0.62;
    const cosLat = Math.cos((cLat * Math.PI) / 180);
    const scale = Math.min(W / ((maxLon - minLon) * cosLat), H / (maxLat - minLat));
    const offX = (W - (maxLon - minLon) * cosLat * scale) / 2;
    const offY = (H - (maxLat - minLat) * scale) / 2;
    return { minLon, minLat, maxLon, maxLat, cosLat, scale, offX, offY };
  }, [pins]);

  function project(lon: number, lat: number): [number, number] {
    return [view.offX + (lon - view.minLon) * view.cosLat * view.scale, view.offY + (view.maxLat - lat) * view.scale];
  }
  function ringPath(ring: [number, number][]): string {
    return ring.map((p, i) => { const [x, y] = project(p[0], p[1]); return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1); }).join(" ") + " Z";
  }
  function visible(rings: [number, number][][]): boolean {
    const b = ringsBbox(rings);
    return b[2] >= view.minLon && b[0] <= view.maxLon && b[3] >= view.minLat && b[1] <= view.maxLat;
  }

  const shapes = useMemo(() => {
    const out: { key: string; d: string; kind: "ccaa" | "country" }[] = [];
    CCAA_KEYS.forEach((k) => { const r = MAP_REGIONS[k]; if (visible(r.rings)) out.push({ key: k, d: r.rings.map(ringPath).join(" "), kind: "ccaa" }); });
    NEIGHBOUR_COUNTRIES.forEach((n) => { if (visible(n.rings)) out.push({ key: "n:" + n.label, d: n.rings.map(ringPath).join(" "), kind: "country" }); });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const maxCount = Math.max(1, ...pins.map((p) => p.count));
  // Etiquetes només a les 14 més repetides, perquè no s'encavalquin totes.
  const labelled = new Set(pins.slice().sort((a, b) => b.count - a.count).slice(0, 14).map((p) => p.name));

  return (
    <div className="card muni-map-card pin-map-card">
      <svg viewBox={`0 0 ${W} ${H}`} className="muni-map-svg">
        {shapes.map((s) => (
          <path key={s.key} d={s.d} fillRule="evenodd" className={"pin-map-shape " + s.kind} />
        ))}
        {pins.map((p) => {
          const [x, y] = project(p.lon, p.lat);
          const r = 4 + Math.sqrt(p.count / maxCount) * 9;
          return (
            <g key={p.name} className="pin-map-pin">
              <circle cx={x} cy={y} r={r} />
              {labelled.has(p.name) && (
                <text x={x + r + 3} y={y + 4} className="pin-map-label">{p.name}{p.count > 1 ? ` · ${p.count}` : ""}</text>
              )}
              <title>{p.name} — {p.count} {p.count === 1 ? "concert" : "concerts"}</title>
            </g>
          );
        })}
      </svg>
      {pins.length === 0 && (
        <div className="t-dim" style={{ fontSize: 12.5, marginTop: 6 }}>{loading ? "Localitzant les poblacions…" : emptyText}</div>
      )}
    </div>
  );
}
