"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_REGIONS, MAP_COMARQUES, NEIGHBOUR_COUNTRIES, type MapRegionKey } from "@/lib/map-regions";
import { ringsBbox } from "@/lib/geo-stats";
import { getMunicipalityBoundaryAction, getComarcaBoundaryAction } from "@/app/(app)/concerts/actions";

export type ConcertPin = { name: string; count: number; lat: number; lon: number };
type Boundary = { rings: [number, number][][]; bbox: [number, number, number, number] };

// Mapa de les poblacions on hi ha hagut concerts. Contorns locals
// (comunitats autònomes i països veïns de map-regions.ts), projecció
// equirectangular amb correcció de cos(lat) com la resta de mapes petits de
// l'app. L'enquadrament s'ajusta sol a on hi ha bolos; a partir d'aquí es
// pot ampliar amb la roda/pinça del trackpad o els botons +/-, i moure's
// arrossegant amb el ratolí.
//
// El detall no depèn del zoom en si, sinó de quants quilòmetres de món es
// veuen (el costat més llarg del mapa), en tres capes que s'encavalquen:
// primer les fronteres comarcals, després els municipis on s'ha tocat
// il·luminats amb el seu límit real d'OSM, i finalment — quan ja s'hi és
// prou a prop perquè es noti — les comarques passen del contorn
// simplificat que porta map-regions.ts a la geometria sencera d'OSM, que
// té més d'un ordre de magnitud més de punts.
const CCAA_KEYS = (Object.keys(MAP_REGIONS) as MapRegionKey[]).filter((k) => k !== "paisos_catalans" && k !== "espanya");

// Punt dins d'un polígon (llista d'anells lon/lat), per raigs: creuaments
// senars = a dins. L'XOR entre anells ja tracta bé els forats i els
// enclavaments. Serveix per repartir cada població entre comarques.
function pointInRings(lon: number, lat: number, rings: [number, number][][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const MIN_ZOOM = 1, MAX_ZOOM = 60;
const COMARCA_SPAN_KM = 800;
const DETAIL_SPAN_KM = 300;
// Per sota d'aquesta distància val la pena baixar la geometria fina de les
// comarques que es veuen: aquí un tram del contorn simplificat ja fa uns
// quants píxels i es nota que fa cantonades. Més amunt seria carregar
// milers de punts per a una diferència que no es veuria.
const HIRES_SPAN_KM = 250;
// Franja (en km) durant la qual cada capa apareix fonent-se, en comptes de
// sortir de cop.
const FADE_KM = 60;
const KM_PER_DEG = 111.32;
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export default function ConcertPinMap({ pins, loading = false, emptyText = "Sense concerts localitzats en aquest període." }: {
  pins: ConcertPin[];
  loading?: boolean;
  emptyText?: string;
}) {
  const W = 720, H = 440;

  // Zoom (roda/pinça del trackpad, o els botons +/-) i desplaçament
  // (arrossegant amb el ratolí) — es manipula directament el viewBox de
  // l'SVG en comptes d'un transform CSS, perquè el punt sota el cursor es
  // quedi fix en fer zoom (com qualsevol mapa de veritat) sense haver de
  // recalcular res més.
  const svgRef = useRef<SVGSVGElement>(null);
  const [cam, setCam] = useState({ zoom: MIN_ZOOM, vbX: 0, vbY: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startVbX: number; startVbY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Límits municipals de detall (només un cop es passa DETAIL_ZOOM): es
  // demanen a mesura que hi ha xinxetes dins el que es veu, no totes de
  // cop. attemptsRef porta el compte de quantes vegades s'ha demanat cada
  // població: Overpass falla sovint puntualment, i sense un segon intent
  // aquell municipi es quedaria com a punt fins a recarregar la pàgina —
  // però amb un topall, perquè un que de veres no en tingui no es demani
  // sense parar cada cop que es mou el mapa.
  const [boundaries, setBoundaries] = useState<Record<string, Boundary>>({});
  // Geometria fina de les comarques que es veuen (substitueix la
  // simplificada un cop arriba), amb el mateix control d'intents.
  const [comarcaHires, setComarcaHires] = useState<Record<string, Boundary>>({});
  const attemptsRef = useRef<Map<string, number>>(new Map());
  const detailTimerRef = useRef<number | null>(null);
  const hiresTimerRef = useRef<number | null>(null);

  function zoomAt(factor: number, clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setCam((prev) => {
      const vbW = W / prev.zoom, vbH = H / prev.zoom;
      const px = (clientX - rect.left) / rect.width, py = (clientY - rect.top) / rect.height;
      const userX = prev.vbX + px * vbW, userY = prev.vbY + py * vbH;
      const nextZoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const nextVbW = W / nextZoom, nextVbH = H / nextZoom;
      return {
        zoom: nextZoom,
        vbX: clamp(userX - px * nextVbW, 0, Math.max(0, W - nextVbW)),
        vbY: clamp(userY - py * nextVbH, 0, Math.max(0, H - nextVbH)),
      };
    });
  }

  // El wheel/trackpad es capta amb un listener natiu (no el onWheel de
  // React, que ho registra com a "passive" i no deixaria fer
  // preventDefault) — sense això, en fer zoom dins el mapa també faria
  // scroll la pàgina.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0018);
      zoomAt(factor, e.clientX, e.clientY);
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrossegar amb el ratolí per moure's pel mapa — escoltat a la finestra
  // (no només l'SVG) perquè seguir arrossegant encara que el cursor surti
  // un moment del mapa no talli el gest a mitges.
  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const drag = dragRef.current, svg = svgRef.current;
      if (!drag || !svg) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      setCam((prev) => {
        const vbW = W / prev.zoom, vbH = H / prev.zoom;
        const dx = ((e.clientX - drag.startX) / rect.width) * vbW;
        const dy = ((e.clientY - drag.startY) / rect.height) * vbH;
        return {
          ...prev,
          vbX: clamp(drag.startVbX - dx, 0, Math.max(0, W - vbW)),
          vbY: clamp(drag.startVbY - dy, 0, Math.max(0, H - vbH)),
        };
      });
    }
    function onUp() { setDragging(false); dragRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  function onMapMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (cam.zoom <= MIN_ZOOM) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startVbX: cam.vbX, startVbY: cam.vbY };
    setDragging(true);
  }

  function zoomButton(factor: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

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
  // 3 decimals i no 1: el zoom s'aplica encongint el viewBox (fins a
  // MAX_ZOOM×), així que arrodonir el vèrtex a 0,1 unitats d'aquest espai
  // fix de 720×440 es tradueix, ben ampliat, en graons de diversos píxels
  // als contorns. A 0,001 la reixa queda molt per sota d'un píxel fins i
  // tot al zoom màxim, i el camí només creix un parell de caràcters per
  // punt.
  function ringPath(ring: [number, number][]): string {
    return ring.map((p, i) => { const [x, y] = project(p[0], p[1]); return (i === 0 ? "M" : "L") + x.toFixed(3) + "," + y.toFixed(3); }).join(" ") + " Z";
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

  // Comarques que toquen l'enquadrament, amb el seu punt central (per
  // demanar-ne després la geometria fina) — es recalcula només quan canvia
  // l'enquadrament, no en moure's pel mapa.
  const comarques = useMemo(() => {
    return MAP_COMARQUES.filter((c) => visible(c.rings)).map((c) => {
      const b = ringsBbox(c.rings);
      return { label: c.label, rings: c.rings, lon: (b[0] + b[2]) / 2, lat: (b[1] + b[3]) / 2 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Traçat simplificat (el de map-regions.ts): serveix de base immediata i
  // es queda si la geometria fina no arriba mai. Cada comarca porta la seva
  // caixa ja projectada per poder descartar, en dibuixar, les que queden
  // fora del tros de mapa que es veu.
  const comarcaPaths = useMemo(() => {
    return comarques.map((c) => {
      const b = ringsBbox(c.rings);
      const [x0, y1] = project(b[0], b[3]);
      const [x1, y0] = project(b[2], b[1]);
      return { key: c.label, d: c.rings.map(ringPath).join(" "), x0, y0, x1, y1 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comarques]);

  const maxCount = Math.max(1, ...pins.map((p) => p.count));

  // Repartiment de les poblacions per comarques: cada xinxeta cau dins
  // d'una comarca (prova ràpida de caixa i, si passa, punt-dins-polígon amb
  // el contorn simplificat de map-regions.ts). En surt, per comarca, el
  // total d'actuacions i la llista de pobles ordenada de més a menys — el
  // que es mostra al tooltip i el que fixa la intensitat de la llum.
  const comarcaActivity = useMemo(() => {
    const acc: Record<string, { total: number; towns: { name: string; count: number }[] }> = {};
    pins.forEach((p) => {
      const c = MAP_COMARQUES.find((c) =>
        p.lon >= c.bbox[0] && p.lon <= c.bbox[2] && p.lat >= c.bbox[1] && p.lat <= c.bbox[3] &&
        pointInRings(p.lon, p.lat, c.rings));
      if (!c) return;
      const e = acc[c.label] || (acc[c.label] = { total: 0, towns: [] });
      e.total += p.count;
      e.towns.push({ name: p.name, count: p.count });
    });
    Object.values(acc).forEach((e) => e.towns.sort((a, b) => b.count - a.count));
    return acc;
  }, [pins]);
  const maxComarcaCount = Math.max(1, ...Object.values(comarcaActivity).map((e) => e.total));

  const vbW = W / cam.zoom, vbH = H / cam.zoom;
  // Quilòmetres reals del costat més llarg del que es veu: la projecció ja
  // porta la correcció de cos(lat), així que una unitat del viewBox val el
  // mateix en horitzontal que en vertical.
  const spanKm = (Math.max(vbW, vbH) / view.scale) * KM_PER_DEG;
  // Una per capa: 0 mentre es vegi massa món, 1 quan ja s'hi és de ple.
  const comarcaT = clamp((COMARCA_SPAN_KM - spanKm) / FADE_KM, 0, 1);
  const detailT = clamp((DETAIL_SPAN_KM - spanKm) / FADE_KM, 0, 1);
  const wantsHires = spanKm <= HIRES_SPAN_KM;

  // Un cop s'ha ampliat prou, es demanen els límits municipals de les
  // poblacions que hi ha dins del que es veu (amb un marge) — esperant una
  // mica que el zoom/desplaçament s'aturi, perquè arrossegar o fer roda no
  // dispari una petició a cada mica de moviment.
  useEffect(() => {
    if (spanKm > DETAIL_SPAN_KM || !pins.length) return;
    if (detailTimerRef.current) window.clearTimeout(detailTimerRef.current);
    detailTimerRef.current = window.setTimeout(() => {
      const margin = Math.max(vbW, vbH) * 0.15;
      const toFetch = pins.filter((p) => {
        if (boundaries[p.name] || (attemptsRef.current.get(p.name) || 0) >= 2) return false;
        const [x, y] = project(p.lon, p.lat);
        return x >= cam.vbX - margin && x <= cam.vbX + vbW + margin && y >= cam.vbY - margin && y <= cam.vbY + vbH + margin;
      });
      if (!toFetch.length) return;
      toFetch.forEach((p) => attemptsRef.current.set(p.name, (attemptsRef.current.get(p.name) || 0) + 1));
      let idx = 0;
      async function worker() {
        while (idx < toFetch.length) {
          const p = toFetch[idx++];
          const b = await getMunicipalityBoundaryAction(p.name, p.lat, p.lon);
          if (b) setBoundaries((prev) => ({ ...prev, [p.name]: b }));
        }
      }
      // Com a molt 3 peticions Overpass alhora — no saturar el servei gratuït.
      Promise.all(Array.from({ length: Math.min(3, toFetch.length) }, worker));
    }, 350);
    return () => { if (detailTimerRef.current) window.clearTimeout(detailTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.zoom, cam.vbX, cam.vbY, pins]);

  // Geometria fina de les comarques, un cop s'hi és prou a prop: mateixa
  // manera de fer que amb els municipis (només les que es veuen, esperant
  // que el moviment s'aturi, i com a molt 3 peticions alhora).
  useEffect(() => {
    if (!wantsHires || !comarques.length) return;
    if (hiresTimerRef.current) window.clearTimeout(hiresTimerRef.current);
    hiresTimerRef.current = window.setTimeout(() => {
      const margin = Math.max(vbW, vbH) * 0.25;
      const toFetch = comarques.filter((c) => {
        const key = "c:" + c.label;
        if (comarcaHires[c.label] || (attemptsRef.current.get(key) || 0) >= 2) return false;
        const b = ringsBbox(c.rings);
        const [x0, y1] = project(b[0], b[3]);
        const [x1, y0] = project(b[2], b[1]);
        return x1 >= cam.vbX - margin && x0 <= cam.vbX + vbW + margin && y1 >= cam.vbY - margin && y0 <= cam.vbY + vbH + margin;
      });
      if (!toFetch.length) return;
      toFetch.forEach((c) => attemptsRef.current.set("c:" + c.label, (attemptsRef.current.get("c:" + c.label) || 0) + 1));
      let idx = 0;
      async function worker() {
        while (idx < toFetch.length) {
          const c = toFetch[idx++];
          const b = await getComarcaBoundaryAction(c.label, c.lat, c.lon);
          if (b) setComarcaHires((prev) => ({ ...prev, [c.label]: b }));
        }
      }
      Promise.all(Array.from({ length: Math.min(3, toFetch.length) }, worker));
    }, 350);
    return () => { if (hiresTimerRef.current) window.clearTimeout(hiresTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsHires, cam.vbX, cam.vbY, cam.zoom, comarques]);

  // El traçat fi es calcula un cop per comarca resolta (són milers de
  // punts: mai a cada moviment del mapa).
  const comarcaHiresPaths = useMemo(() => {
    const out: Record<string, string> = {};
    Object.entries(comarcaHires).forEach(([label, b]) => { out[label] = b.rings.map(ringPath).join(" "); });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comarcaHires, view]);

  return (
    <div className="card muni-map-card pin-map-card">
      <div className="muni-map-viewport">
        <svg
          ref={svgRef}
          viewBox={`${cam.vbX.toFixed(2)} ${cam.vbY.toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}`}
          className={"muni-map-svg" + (cam.zoom > MIN_ZOOM ? (dragging ? " grabbing" : " grabbable") : "")}
          onMouseDown={onMapMouseDown}
        >
          {shapes.map((s) => (
            // El contorn de Catalunya (litoral inclòs) és el més
            // generalitzat de tots: quan les comarques entren, el seu
            // mosaic ja tapa tota la vora amb geometria millor, així que
            // aquesta capa s'esvaeix just al ritme que puja comarcaT i no
            // deixa cap filet de costa doblat ni cap tros de terra sobrant
            // mar endins.
            <path
              key={s.key} d={s.d} fillRule="evenodd" className={"pin-map-shape " + s.kind}
              vectorEffect="non-scaling-stroke"
              opacity={s.key === "catalunya" ? 1 - comarcaT : undefined}
            />
          ))}
          {comarcaT > 0 && (() => {
            // Fora del que es veu no es dibuixa: amb la geometria fina són
            // milers de punts per comarca i, movent-se pel mapa, se n'hi
            // acumularien moltes de carregades.
            const vis = comarcaPaths.filter((c) => !(c.x1 < cam.vbX || c.x0 > cam.vbX + vbW || c.y1 < cam.vbY || c.y0 > cam.vbY + vbH));
            // Dues comarques veïnes comparteixen filet, i la vora exterior
            // va sobre el límit de la comunitat: sense fer res es veurien
            // dobles. Cada comarca es pinta amb una màscara opaca del color
            // de terra sota el seu traç; on dos filets coincideixen, el que
            // es dibuixa després tapa l'altre just en aquell tram. Per això
            // van primer les de contorn simplificat i després les de
            // geometria fina d'OSM — quan xoquen, guanya la de més detall.
            const ordered = [
              ...vis.filter((c) => !comarcaHiresPaths[c.key]).map((c) => ({ c, d: c.d })),
              ...vis.filter((c) => comarcaHiresPaths[c.key]).map((c) => ({ c, d: comarcaHiresPaths[c.key] })),
            ];
            return ordered.map(({ c, d }) => {
              // On hi ha hagut actuacions, la comarca s'il·lumina (mateixa
              // lògica que els municipis: intensitat per arrel del pes). El
              // farciment s'apaga a mesura que s'amplia i s'encenen els
              // municipis (1 − detailT), així les dues capes es
              // rellevonen. El tooltip: nom, nombre d'actuacions i pobles.
              const act = comarcaActivity[c.key];
              return (
                <g key={"c:" + c.key} opacity={comarcaT}>
                  <path d={d} className="pin-map-comarca-mask" fillRule="evenodd" vectorEffect="non-scaling-stroke" />
                  {act && detailT < 1 && (
                    <path
                      d={d} className="pin-map-comarca-active" fillRule="evenodd"
                      fillOpacity={(0.2 + Math.sqrt(act.total / maxComarcaCount) * 0.55) * (1 - detailT)}
                    >
                      <title>{c.key} — {act.total} {act.total === 1 ? "actuació" : "actuacions"}{"\n"}{act.towns.map((t) => `${t.name} · ${t.count}`).join("\n")}</title>
                    </path>
                  )}
                  <path d={d} className="pin-map-comarca" fillRule="evenodd" vectorEffect="non-scaling-stroke" />
                </g>
              );
            });
          })()}
          {detailT > 0 && pins.map((p) => {
            const boundary = boundaries[p.name];
            if (!boundary || !boundary.rings.length) return null;
            return (
              <path
                key={p.name} d={boundary.rings.map(ringPath).join(" ")} fillRule="evenodd"
                className="pin-map-boundary" vectorEffect="non-scaling-stroke"
                fillOpacity={(0.2 + Math.sqrt(p.count / maxCount) * 0.55) * detailT} strokeOpacity={detailT}
              >
                <title>{p.name} — {p.count} {p.count === 1 ? "concert" : "concerts"}</title>
              </path>
            );
          })}
        </svg>
        {pins.length > 0 && (
          <div className="muni-map-zoom">
            <button type="button" title="Amplia" disabled={cam.zoom >= MAX_ZOOM} onClick={() => zoomButton(1.5)}>+</button>
            <button type="button" title="Redueix" disabled={cam.zoom <= MIN_ZOOM} onClick={() => zoomButton(1 / 1.5)}>−</button>
          </div>
        )}
      </div>
      {pins.length === 0 && (
        <div className="t-dim" style={{ fontSize: 12.5, marginTop: 6 }}>{loading ? "Localitzant les poblacions…" : emptyText}</div>
      )}
    </div>
  );
}
