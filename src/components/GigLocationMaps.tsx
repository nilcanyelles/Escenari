"use client";

import { useEffect, useRef, useState } from "react";
import { geocodePosterVenueAction, getStreetWaysAction } from "@/app/(app)/concerts/actions";
import { MAP_REGIONS, type MapRegionKey } from "@/lib/map-regions";

// Decoració del banner del proper esdeveniment (NextGigPoster): a la dreta,
// la silueta de la comunitat autònoma on cau l'esdeveniment amb una
// xinxeta a la ubicació exacta (mateix estil que el mapa de
// ShareMonthModal, simplificat per a mida petita); a l'esquerra, un mapa
// de carrers real al voltant del recinte (mateixa font — Overpass — i
// estil neó que ConcertPosterEditor). Purament decoratiu: si la
// geocodificació falla o no hi ha prou dades, no es mostra res.
//
// Cau en memòria (no persisteix entre recàrregues, però sí entre canvis de
// fila dins la mateixa sessió): com que molts bolos repeteixen el mateix
// recinte (assajos setmanals, sales habituals...), la segona vegada que
// apareix el mateix recinte el mapa surt a l'instant en comptes de tornar
// a fer la volta geocodificació + Overpass.
type Coord = { lat: number; lon: number } | null;
type Way = { highway: string; pts: [number, number][] };
const geocodeCache = new Map<string, Promise<Coord>>();
const streetCache = new Map<string, Promise<Way[]>>();

function cachedGeocode(q: string): Promise<Coord> {
  let p = geocodeCache.get(q);
  if (!p) { p = geocodePosterVenueAction(q).catch(() => null); geocodeCache.set(q, p); }
  return p;
}
function cachedStreetWays(lat: number, lon: number, radius: number): Promise<Way[]> {
  const key = lat.toFixed(3) + "," + lon.toFixed(3) + "@" + radius;
  let p = streetCache.get(key);
  if (!p) { p = getStreetWaysAction(lat, lon, radius).then((r) => r.ways).catch(() => []); streetCache.set(key, p); }
  return p;
}

const SINGLE_REGION_KEYS = (Object.keys(MAP_REGIONS) as MapRegionKey[]).filter((k) => k !== "paisos_catalans" && k !== "espanya");

function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi)) inside = !inside;
  }
  return inside;
}

// Quina comunitat autònoma conté el punt — si cap contorn l'engloba exacte
// (típic d'una ciutat vora la costa, amb el contorn simplificat), la del
// bbox més proper.
function detectRegion(lon: number, lat: number): MapRegionKey {
  const hit = SINGLE_REGION_KEYS.find((key) => MAP_REGIONS[key].rings.some((r) => pointInRing(lon, lat, r)));
  if (hit) return hit;
  let best: MapRegionKey = "catalunya";
  let bestDist = Infinity;
  for (const key of SINGLE_REGION_KEYS) {
    const b = MAP_REGIONS[key].bbox;
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    const dist = Math.hypot(lon - cx, lat - cy);
    if (dist < bestDist) { bestDist = dist; best = key; }
  }
  return best;
}

function RegionMini({ lat, lon, accent, size }: { lat: number; lon: number; accent: string; size: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    const region = detectRegion(lon, lat);
    const rings = MAP_REGIONS[region].rings;
    const bbox = MAP_REGIONS[region].bbox;
    const cosLat = Math.cos(((bbox[1] + bbox[3]) / 2) * Math.PI / 180);
    const geoW = (bbox[2] - bbox[0]) * cosLat;
    const geoH = bbox[3] - bbox[1];
    const pad = size * 0.16;
    const scale = Math.min((size - pad * 2) / geoW, (size - pad * 2) / geoH);
    const offX = (size - geoW * scale) / 2;
    const offY = (size - geoH * scale) / 2;
    function project(plon: number, plat: number): [number, number] {
      return [offX + (plon - bbox[0]) * cosLat * scale, offY + (bbox[3] - plat) * scale];
    }
    ctx.fillStyle = accent + "33";
    ctx.strokeStyle = accent + "cc";
    ctx.lineWidth = 1.3;
    rings.forEach((ring) => {
      ctx.beginPath();
      ring.forEach(([plon, plat], i) => {
        const [x, y] = project(plon, plat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    const [px, py] = project(lon, lat);
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 9;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#0b0a14";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  }, [lat, lon, accent, size]);
  return <canvas ref={ref} style={{ width: size, height: size, display: "block" }} />;
}

function StreetMini({ lat, lon, accent, size, ways }: { lat: number; lon: number; accent: string; size: number; ways: Way[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const dLatAtRadius = 450 / 111320;
    const scale = (size / 2) / dLatAtRadius;
    function project(plon: number, plat: number): [number, number] {
      return [size / 2 + (plon - lon) * cosLat * scale, size / 2 - (plat - lat) * scale];
    }
    const path = new Path2D();
    ways.forEach((w) => {
      w.pts.forEach(([plon, plat], i) => {
        const [x, y] = project(plon, plat);
        if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
      });
    });
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(6,5,14,0.5)";
    ctx.lineWidth = 2.2;
    ctx.stroke(path);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.1;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 3;
    ctx.stroke(path);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }, [ways, lat, lon, accent, size]);
  if (!ways.length) return null;
  return <canvas ref={ref} style={{ width: size, height: size, display: "block", borderRadius: "50%" }} />;
}

// Un únic punt d'entrada: resol la geocodificació UNA sola vegada (abans es
// cridava per duplicat, un cop per cada mini-mapa) i mostra els dos mapes
// (carrers a l'esquerra, comunitat autònoma a la dreta) tan bon punt hi ha
// dades — gràcies a la cau en memòria, un recinte ja vist en aquesta sessió
// hi apareix a l'instant.
export default function GigLocationMaps({ venue, city, accent, size = 108 }: {
  venue?: string; city?: string; accent: string; size?: number;
}) {
  const q = [venue, city].filter(Boolean).join(", ");
  const [coord, setCoord] = useState<Coord>(null);
  const [ways, setWays] = useState<Way[] | null>(null);
  useEffect(() => {
    setCoord(null);
    setWays(null);
    if (!q) return;
    let cancelled = false;
    cachedGeocode(q).then((g) => {
      if (cancelled) return;
      setCoord(g);
      if (g) cachedStreetWays(g.lat, g.lon, 450).then((w) => { if (!cancelled) setWays(w); });
    });
    return () => { cancelled = true; };
  }, [q]);
  if (!coord) return null;
  return (
    <>
      <div className="cd-poster-minimap cd-poster-minimap-left" aria-hidden="true">
        {ways && <StreetMini lat={coord.lat} lon={coord.lon} accent={accent} size={size} ways={ways} />}
      </div>
      <div className="cd-poster-minimap cd-poster-minimap-right" aria-hidden="true">
        <RegionMini lat={coord.lat} lon={coord.lon} accent={accent} size={size} />
      </div>
    </>
  );
}
