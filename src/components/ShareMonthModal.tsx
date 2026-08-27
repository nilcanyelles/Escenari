"use client";

import { useEffect, useRef, useState } from "react";
import type { Band, Concert } from "@/lib/types";
import { MONTH_FULL, WEEKDAY_SHORT, pad2 } from "@/lib/format";
import { bandColor } from "@/lib/tags";
import { MAP_REGIONS, MAP_PROVINCES, MAP_COMARQUES, NEIGHBOUR_COUNTRIES, NEIGHBOUR_PLACES, type MapRegionKey } from "@/lib/map-regions";
import { geocodeCitiesAction } from "@/app/(app)/concerts/actions";

// Imatge estil "Strava" del mes: un PNG 1080x1920 (story / fons de pantalla)
// amb la graella del mes i tots els concerts marcats, a punt per compartir.

const W = 1080;
const H = 1920;

const ACCENTS = ["#8b7bff", "#38E1C6", "#FFD400", "#FF5A36", "#FF3D8A"];

// Període que es comparteix: un sol mes (com sempre), un interval de mesos
// triat a mà (des de / fins a), o tot l'historial sencer sense cap límit
// de data.
type SharePeriod = "1m" | "custom" | "all";
const PERIOD_OPTIONS: SharePeriod[] = ["1m", "custom", "all"];
const PERIOD_LABELS: Record<SharePeriod, string> = { "1m": "1 mes", custom: "Tria l'interval", all: "Històric" };

// Punt dins d'un anell (ray casting), fet servir tant per triar automàticament
// la regió del mapa com per assignar cada concert a la seva província/vegueria.
function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi)) inside = !inside;
  }
  return inside;
}

// Si el mapa surt tan ampliat (Espanya sencera, per exemple) que dues
// xinxetes acaben quedant tan a prop en pantalla que es xafarien l'una amb
// l'altra, es fonen en una de sola (posició mitjana ponderada pel nombre de
// concerts, comptador sumat) en comptes de deixar-les superposades.
function mergeOverlappingPins<T extends { px: number; py: number; count: number }>(pins: T[], minDist: number): T[] {
  const result = pins.map((p) => ({ ...p }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dist = Math.hypot(result[i].px - result[j].px, result[i].py - result[j].py);
        if (dist < minDist) {
          const a = result[i], b = result[j];
          const total = a.count + b.count;
          const combined = { ...a, px: (a.px * a.count + b.px * b.count) / total, py: (a.py * a.count + b.py * b.count) / total, count: total };
          result.splice(j, 1);
          result.splice(i, 1);
          result.push(combined);
          merged = true;
          break outer;
        }
      }
    }
  }
  return result;
}

const PC_KEYS = new Set<MapRegionKey>(["catalunya", "valencia", "balears"]);
const SINGLE_REGION_KEYS = (Object.keys(MAP_REGIONS) as MapRegionKey[]).filter((k) => k !== "paisos_catalans" && k !== "espanya");

// Tria automàticament quina regió del mapa mostrar segons on són realment
// els bolos del mes: si tots cauen en una sola comunitat, aquesta; si es
// reparteixen entre Catalunya/País Valencià/Balears, Països Catalans; si
// s'escampen més enllà, Espanya sencera.
function detectMapRegion(concerts: Concert[], cityCoords: Record<string, { lat: number; lon: number } | null>): MapRegionKey {
  const touched = new Set<MapRegionKey>();
  concerts.forEach((c) => {
    const coord = cityCoords[c.city];
    if (!coord) return;
    const hit = SINGLE_REGION_KEYS.find((key) => MAP_REGIONS[key].rings.some((r) => pointInRing(coord.lon, coord.lat, r)));
    if (hit) touched.add(hit);
  });
  if (touched.size === 0) return "catalunya";
  if (touched.size === 1) return Array.from(touched)[0];
  if (Array.from(touched).every((k) => PC_KEYS.has(k))) return "paisos_catalans";
  return "espanya";
}

// Retalla el text amb "…" perquè no superi maxW amb la font ja activa a ctx.
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (maxW <= 0) return "";
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + "…").width <= maxW) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + "…" : "";
}

// Si el nom d'una població no hi cap sencer, abans de retallar-lo amb "…"
// s'abrevia intel·ligentment: primer "Sant"/"Santa" a "St."/"Sta.", i si
// encara no hi cap, les paraules significatives (no articles) a partir de
// la darrera, a "Xx." — p. ex. "Sant Feliu de Llobregat" -> "St. Feliu de Ll."
const HONORIFIC_ABBR: Record<string, string> = { Sant: "St.", Santa: "Sta." };
const SHORT_WORDS = new Set(["de", "del", "la", "les", "els", "l'", "d'", "i", "St.", "Sta."]);
function abbreviatePlace(ctx: CanvasRenderingContext2D, place: string, maxW: number): string {
  if (ctx.measureText(place).width <= maxW) return place;
  const words = place.split(" ");
  if (HONORIFIC_ABBR[words[0]]) {
    words[0] = HONORIFIC_ABBR[words[0]];
    if (ctx.measureText(words.join(" ")).width <= maxW) return words.join(" ");
  }
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (SHORT_WORDS.has(w) || w.length <= 2 || w.endsWith(".")) continue;
    words[i] = w.slice(0, 2) + ".";
    if (ctx.measureText(words.join(" ")).width <= maxW) return words.join(" ");
  }
  return fitText(ctx, words.join(" "), maxW);
}

// Decideix què entra en una línia "grup · festa": la població ja va a part i
// sempre sencera, el grup s'hi vol a sobre sí o sí (es trunca com a últim
// recurs), i la festa només s'hi afegeix si hi cap sencera — mai amb "…".
function pickBandFesta(ctx: CanvasRenderingContext2D, band: string, festa: string, restFont: string, maxW: number): string {
  ctx.font = restFont;
  if (festa) {
    const full = band + " · " + festa;
    if (ctx.measureText(full).width <= maxW) return full;
  }
  if (ctx.measureText(band).width <= maxW) return band;
  return fitText(ctx, band, maxW);
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function ShareMonthModal({ bands, concerts, today, onClose }: { bands: Band[]; concerts: Concert[]; today: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"story" | "poster">("story");
  const [monthIdx, setMonthIdx] = useState(() => parseInt(today.slice(5, 7), 10) - 1);
  const [year, setYear] = useState(() => parseInt(today.slice(0, 4), 10));
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [showList, setShowList] = useState(true);
  const [busy, setBusy] = useState(false);
  // Concerts que l'usuari ha tret del cartell, i concerts marcats com a TBA
  // (la població no es mostra, es mostra "TBA" en el seu lloc).
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [tbaIds, setTbaIds] = useState<Set<string>>(new Set());

  function toggleExcluded(id: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleTba(id: string) {
    setTbaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Període compartit: un mes (com sempre), un interval de mesos triat a
  // mà amb "des de" / "fins a", o tot l'historial sencer.
  const [period, setPeriod] = useState<SharePeriod>("1m");
  // Extrem "des de" de l'interval personalitzat — l'extrem "fins a" fa
  // servir directament monthIdx/year (el mateix que amb "1 mes"), així que
  // triar-lo des del selector "Fins a" o amb les fletxes és el mateix camp.
  const [customStartMonthIdx, setCustomStartMonthIdx] = useState(() => parseInt(today.slice(5, 7), 10) - 1);
  const [customStartYear, setCustomStartYear] = useState(() => parseInt(today.slice(0, 4), 10));

  function shiftMonth(delta: number) {
    let m = monthIdx + delta, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonthIdx(m); setYear(y);
  }

  const ymPrefix = year + "-" + pad2(monthIdx + 1);
  // Finestra de mesos que s'està compartint: "des de" i "fins a", ordenats
  // (si l'usuari tria un "fins a" anterior al "des de", simplement es
  // giren). Per "1 mes" els dos extrems són el mateix mes. Per "històric"
  // no hi ha cap límit — s'agafen tots els concerts, sense mirar la data.
  const rawStartYm = period === "custom" ? customStartYear * 12 + customStartMonthIdx : year * 12 + monthIdx;
  const rawEndYm = year * 12 + monthIdx;
  const startYm = Math.min(rawStartYm, rawEndYm);
  const endYm = Math.max(rawStartYm, rawEndYm);
  const startYear = Math.floor(startYm / 12);
  const startMonthIdx = startYm - startYear * 12;
  const endYear = Math.floor(endYm / 12);
  const endMonthIdx = endYm - endYear * 12;
  const rangeSlug = period === "all" ? "historic" : period === "1m" ? ymPrefix : `${startYear}-${pad2(startMonthIdx + 1)}_${endYear}-${pad2(endMonthIdx + 1)}`;
  // Etiqueta que es veu al costat de les fletxes de navegació.
  const navLabel = period === "all"
    ? "Tot l'historial"
    : period === "1m"
    ? `${MONTH_FULL[monthIdx]} ${year}`
    : startYear === endYear
    ? `${MONTH_FULL[startMonthIdx]} – ${MONTH_FULL[endMonthIdx]} ${endYear}`
    : `${MONTH_FULL[startMonthIdx]} ${startYear} – ${MONTH_FULL[endMonthIdx]} ${endYear}`;

  // Tots els concerts del període (per a la llista de selecció).
  const monthConcerts = concerts
    .filter((c) => {
      if (c.status === "cancel·lat") return false;
      if (period === "all") return true;
      const [cy, cm] = c.date.slice(0, 7).split("-").map(Number);
      const cYm = cy * 12 + (cm - 1);
      return cYm >= startYm && cYm <= endYm;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  // Només els que realment surten al cartell.
  const posterConcerts = monthConcerts.filter((c) => !excludedIds.has(c.id));

  // Calendari clàssic o mapa amb xinxetes. El calendari només té sentit amb
  // un sol mes seleccionat — amb un període més ampli sempre es mostra el
  // mapa. La regió del mapa no es tria a mà: es dedueix sola segons on són
  // realment els bolos del període.
  const [viewMode, setViewMode] = useState<"calendari" | "mapa">("calendari");
  const effectiveViewMode = period === "1m" ? viewMode : "mapa";
  useEffect(() => {
    if (period !== "1m" && viewMode !== "mapa") setViewMode("mapa");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // Anys disponibles als selectors "des de"/"fins a": des d'un any abans
  // del concert més antic fins a un any després del més recent (o, si no
  // hi ha cap concert, un marge fix al voltant d'avui).
  const concertYears = concerts.map((c) => parseInt(c.date.slice(0, 4), 10));
  const todayYear = parseInt(today.slice(0, 4), 10);
  const yearRangeMin = Math.min(todayYear, ...(concertYears.length ? concertYears : [todayYear])) - 1;
  const yearRangeMax = Math.max(todayYear, ...(concertYears.length ? concertYears : [todayYear])) + 1;
  // Calendari lineal de l'interval personalitzat: una sola línia de 12
  // mesos (l'any que toca es navega amb fletxes, com el mes normal), on es
  // clica primer el mes d'inici i després el de final — es pot canviar
  // d'any pel mig amb les fletxes sense perdre l'inici ja triat, així que
  // un interval que travessa un canvi d'any es tria igual de fàcil.
  const [timelineYear, setTimelineYear] = useState(() => parseInt(today.slice(0, 4), 10));
  const [rangeAnchorYm, setRangeAnchorYm] = useState<number | null>(null);
  useEffect(() => {
    if (period === "custom") setTimelineYear(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);
  function setCustomRangeFromYm(aYm: number, bYm: number) {
    const s = Math.min(aYm, bYm), e = Math.max(aYm, bYm);
    const sYear = Math.floor(s / 12), sMonth = s - sYear * 12;
    const eYear = Math.floor(e / 12), eMonth = e - eYear * 12;
    setCustomStartYear(sYear); setCustomStartMonthIdx(sMonth);
    setYear(eYear); setMonthIdx(eMonth);
  }
  function handleTimelineCellClick(ym: number) {
    if (rangeAnchorYm === null) {
      // Primer clic: fixa l'inici (de moment, un únic mes seleccionat).
      setRangeAnchorYm(ym);
      setCustomRangeFromYm(ym, ym);
    } else {
      // Segon clic (potser després de canviar d'any): tanca l'interval.
      setCustomRangeFromYm(rangeAnchorYm, ym);
      setRangeAnchorYm(null);
    }
  }

  const [cityCoords, setCityCoords] = useState<Record<string, { lat: number; lon: number } | null>>({});
  const [geocoding, setGeocoding] = useState(false);
  const mapRegion = detectMapRegion(posterConcerts, cityCoords);

  // Geocodifica les poblacions que encara no tinguem quan es passa a mode mapa.
  useEffect(() => {
    if (effectiveViewMode !== "mapa") return;
    const missing = Array.from(new Set(posterConcerts.map((c) => c.city).filter((city) => city && !(city in cityCoords))));
    if (!missing.length) return;
    let cancelled = false;
    setGeocoding(true);
    geocodeCitiesAction(missing).then((res) => {
      if (cancelled) return;
      setGeocoding(false);
      setCityCoords((prev) => ({ ...prev, ...res }));
    }).catch(() => { if (!cancelled) setGeocoding(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveViewMode, posterConcerts.map((c) => c.city).join("|")]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ---- Mode pòster: PNG transparent per posar sobre una foto a Instagram ----
    if (mode === "poster") {
      ctx.clearRect(0, 0, W, H);
      const upcoming = concerts
        .filter((c) => c.date >= today && c.status !== "cancel·lat")
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
        .slice(0, 6);
      const cream = "#f4efe4";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 26;

      // Títol gran apilat (estil cartell)
      const title = bands.length === 1 ? bands[0].name.toUpperCase() : "PROPERS\nCONCERTS";
      const lines = title.includes("\n") ? title.split("\n") : title.split(" ").length > 1 && title.length > 14 ? [title.split(" ")[0], title.split(" ").slice(1).join(" ")] : [title];
      ctx.fillStyle = cream;
      let ty = 260;
      lines.forEach((ln) => {
        let size = 150;
        ctx.font = `700 ${size}px 'Space Grotesk', sans-serif`;
        while (ctx.measureText(ln).width > W - 120 && size > 60) {
          size -= 6;
          ctx.font = `700 ${size}px 'Space Grotesk', sans-serif`;
        }
        ctx.fillText(ln, W / 2, ty);
        ty += size * 0.98;
      });

      // Molt d'espai buit al mig per a la foto de fons…

      // Llista de dates a baix
      ctx.font = "italic 500 34px Inter, sans-serif";
      ctx.fillStyle = "rgba(244, 239, 228, 0.85)";
      ctx.fillText("els pròxims concerts:", W / 2, H - 150 - upcoming.length * 54 - 40);
      ctx.font = "600 38px Inter, sans-serif";
      ctx.fillStyle = cream;
      upcoming.forEach((c, i) => {
        const [, mm, dd] = c.date.split("-");
        const line = `${dd}.${mm}${c.time ? ` — ${c.time}h` : ""}${c.city ? ` — ${c.city.split(",")[0]}` : ""}`;
        ctx.fillText(line, W / 2, H - 150 - (upcoming.length - 1 - i) * 54);
      });
      if (upcoming.length === 0) {
        ctx.font = "500 34px Inter, sans-serif";
        ctx.fillText("nous concerts ben aviat", W / 2, H - 190);
      }

      // Peu
      ctx.font = "600 27px Inter, sans-serif";
      ctx.fillStyle = "rgba(244, 239, 228, 0.75)";
      ctx.fillText("@escenari.app", W / 2, H - 60);
      ctx.shadowBlur = 0;
      return;
    }

    // Fons: degradat fosc amb un halo del color d'accent.
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0b0a14");
    bg.addColorStop(1, "#12101f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const halo = ctx.createRadialGradient(W * 0.8, H * 0.12, 60, W * 0.8, H * 0.12, 720);
    halo.addColorStop(0, accent + "40");
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    const halo2 = ctx.createRadialGradient(W * 0.1, H * 0.9, 60, W * 0.1, H * 0.9, 800);
    halo2.addColorStop(0, accent + "26");
    halo2.addColorStop(1, "transparent");
    ctx.fillStyle = halo2;
    ctx.fillRect(0, 0, W, H);

    // Marca.
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 44px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.letterSpacing = "14px";
    ctx.fillText("ESCENARI", 72, 130);
    ctx.letterSpacing = "0px";

    // Títol gegant: el mes sol (com sempre) o, amb un període més ampli,
    // l'interval de mesos ("AGO–OCT") o "HISTÒRIC" per tots els temps.
    let bigTitle: string;
    let subTitle: string;
    if (period === "all") {
      bigTitle = "HISTÒRIC";
      subTitle = monthConcerts.length ? `${monthConcerts[0].date.slice(0, 4)}–${monthConcerts[monthConcerts.length - 1].date.slice(0, 4)}` : "";
    } else if (period === "1m") {
      bigTitle = MONTH_FULL[monthIdx].toUpperCase();
      subTitle = String(year);
    } else {
      bigTitle = `${MONTH_FULL[startMonthIdx].slice(0, 3).toUpperCase()}–${MONTH_FULL[endMonthIdx].slice(0, 3).toUpperCase()}`;
      subTitle = startYear === endYear ? String(startYear) : `${startYear}–${endYear}`;
    }
    ctx.fillStyle = "#ffffff";
    let titleSize = 118;
    ctx.font = `700 ${titleSize}px 'Space Grotesk', sans-serif`;
    while (ctx.measureText(bigTitle).width > W - 144 && titleSize > 64) {
      titleSize -= 4;
      ctx.font = `700 ${titleSize}px 'Space Grotesk', sans-serif`;
    }
    ctx.fillText(bigTitle, 72, 300);
    if (subTitle) {
      ctx.fillStyle = accent;
      ctx.font = "700 60px 'Space Grotesk', sans-serif";
      ctx.fillText(subTitle, 76, 380);
    }

    // Comptador.
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 130px 'Space Grotesk', sans-serif";
    ctx.fillText(String(posterConcerts.length), W - 80, 320);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "500 34px Inter, sans-serif";
    ctx.fillText(posterConcerts.length === 1 ? "concert" : "concerts", W - 80, 372);
    ctx.textAlign = "left";

    // Àrea de graella/mapa (mateixa alçada en tots dos modes, perquè la
    // llista de sota sempre comenci al mateix punt).
    const gridTop = 470;
    const gridX = 72;
    const gridW = W - 144;
    const cell = gridW / 7;
    const base = new Date(year, monthIdx, 1);
    const startOffset = (base.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const numRows = Math.ceil((startOffset + daysInMonth) / 7);
    const rowH = 108;

    if (effectiveViewMode === "calendari") {
      const byDay: Record<number, Concert[]> = {};
      posterConcerts.forEach((c) => {
        const d = parseInt(c.date.slice(8, 10), 10);
        (byDay[d] = byDay[d] || []).push(c);
      });

      ctx.font = "600 26px Inter, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "center";
      WEEKDAY_SHORT.forEach((wd, i) => {
        ctx.fillText(wd.toUpperCase(), gridX + cell * i + cell / 2, gridTop);
      });

      for (let d = 1; d <= daysInMonth; d++) {
        const idx = startOffset + d - 1;
        const col = idx % 7, row = Math.floor(idx / 7);
        const cx = gridX + cell * col + cell / 2;
        const cy = gridTop + 40 + row * rowH + rowH / 2 - 10;
        const evs = byDay[d] || [];

        if (evs.length) {
          const c0 = evs[0];
          const bc = bands.find((b) => b.id === c0.bandId)?.color1 || bandColor(c0.bandId).color;
          ctx.save();
          ctx.shadowColor = accent;
          ctx.shadowBlur = 26;
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(cx, cy, 36, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = "#0b0a14";
          ctx.font = "700 32px Inter, sans-serif";
          ctx.fillText(String(d), cx, cy + 11);
          if (evs.length > 1) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "700 22px Inter, sans-serif";
            ctx.fillText("×" + evs.length, cx + 44, cy - 28);
          }
          void bc;
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.font = "500 30px Inter, sans-serif";
          ctx.fillText(String(d), cx, cy + 10);
        }
      }
      ctx.textAlign = "left";
    } else {
      // Mapa per províncies: cada província de la regió triada es dibuixa
      // sempre (el contorn), però només s'omple si hi ha algun bolo dins seu
      // — la resta queden només amb la vora, buides. Les coordenades es
      // projecten dins la mateixa caixa que ocuparia la graella, mantenint
      // la proporció real (corregint la longitud per la latitud mitjana).
      const regionProvinces = MAP_PROVINCES.filter((p) => p.regionKeys.includes(mapRegion));
      const fullBbox: [number, number, number, number] = regionProvinces.length
        ? [
            Math.min(...regionProvinces.map((p) => p.bbox[0])),
            Math.min(...regionProvinces.map((p) => p.bbox[1])),
            Math.max(...regionProvinces.map((p) => p.bbox[2])),
            Math.max(...regionProvinces.map((p) => p.bbox[3])),
          ]
        : MAP_REGIONS[mapRegion].bbox;

      // A quina província cau un punt: prova punt-dins-polígon a cada
      // província de la regió i, si no en toca cap (per exemple una ciutat
      // just a la vora, retallada per la simplificació), es queda amb la
      // més propera al seu centre.
      function findProvince(lon: number, lat: number) {
        const hit = regionProvinces.find((p) => p.rings.some((r) => pointInRing(lon, lat, r)));
        if (hit) return hit;
        let best: typeof regionProvinces[number] | null = null, bestDist = Infinity;
        for (const p of regionProvinces) {
          const cx = (p.bbox[0] + p.bbox[2]) / 2, cy = (p.bbox[1] + p.bbox[3]) / 2;
          const dist = Math.hypot(lon - cx, lat - cy);
          if (dist < bestDist) { bestDist = dist; best = p; }
        }
        return best;
      }

      // A quin país veí cau un punt — comprovat SEMPRE abans de fer-lo
      // encaixar per força en una província espanyola, perquè un bolo a
      // l'estranger (l'Alguer, a Sardenya, per exemple) hi aparegui de
      // veres i no s'assigni a qualsevol província propera per error.
      function findNeighbour(lon: number, lat: number) {
        return NEIGHBOUR_COUNTRIES.find((n) => n.rings.some((r) => pointInRing(lon, lat, r))) || null;
      }

      // Un indret CONCRET dins d'un país veí (per exemple l'Alguer, a
      // Sardenya) — comprovat ABANS que el país sencer, perquè es ressalti
      // només aquell municipi, exactament com una província activa més, en
      // comptes de tot el país veí. Fa servir la seva pròpia silueta real
      // (molt més precisa que la del país sencer), així que no depèn que el
      // punt caigui dins la silueta simplificada del país.
      function findNeighbourPlace(lon: number, lat: number) {
        return NEIGHBOUR_PLACES.find((p) => p.rings.some((r) => pointInRing(lon, lat, r))) || null;
      }

      // Quina província/vegueria (o país veí) s'acoloreix: la unitat que té
      // algun bolo dins seu. Es calcula ABANS de decidir l'enquadrament
      // perquè el mapa s'ajusti al territori actiu, no a tota la regió
      // sencera.
      const provinceAgg = new Map<string, { sumLon: number; sumLat: number; count: number }>();
      const neighbourAgg = new Map<string, { sumLon: number; sumLat: number; count: number }>();
      const neighbourPlaceAgg = new Map<string, { sumLon: number; sumLat: number; count: number }>();
      // Les xinxetes, en canvi, només es fonen entre elles si els concerts
      // són a la mateixa comarca (a Catalunya) — fora de Catalunya, on no hi
      // ha dades de comarca, es fonen per província (o país veí) com abans.
      function findComarca(lon: number, lat: number) {
        return MAP_COMARQUES.find((m) => m.rings.some((r) => pointInRing(lon, lat, r))) || null;
      }
      const pinAgg = new Map<string, { sumLon: number; sumLat: number; count: number }>();
      posterConcerts.forEach((c) => {
        if (tbaIds.has(c.id)) return;
        const coord = cityCoords[c.city];
        if (!coord) return;

        // Primer, l'indret concret dins un país veí (l'Alguer...): si hi
        // encaixa, es ressalta només aquell municipi i s'acaba aquí — mai
        // s'arriba a marcar tot el país sencer ni cap província espanyola.
        const place = findNeighbourPlace(coord.lon, coord.lat);
        if (place) {
          const plEntry = neighbourPlaceAgg.get(place.label) || { sumLon: 0, sumLat: 0, count: 0 };
          plEntry.sumLon += coord.lon; plEntry.sumLat += coord.lat; plEntry.count++;
          neighbourPlaceAgg.set(place.label, plEntry);
          const pinEntry = pinAgg.get("place:" + place.label) || { sumLon: 0, sumLat: 0, count: 0 };
          pinEntry.sumLon += coord.lon; pinEntry.sumLat += coord.lat; pinEntry.count++;
          pinAgg.set("place:" + place.label, pinEntry);
          return;
        }

        const neighbour = findNeighbour(coord.lon, coord.lat);
        if (neighbour) {
          const nEntry = neighbourAgg.get(neighbour.label) || { sumLon: 0, sumLat: 0, count: 0 };
          nEntry.sumLon += coord.lon; nEntry.sumLat += coord.lat; nEntry.count++;
          neighbourAgg.set(neighbour.label, nEntry);
          const pinEntry = pinAgg.get("neigh:" + neighbour.label) || { sumLon: 0, sumLat: 0, count: 0 };
          pinEntry.sumLon += coord.lon; pinEntry.sumLat += coord.lat; pinEntry.count++;
          pinAgg.set("neigh:" + neighbour.label, pinEntry);
          return;
        }

        const prov = findProvince(coord.lon, coord.lat);
        if (!prov) return;
        const provEntry = provinceAgg.get(prov.label) || { sumLon: 0, sumLat: 0, count: 0 };
        provEntry.sumLon += coord.lon; provEntry.sumLat += coord.lat; provEntry.count++;
        provinceAgg.set(prov.label, provEntry);

        const pinKey = prov.ccaa === "catalunya" ? "com:" + (findComarca(coord.lon, coord.lat)?.label ?? prov.label) : "prov:" + prov.label;
        const pinEntry = pinAgg.get(pinKey) || { sumLon: 0, sumLat: 0, count: 0 };
        pinEntry.sumLon += coord.lon; pinEntry.sumLat += coord.lat; pinEntry.count++;
        pinAgg.set(pinKey, pinEntry);
      });

      // Punt de focus: el centre real dels bolos (mitjana ponderada). Els
      // territoris s'hi difuminen com més lluny en queden.
      let focus: { lon: number; lat: number } | null = null;
      {
        let sLon = 0, sLat = 0, n = 0;
        provinceAgg.forEach((e) => { sLon += e.sumLon; sLat += e.sumLat; n += e.count; });
        neighbourAgg.forEach((e) => { sLon += e.sumLon; sLat += e.sumLat; n += e.count; });
        neighbourPlaceAgg.forEach((e) => { sLon += e.sumLon; sLat += e.sumLat; n += e.count; });
        if (n) focus = { lon: sLon / n, lat: sLat / n };
      }

      // El territori amb bolos ocupa sempre el màxim d'espai possible:
      // s'enquadra només la caixa de les províncies actives (amb un marge
      // perquè els territoris buits del voltant hi tinguin lloc per
      // difuminar-se), no la regió sencera — si no hi ha cap bolo geocodificat
      // encara, s'usa la regió sencera com a resguard.
      const activeProvinces = regionProvinces.filter((p) => provinceAgg.has(p.label));
      const activeNeighbours = NEIGHBOUR_COUNTRIES.filter((n) => neighbourAgg.has(n.label));
      const activeNeighbourPlaces = NEIGHBOUR_PLACES.filter((p) => neighbourPlaceAgg.has(p.label));
      const activeCcaas = Array.from(new Set(activeProvinces.map((p) => p.ccaa)));

      // Quants països diferents toquen el mapa: Espanya (si hi ha alguna
      // província activa) més cada país veí, sencer o d'un indret concret
      // (comptat pel seu país), un sol cop cadascun.
      const activeCountrySet = new Set<string>();
      if (activeProvinces.length) activeCountrySet.add("Espanya");
      activeNeighbours.forEach((n) => activeCountrySet.add(n.label));
      activeNeighbourPlaces.forEach((p) => activeCountrySet.add(p.country));
      const multiCountry = activeCountrySet.size >= 2;

      // Amb 2 o més països al mapa, la banda espanyola es simplifica: en
      // comptes d'il·luminar només la vegueria/província concreta amb bolos
      // (amb les fronteres internes entre vegueries/províncies visibles),
      // s'il·lumina la comunitat autònoma SENCERA i només se'n veu la
      // frontera exterior — a aquesta escala, amb diversos països dins el
      // mateix pòster, el detall fi ja no hi cap ni hi aporta res.
      const domesticTerritories: { rings: [number, number][][]; bbox: [number, number, number, number] }[] = multiCountry
        ? activeCcaas.map((ccaa) => ({ rings: MAP_REGIONS[ccaa].rings, bbox: MAP_REGIONS[ccaa].bbox }))
        : activeProvinces;

      function ringsBbox(rings: [number, number][][]): [number, number, number, number] {
        const lons = rings.flat().map((p) => p[0]), lats = rings.flat().map((p) => p[1]);
        return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
      }
      const activeNeighbourBboxes = activeNeighbours.map((n) => ringsBbox(n.rings));
      const activeNeighbourPlaceBboxes = activeNeighbourPlaces.map((p) => ringsBbox(p.rings));
      const hasActiveTerritory = domesticTerritories.length || activeNeighbours.length || activeNeighbourPlaces.length;
      const zoomBoxes = hasActiveTerritory
        ? [...domesticTerritories.map((p) => p.bbox), ...activeNeighbourBboxes, ...activeNeighbourPlaceBboxes]
        : [...regionProvinces.map((p) => p.bbox)];
      const rawBbox: [number, number, number, number] = [
        Math.min(...zoomBoxes.map((b) => b[0])),
        Math.min(...zoomBoxes.map((b) => b[1])),
        Math.max(...zoomBoxes.map((b) => b[2])),
        Math.max(...zoomBoxes.map((b) => b[3])),
      ];
      // Amb poques comunitats autònomes actives (una vista local, "zoomada")
      // cal més marge perquè hi càpiguen la costa i la frontera amb un altre
      // país — amb moltes (Espanya sencera) ja hi surten soles a aquesta
      // escala, així que n'hi ha prou amb el marge just.
      // El territori amb bolos ha de quedar sempre com més gran millor: el
      // marge és just el necessari perquè s'hi entreveuen la costa i la
      // frontera (l'anterior era massa generós i encongia massa la zona
      // activa).
      // El marge és un percentatge de la zona activa (perquè no s'encongeixi
      // massa), però mai per sota d'un percentatge de la regió sencera —
      // així, encara que el territori actiu sigui minúscul (una sola
      // vegueria petita), el marge arriba prou lluny perquè hi entri un tros
      // de costa o de frontera amb un altre país.
      const padW = Math.max((rawBbox[2] - rawBbox[0]) * 0.22, (fullBbox[2] - fullBbox[0]) * 0.14, 0.12);
      const padH = Math.max((rawBbox[3] - rawBbox[1]) * 0.22, (fullBbox[3] - fullBbox[1]) * 0.14, 0.12);
      const bbox: [number, number, number, number] = hasActiveTerritory
        ? [rawBbox[0] - padW, rawBbox[1] - padH, rawBbox[2] + padW, rawBbox[3] + padH]
        : fullBbox;

      const mapY = gridTop + 10;
      const mapH = 30 + numRows * rowH;
      const [minLon, minLat, maxLon, maxLat] = bbox;
      const cosLat = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
      const geoW = (maxLon - minLon) * cosLat;
      const geoH = maxLat - minLat;
      const pad = 30;
      const scale = Math.min((gridW - pad * 2) / geoW, (mapH - pad * 2) / geoH);
      const drawW = geoW * scale, drawH = geoH * scale;
      const offX = gridX + (gridW - drawW) / 2;
      const offY = mapY + (mapH - drawH) / 2;
      const project = (lon: number, lat: number): [number, number] => [
        offX + (lon - minLon) * cosLat * scale,
        offY + (maxLat - lat) * scale,
      ];
      const bboxDiag = Math.hypot(geoW, geoH) || 1;
      // Opacitat segons distància al focus: es manté ben visible a prop i es
      // difumina molt a poc a poc com més lluny — sense límit real (la
      // línia hi és fins allà on arribi la geometria, cada cop més tènue,
      // mai retallada de cop).
      function fadeOpacity(lon: number, lat: number, base: number) {
        if (!focus) return base * 0.6;
        const dx = (lon - focus.lon) * cosLat, dy = lat - focus.lat;
        const norm = Math.hypot(dx, dy) / (bboxDiag * 3.5);
        return Math.max(0.04, base * Math.exp(-norm * 1.6));
      }
      // Difuminat en espai de píxel (no geogràfic): perquè cap línia arribi
      // seca al marge del pòster ni quedi ben marcada al darrere de lletres
      // (ESCENARI, el mes, el comptador, el peu de pàgina) — s'apaga
      // suaument en els últims 300px abans d'arribar-hi.
      const FADE_DIST = 300;
      // Zones aproximades on hi ha text al pòster (x0,y0,x1,y1) — la
      // distància es calcula fins a la vora d'aquest rectangle, no fins al
      // seu centre, perquè la línia ja pugui passar-hi ben a prop pels
      // costats sense difuminar-se sense necessitat.
      const listTop = gridTop + 60 + numRows * rowH + 50;
      const textZones: [number, number, number, number][] = [
        [0, 60, W, 400],           // ESCENARI + mes + comptador
        [40, H - 100, 420, H - 30], // "fet amb escenari.app"
        [0, listTop - 20, W, H],   // "ON SONAREM" i les dates dels concerts
      ];
      function distToRect(px: number, py: number, [x0, y0, x1, y1]: [number, number, number, number]): number {
        const dx = Math.max(x0 - px, 0, px - x1);
        const dy = Math.max(y0 - py, 0, py - y1);
        return Math.hypot(dx, dy);
      }
      function pixelFade(px: number, py: number): number {
        const edge = Math.max(0, Math.min(1, Math.min(px, W - px, py, H - py) / FADE_DIST));
        let text = 1;
        for (const zone of textZones) {
          text = Math.min(text, Math.max(0, Math.min(1, distToRect(px, py, zone) / FADE_DIST)));
        }
        return edge * text;
      }
      // Traça una línia tram a tram (no d'una peça), cada tram amb la seva
      // pròpia opacitat segons on cau — així la vora es va apagant de veres
      // en comptes de tenir una opacitat plana d'una punta a l'altra.
      const c = ctx;
      // exclude: predicat punt-dins-polígon (no una caixa aproximada) — no es
      // dibuixa cap tram que hi caigui a dins. Fa servir la forma real del
      // territori a excloure, no un rectangle, perquè no es buidin ni es
      // trenquin zones que no toquen.
      function strokeFadingRing(ring: [number, number][], rgb: string, base: number, width: number, exclude?: (lon: number, lat: number) => boolean) {
        c.lineWidth = width;
        for (let i = 0; i < ring.length; i++) {
          const [lon1, lat1] = ring[i];
          const [lon2, lat2] = ring[(i + 1) % ring.length];
          const midLon = (lon1 + lon2) / 2, midLat = (lat1 + lat2) / 2;
          if (exclude?.(midLon, midLat)) continue;
          const [x1, y1] = project(lon1, lat1);
          const [x2, y2] = project(lon2, lat2);
          const op = fadeOpacity(midLon, midLat, base) * pixelFade((x1 + x2) / 2, (y1 + y2) / 2);
          if (op < 0.015) continue;
          c.strokeStyle = `rgba(${rgb},${op})`;
          c.beginPath();
          c.moveTo(x1, y1);
          c.lineTo(x2, y2);
          c.stroke();
        }
      }

      // Distància mínima d'un punt a qualsevol vèrtex d'un conjunt d'anells —
      // per detectar quan dos contorns simplificats per separat (p. ex. la
      // silueta d'Espanya i la de França) de fet tracen la mateixa frontera
      // real, encara que els seus punts no coincideixin exactament.
      function minDistToRings(lon: number, lat: number, rings: [number, number][][]): number {
        let best = Infinity;
        for (const r of rings) {
          for (const [rlon, rlat] of r) {
            const d = Math.hypot((lon - rlon) * cosLat, lat - rlat);
            if (d < best) best = d;
            if (best < 0.001) return best;
          }
        }
        return best;
      }
      const BORDER_SHARE_TOL = 0.07;

      // Països veïns (tots els d'Europa i el nord d'Àfrica): només la
      // línia de costa, difuminant-se cap al focus dels concerts — pur
      // context, mai s'hi dibuixa res a sobre (llevat que hi hagi un bolo,
      // com amb qualsevol altre país veí). On
      // la seva frontera coincideix
      // amb la d'Espanya (que ja es dibuixa a part), no es torna a traçar.
      NEIGHBOUR_COUNTRIES.forEach((n) => {
        const sharesSpainBorder = (lon: number, lat: number) => minDistToRings(lon, lat, MAP_REGIONS.espanya.rings) < BORDER_SHARE_TOL;
        n.rings.forEach((ring) => strokeFadingRing(ring, "170,195,220", 0.4, 1.4, sharesSpainBorder));
      });

      // La costa d'Espanya sencera, com un país veí més, quan la regió
      // mostrada és més petita (una comunitat sola o Països Catalans) — no
      // es dibuixa allà on ja hi cau la silueta de la regió principal (fa
      // servir el polígon real, no un rectangle, per no deixar-hi una línia
      // doble tan a prop com just al costat).
      if (mapRegion !== "espanya") {
        const insideMainRegion = (lon: number, lat: number) => MAP_REGIONS[mapRegion].rings.some((r) => pointInRing(lon, lat, r));
        MAP_REGIONS.espanya.rings.forEach((ring) => strokeFadingRing(ring, "170,195,220", 0.4, 1.4, insideMainRegion));
      }

      // La línia de costa: la silueta sencera de la regió triada (Catalunya,
      // Països Catalans, Espanya...), que ja és la unió geomètrica real de
      // les comunitats que l'integren — mai té costures internes ni entre
      // províncies ni entre comunitats autònomes veïnes. Només hi apareix,
      // doncs, la vora real: costa i frontera amb un altre país, ben visible
      // i difuminant-se cap als extrems del mapa. On ja hi ha territori actiu
      // (que dibuixa la seva pròpia vora ben marcada) no es repeteix la
      // costa — fa servir el polígon real de cada província activa, no una
      // caixa aproximada, perquè no es buidi ni es trenqui res sense motiu.
      const insideActiveTerritory = (lon: number, lat: number) =>
        domesticTerritories.some((p) => p.rings.some((r) => pointInRing(lon, lat, r))) ||
        activeNeighbours.some((n) => n.rings.some((r) => pointInRing(lon, lat, r))) ||
        activeNeighbourPlaces.some((p) => p.rings.some((r) => pointInRing(lon, lat, r)));
      MAP_REGIONS[mapRegion].rings.forEach((ring) => strokeFadingRing(ring, "220,230,245", 0.55, 1.6, insideActiveTerritory));

      // Les comunitats autònomes que sí que tenen algun bolo (encara que
      // només sigui en una de les seves províncies) mostren la seva
      // frontera sencera, ben visible i sense difuminar per distància — no
      // només la província concreta que té el bolo — perquè quedi clar tot
      // l'àmbit de la comunitat activa. S'exclou allà on ja hi ha la vora
      // d'una província activa per no repetir-la. Amb 2 o més països al
      // mapa aquest pas ja no cal: la comunitat sencera es farceix i es
      // ressalta més avall, així que aquesta vora blanca de context hi
      // quedaria doblada per sobre.
      if (!multiCountry) {
        ctx.lineWidth = 1.8;
        activeCcaas.forEach((ccaa) => {
          MAP_REGIONS[ccaa].rings.forEach((ring) => {
            for (let i = 0; i < ring.length; i++) {
              const [lon1, lat1] = ring[i];
              const [lon2, lat2] = ring[(i + 1) % ring.length];
              const midLon = (lon1 + lon2) / 2, midLat = (lat1 + lat2) / 2;
              if (insideActiveTerritory(midLon, midLat)) continue;
              const [x1, y1] = project(lon1, lat1);
              const [x2, y2] = project(lon2, lat2);
              const op = 0.5 * pixelFade((x1 + x2) / 2, (y1 + y2) / 2);
              if (op < 0.015) continue;
              ctx.strokeStyle = `rgba(255,255,255,${op})`;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          });
        });
      }

      // El territori amb bolos: farcit i vora ben marcada, sempre a sobre de
      // tota la resta. Es farceix cada província activa per separat (el
      // farcit no fa mai costura, encara que dues províncies veïnes siguin
      // totes dues actives) però la VORA només es traça allà on NO toca una
      // altra província activa — si no, la frontera compartida entre dues
      // províncies actives veïnes es dibuixaria dues vegades, un cop des de
      // cada banda.
      // Un bolo a l'estranger (per exemple l'Alguer, a Sardenya) fa que
      // aquell país veí es ressalti exactament igual que una província
      // activa — mai s'encaixa per força dins la província espanyola més
      // propera.
      ctx.fillStyle = accent + "3d";
      [...domesticTerritories, ...activeNeighbours, ...activeNeighbourPlaces].forEach((p) => {
        p.rings.forEach((ring) => {
          ctx.beginPath();
          ring.forEach(([lon, lat], i) => {
            const [px, py] = project(lon, lat);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.fill();
        });
      });
      ctx.strokeStyle = accent + "cc";
      ctx.lineWidth = 2.5;
      // "foreign" distingeix un país veí (o un indret concret seu) d'un
      // territori espanyol — mai s'exclou la vora entre l'un i l'altre
      // (és una frontera de veres, sempre visible encara que els dos
      // costats estiguin ressaltats), només entre dos territoris del
      // mateix costat (dues províncies veïnes, o dos països veïns). Com
      // que la silueta espanyola i la del país veí venen de fonts
      // diferents i no coincideixen mai al mil·límetre, per no dibuixar-la
      // doblada es dibuixa NOMÉS des del costat espanyol quan els dos
      // coincideixen — el país veí s'hi calla.
      const allActiveTerritories: { rings: [number, number][][]; foreign: boolean }[] = [
        ...domesticTerritories.map((p) => ({ ...p, foreign: false })),
        ...activeNeighbours.map((p) => ({ ...p, foreign: true })),
        ...activeNeighbourPlaces.map((p) => ({ ...p, foreign: true })),
      ];
      allActiveTerritories.forEach((p) => {
        const sameSideOthers = allActiveTerritories.filter((o) => o !== p && o.foreign === p.foreign);
        p.rings.forEach((ring) => {
          for (let i = 0; i < ring.length; i++) {
            const [lon1, lat1] = ring[i];
            const [lon2, lat2] = ring[(i + 1) % ring.length];
            const midLon = (lon1 + lon2) / 2, midLat = (lat1 + lat2) / 2;
            const excludedSameSide = sameSideOthers.some((o) => o.rings.some((r) => pointInRing(midLon, midLat, r)));
            const excludedCrossBorder = p.foreign && domesticTerritories.some((d) => minDistToRings(midLon, midLat, d.rings) < BORDER_SHARE_TOL);
            if (excludedSameSide || excludedCrossBorder) continue;
            const [x1, y1] = project(lon1, lat1);
            const [x2, y2] = project(lon2, lat2);
            ctx.globalAlpha = pixelFade((x1 + x2) / 2, (y1 + y2) / 2);
            if (ctx.globalAlpha < 0.015) continue;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        });
      });
      ctx.globalAlpha = 1;

      // Es dibuixen totes les xinxetes primer i els "×N" en una segona passada
      // a part, per sobre de totes — així cap pin, per molt a prop que quedi,
      // pot tapar mai el número d'una altra.
      ctx.textAlign = "center";
      const rawPins = Array.from(pinAgg.values()).map(({ sumLon, sumLat, count }) => {
        const [px, py] = project(sumLon / count, sumLat / count);
        return { px, py, count };
      });
      const pins = mergeOverlappingPins(rawPins, 32);
      // La xinxeta es dibuixa desplaçada cap amunt respecte al punt real
      // (px, py): la punta (on abans hi havia el cos rodó) ha de caure just
      // a sobre de la ciutat, no per sota.
      pins.forEach(({ px, py }) => {
        ctx.save();
        ctx.shadowColor = accent;
        ctx.shadowBlur = 20;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(px, py - 23, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(px - 8, py - 15);
        ctx.lineTo(px + 8, py - 15);
        ctx.lineTo(px, py);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#0b0a14";
        ctx.beginPath();
        ctx.arc(px, py - 23, 6, 0, Math.PI * 2);
        ctx.fill();
      });
      // Cada "×N" prova unes quantes posicions al voltant de la seva xinxeta
      // (a sobre, a sota, als costats...) i es queda amb la primera que no
      // xoqui amb cap altra xinxeta ni amb un número ja col·locat — mai es
      // tapa, es mou.
      ctx.font = "700 20px Inter, sans-serif";
      const placedBadges: { x0: number; y0: number; x1: number; y1: number }[] = [];
      function rectHitsCircle(rect: { x0: number; y0: number; x1: number; y1: number }, cx: number, cy: number, r: number) {
        const nx = Math.max(rect.x0, Math.min(cx, rect.x1));
        const ny = Math.max(rect.y0, Math.min(cy, rect.y1));
        return Math.hypot(cx - nx, cy - ny) < r;
      }
      function rectHitsRect(a: { x0: number; y0: number; x1: number; y1: number }, b: typeof a) {
        return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      }
      pins.forEach(({ px, py, count }) => {
        if (count <= 1) return;
        const label = "×" + count;
        const w = ctx.measureText(label).width;
        const candidates: [number, number][] = [
          [px, py - 53], [px, py + 23], [px - 30, py - 23], [px + 30, py - 23],
          [px, py - 73], [px - 30, py - 43], [px + 30, py - 43], [px - 30, py - 3], [px + 30, py - 3],
        ];
        let chosen = candidates[0];
        for (const [cx, cy] of candidates) {
          const rect = { x0: cx - w / 2 - 3, y0: cy - 17, x1: cx + w / 2 + 3, y1: cy + 5 };
          const hitsPin = pins.some((p) => rectHitsCircle(rect, p.px, p.py - 23, 18));
          const hitsBadge = placedBadges.some((b) => rectHitsRect(rect, b));
          chosen = [cx, cy];
          if (!hitsPin && !hitsBadge) { placedBadges.push(rect); break; }
          if (cx === candidates[candidates.length - 1][0] && cy === candidates[candidates.length - 1][1]) placedBadges.push(rect);
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, chosen[0], chosen[1]);
      });
      ctx.textAlign = "left";
    }

    // Llista de concerts: hi surten TOTS, mai es retalla — si no caben amb
    // l'espaiat còmode es reparteixen en més columnes i s'encongeixen fins
    // que hi càpiguen.
    if (showList && posterConcerts.length) {
      const listTop = gridTop + 60 + numRows * rowH + 50;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "600 26px Inter, sans-serif";
      ctx.letterSpacing = "6px";
      ctx.fillText("ON SONAREM", 72, listTop);
      ctx.letterSpacing = "0px";

      const total = posterConcerts.length;
      const availableH = H - listTop - 60 - 90;
      const comfortRowGap = 88;
      const minRowGap = 30;
      let cols = 1;
      while (cols < 4 && Math.ceil(total / cols) * minRowGap > availableH) cols++;
      const rowsPerCol = Math.ceil(total / cols);
      const rowGap = Math.min(comfortRowGap, availableH / rowsPerCol);
      const colGap = 24;
      const colW = (W - 144 - colGap * (cols - 1)) / cols;
      const compact = rowGap < 70;

      for (let i = 0; i < total; i++) {
        const c = posterConcerts[i];
        const col = Math.floor(i / rowsPerCol);
        const rowInCol = i % rowsPerCol;
        const x0 = 72 + col * (colW + colGap);
        const yy = listTop + 60 + rowInCol * rowGap;
        // Amb un sol mes n'hi ha prou amb el dia; amb un període més ampli
        // (on els concerts poden ser de mesos diferents) cal el mes també,
        // que si no la data surt ambigua.
        const dateLabel = period === "1m" ? c.date.slice(8, 10) : `${c.date.slice(8, 10)}.${c.date.slice(5, 7)}`;
        const isTba = tbaIds.has(c.id);
        const place = isTba ? "TBA" : (c.city || c.venue || "").split(",")[0];
        const festa = isTba ? "" : c.festaEntitat;

        if (!compact) {
          drawRoundRect(ctx, x0, yy - 40, 84, 58, 14);
          ctx.fillStyle = accent + "2e";
          ctx.fill();
          ctx.fillStyle = accent;
          let dateBoxFont = 34;
          ctx.font = `700 ${dateBoxFont}px 'Space Grotesk', sans-serif`;
          while (ctx.measureText(dateLabel).width > 68 && dateBoxFont > 16) {
            dateBoxFont -= 2;
            ctx.font = `700 ${dateBoxFont}px 'Space Grotesk', sans-serif`;
          }
          ctx.textAlign = "center";
          ctx.fillText(dateLabel, x0 + 42, yy + 2);
          ctx.textAlign = "left";
          const maxPlaceW = colW - 118;
          // Població en negreta: sempre sencera.
          ctx.fillStyle = "#ffffff";
          ctx.font = "700 34px 'Space Grotesk', sans-serif";
          ctx.fillText(abbreviatePlace(ctx, place, maxPlaceW), x0 + 118, yy);
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          const restFont2 = "400 27px Inter, sans-serif";
          ctx.fillText(pickBandFesta(ctx, c.bandName, festa, restFont2, maxPlaceW), x0 + 118, yy + 36);
        } else {
          // Format compacte a una línia: data + població (negreta) + grup,
          // mida de lletra proporcional a l'espai que quedi per fila.
          const dateFont = Math.max(13, Math.min(30, rowGap - 12));
          const placeFont = Math.max(13, Math.min(27, rowGap - 12));
          const textFont = Math.max(12, Math.min(26, rowGap - 14));
          ctx.fillStyle = accent;
          ctx.font = `700 ${dateFont}px 'Space Grotesk', sans-serif`;
          ctx.textAlign = "left";
          ctx.fillText(dateLabel, x0, yy);
          const dateW = ctx.measureText(period === "1m" ? "00" : "00.00").width + 14;

          // Població, en negreta i sempre sencera.
          ctx.font = `700 ${placeFont}px 'Space Grotesk', sans-serif`;
          ctx.fillStyle = "#ffffff";
          const placeMaxW = colW - dateW;
          const placeText = abbreviatePlace(ctx, place, placeMaxW);
          ctx.fillText(placeText, x0 + dateW, yy);
          const placeW = ctx.measureText(placeText).width;

          // Grup (sí o sí) + festa (només si hi cap sencera).
          const sep = "  ·  ";
          ctx.font = `600 ${textFont}px Inter, sans-serif`;
          const sepW = ctx.measureText(sep).width;
          const restMaxW = colW - dateW - placeW - sepW;
          if (restMaxW > 6) {
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ctx.fillText(sep, x0 + dateW + placeW, yy);
            ctx.fillText(pickBandFesta(ctx, c.bandName, festa, `600 ${textFont}px Inter, sans-serif`, restMaxW), x0 + dateW + placeW + sepW, yy);
          }
        }
      }
    }

    // Peu.
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "500 26px Inter, sans-serif";
    ctx.fillText("fet amb escenari.app", 72, H - 64);
  }, [monthIdx, year, period, customStartMonthIdx, customStartYear, startMonthIdx, startYear, endMonthIdx, endYear, accent, showList, monthConcerts, posterConcerts, tbaIds, bands, mode, concerts, today, effectiveViewMode, mapRegion, cityCoords]);

  async function toBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }

  async function handleDownload() {
    setBusy(true);
    const blob = await toBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `escenari-${rangeSlug}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setBusy(false);
  }

  async function handleShare() {
    setBusy(true);
    const blob = await toBlob();
    if (blob && navigator.share && navigator.canShare?.({ files: [new File([blob], "escenari.png", { type: "image/png" })] })) {
      try {
        await navigator.share({ files: [new File([blob], `escenari-${rangeSlug}.png`, { type: "image/png" })] });
      } catch { /* cancel·lat */ }
    } else {
      await handleDownload();
    }
    setBusy(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-month-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Comparteix el mes</div>
          <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={onClose}>✕</button>
        </div>
        <div className="share-month-body">
          <div className={"share-month-preview-wrap" + (mode === "poster" ? " poster-preview" : "")}>
            <canvas ref={canvasRef} width={W} height={H} className="share-month-canvas" />
          </div>
          <div className="share-month-controls">
            <div className="stats-tabs" style={{ alignSelf: "flex-start" }}>
              <button className={"stats-tab" + (mode === "story" ? " active" : "")} onClick={() => setMode("story")}>Story del mes</button>
              <button className={"stats-tab" + (mode === "poster" ? " active" : "")} onClick={() => setMode("poster")}>Pòster transparent</button>
            </div>
            {mode === "poster" && (
              <div className="t-dim" style={{ fontSize: 12.5 }}>
                PNG amb fons transparent: posa&apos;l sobre una foto vostra a Instagram. Títol gran + els pròxims concerts (data, hora i lloc).
              </div>
            )}
            {mode === "story" && (
            <>
            <div className="stats-tabs share-month-period-tabs" style={{ alignSelf: "flex-start" }}>
              {PERIOD_OPTIONS.map((p) => (
                <button key={p} className={"stats-tab" + (period === p ? " active" : "")} onClick={() => setPeriod(p)}>{PERIOD_LABELS[p]}</button>
              ))}
            </div>
            <div className="share-month-nav">
              {period === "1m" && <button className="cal-nav-btn" onClick={() => shiftMonth(-1)}>‹</button>}
              <span className="share-month-label">{navLabel}</span>
              {period === "1m" && <button className="cal-nav-btn" onClick={() => shiftMonth(1)}>›</button>}
            </div>
            {period === "custom" && (
              <div className="share-month-timeline">
                <div className="share-month-timeline-nav">
                  <button className="cal-nav-btn" disabled={timelineYear <= yearRangeMin} onClick={() => setTimelineYear((y) => Math.max(yearRangeMin, y - 1))}>‹</button>
                  <span className="share-month-timeline-year">{timelineYear}</span>
                  <button className="cal-nav-btn" disabled={timelineYear >= yearRangeMax} onClick={() => setTimelineYear((y) => Math.min(yearRangeMax, y + 1))}>›</button>
                </div>
                <div className="share-month-timeline-months">
                  {MONTH_FULL.map((m, mi) => {
                    const ym = timelineYear * 12 + mi;
                    const inRange = ym >= startYm && ym <= endYm;
                    const isEdge = ym === startYm || ym === endYm;
                    const isAnchor = ym === rangeAnchorYm;
                    return (
                      <button
                        key={mi}
                        type="button"
                        className={"share-month-timeline-cell" + (inRange ? " in-range" : "") + (isEdge ? " edge" : "") + (isAnchor ? " anchor" : "")}
                        onClick={() => handleTimelineCellClick(ym)}
                        title={`${m} ${timelineYear}`}
                      >
                        {m.slice(0, 1)}
                      </button>
                    );
                  })}
                </div>
                <div className="t-dim" style={{ fontSize: 12 }}>
                  {rangeAnchorYm === null
                    ? "Clica el mes d'inici."
                    : "Ara clica el mes final — canvia d'any amb les fletxes si cal."}
                </div>
              </div>
            )}
            {period === "1m" ? (
              <div className="stats-tabs">
                <button className={"stats-tab" + (viewMode === "calendari" ? " active" : "")} onClick={() => setViewMode("calendari")}>Calendari</button>
                <button className={"stats-tab" + (viewMode === "mapa" ? " active" : "")} onClick={() => setViewMode("mapa")}>Mapa</button>
              </div>
            ) : (
              <div className="t-dim" style={{ fontSize: 12.5 }}>
                Amb més d&apos;un mes seleccionat sempre es mostra el mapa.
              </div>
            )}
            {effectiveViewMode === "mapa" && (
              <div className="t-dim" style={{ fontSize: 12.5 }}>
                {geocoding ? (
                  "Localitzant les poblacions…"
                ) : (
                  <>Mapa de <strong>{MAP_REGIONS[mapRegion].label}</strong> — es tria sol segons on són els bolos del període.</>
                )}
                {!geocoding && posterConcerts.some((c) => c.city) && posterConcerts.every((c) => !c.city || cityCoords[c.city] === null) && (
                  <div style={{ color: "oklch(0.75 0.16 50)", marginTop: 4 }}>
                    No s&apos;ha pogut localitzar cap població ara mateix (servei extern no disponible) — torna-ho a provar d&apos;aquí una estona.
                  </div>
                )}
              </div>
            )}
            <div className="share-month-accents">
              {ACCENTS.map((a) => (
                <button key={a} type="button" className={"share-accent-dot" + (accent === a ? " active" : "")} style={{ background: a }} onClick={() => setAccent(a)} aria-label={a} />
              ))}
            </div>
            <label className="share-month-toggle">
              <input type="checkbox" checked={showList} onChange={(e) => setShowList(e.target.checked)} />
              Mostra la llista de bolos
            </label>
            {monthConcerts.length > 0 && (
              <div className="share-month-picklist">
                {monthConcerts.map((c) => {
                  const excluded = excludedIds.has(c.id);
                  const [, mm, dd] = c.date.split("-");
                  const place = (c.city || c.venue || "").split(",")[0];
                  return (
                    <div key={c.id} className={"share-month-pick-row" + (excluded ? " excluded" : "")}>
                      <label className="share-month-pick-main">
                        <input type="checkbox" checked={!excluded} onChange={() => toggleExcluded(c.id)} />
                        <span className="share-month-pick-label">{dd}/{mm} · {place} · {c.bandName}</span>
                      </label>
                      <label className="share-month-pick-tba">
                        <input type="checkbox" checked={tbaIds.has(c.id)} disabled={excluded} onChange={() => toggleTba(c.id)} />
                        TBA
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
            </>
            )}
            <div className="share-month-actions">
              <button type="button" className="btn-outline" disabled={busy} onClick={handleDownload}>Descarrega PNG</button>
              <button type="button" className="btn-save" disabled={busy} onClick={handleShare}>Comparteix</button>
            </div>
            <div className="t-dim" style={{ fontSize: 12 }}>
              {mode === "poster" ? "1080×1920 amb transparència — llest per a la story." : "1080×1920 — perfecte com a story o fons de pantalla."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
