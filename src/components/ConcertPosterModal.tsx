"use client";

import { useEffect, useRef, useState } from "react";
import type { Concert, Band } from "@/lib/types";
import { MONTH_FULL } from "@/lib/format";
import { getStreetWaysAction, savePosterScheduleAction } from "@/app/(app)/concerts/actions";

// Pòster del concert per a Instagram: PNG 1080×1920 amb fons transparent,
// tipografia gran de cartell i un mini-mapa amb la ubicació marcada
// (geocodificació Photon + geometria real de carrers via Overpass,
// dibuixats amb estil neó propi — no depenem de cap servei de rajoles
// d'imatge, que es bloquegen o mostren marca d'aigua sense compte/clau; si
// falla, marcador estilitzat).

const W = 1080;
const H = 1920;
// Radi (en metres) de carrers que es demanen al voltant del concert.
const MAP_RADIUS_M = 900;
// Mateixa paleta que el mapa del resum mensual dels bolos (ShareMonthModal).
const ACCENTS = ["#8b7bff", "#38E1C6", "#FFD400", "#FF5A36", "#FF3D8A"];

// Posició exacta (x, y, angle) de la primera lletra d'un text que es
// dibuixarà amb drawArcText (mateixos càlculs de radi/angle) — per poder
// alinear-hi altres elements (com la xinxeta al costat de la ubicació)
// amb precisió, i no amb una posició aproximada.
function arcTextStartPos(c: CanvasRenderingContext2D, text: string, cx: number, topY: number, radius: number, font: string): { x: number; y: number; angle: number } {
  c.save();
  c.font = font;
  const chars = Array.from(text);
  const widths = chars.map((ch) => c.measureText(ch).width);
  c.restore();
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const totalAngle = totalWidth / radius;
  let angle = -totalAngle / 2 + (widths[0] || 0) / radius / 2;
  const circleCy = topY + radius;
  return { x: cx + radius * Math.sin(angle), y: circleCy - radius * Math.cos(angle), angle };
}

// Text al llarg d'un arc (per a la ubicació, just a sobre del mapa, una
// mica corbada) — cada caràcter es posiciona i es gira al seu propi angle
// al voltant d'un cercle molt gran, perquè la corba final sigui suau.
function drawArcText(c: CanvasRenderingContext2D, text: string, cx: number, topY: number, radius: number, font: string, color: string) {
  c.save();
  c.font = font;
  c.fillStyle = color;
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  const chars = Array.from(text);
  const widths = chars.map((ch) => c.measureText(ch).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const totalAngle = totalWidth / radius;
  let angle = -totalAngle / 2;
  const circleCy = topY + radius;
  chars.forEach((ch, i) => {
    const chAngle = widths[i] / radius;
    angle += chAngle / 2;
    const x = cx + radius * Math.sin(angle);
    const y = circleCy - radius * Math.cos(angle);
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.fillText(ch, 0, 0);
    c.restore();
    angle += chAngle / 2;
  });
  c.restore();
}

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const c = data.features?.[0]?.geometry?.coordinates;
    return c ? { lat: c[1], lon: c[0] } : null;
  } catch { return null; }
}

type PosterScheduleItem = { time: string; label: string; isOwn?: boolean };

export default function ConcertPosterModal({ concert, band, onClose }: { concert: Concert; band: Band | null; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [mapStatus, setMapStatus] = useState("carregant el mapa…");
  const [accent, setAccent] = useState(band?.color1 || ACCENTS[0]);
  // Hora(es) que surten al pòster: comença amb la del concert (l'oficial,
  // marcada amb isOwn perquè sigui l'única amb l'estil gros i en neó) però
  // es pot editar i se n'hi poden afegir més abans/després (sense isOwn,
  // amb un estil més discret), per si el mateix dia hi ha altres
  // actuacions. Si ja hi havia horaris desats per aquest concert, es parteix
  // d'aquells en comptes de tornar a generar el per defecte.
  const [scheduleItems, setScheduleItems] = useState<PosterScheduleItem[]>(
    concert.posterSchedule?.length
      ? concert.posterSchedule
      : [{ time: concert.time || "", label: concert.bandName || "", isOwn: true }]
  );
  const scheduleFirstRender = useRef(true);
  const scheduleSaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (scheduleFirstRender.current) { scheduleFirstRender.current = false; return; }
    if (scheduleSaveTimer.current) window.clearTimeout(scheduleSaveTimer.current);
    scheduleSaveTimer.current = window.setTimeout(() => {
      savePosterScheduleAction(concert.id, scheduleItems);
    }, 700);
    return () => { if (scheduleSaveTimer.current) window.clearTimeout(scheduleSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleItems]);
  function updateScheduleItem(i: number, patch: Partial<PosterScheduleItem>) {
    setScheduleItems((items) => items.map((it, xi) => (xi === i ? { ...it, ...patch } : it)));
  }
  function addScheduleItem(at: "before" | "after") {
    setScheduleItems((items) => (at === "before" ? [{ time: "", label: "" }, ...items] : [...items, { time: "", label: "" }]));
  }
  function removeScheduleItem(i: number) {
    setScheduleItems((items) => items.filter((_, xi) => xi !== i));
  }

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cream = "#f4efe4";

    async function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 24;

      // Població, en una sola línia — títol principal del pòster. En
      // comptes d'apilar-la en diverses línies, s'encongeix tant com calgui
      // fins que hi càpiga sencera.
      const cityName = (concert.city?.split(",")[0] || "Concert").toUpperCase();
      ctx.fillStyle = cream;
      let citySize = 160;
      ctx.font = `700 ${citySize}px 'Space Grotesk', sans-serif`;
      while (ctx.measureText(cityName).width > W - 110 && citySize > 48) {
        citySize -= 4;
        ctx.font = `700 ${citySize}px 'Space Grotesk', sans-serif`;
      }
      let ty = 300;
      ctx.fillText(cityName, W / 2, ty);
      ty += citySize * 0.95;

      // El dia, a sota de la població (sense el nom del dia de la setmana).
      const [yy, mm, dd] = concert.date.split("-").map(Number);
      const monthName = MONTH_FULL[mm - 1];
      const monthArticle = /^[aeiouàéèíòóú]/i.test(monthName) ? "d'" : "de ";
      const dateText = `${dd} ${monthArticle}${monthName} ${yy}`;
      ctx.font = "italic 500 44px Inter, sans-serif";
      ctx.fillStyle = "rgba(244,239,228,0.9)";
      ctx.fillText(dateText, W / 2, ty + 40);

      // Horaris (l'oficial i els que s'hi hagin afegit per altres
      // actuacions), a l'esquerra de tot i centrats verticalment com a
      // bloc sencer — només el grup del concert (isOwn) es mostra gros i
      // vistós amb l'hora en el color neó del mapa; els altres, si n'hi ha,
      // van amb un estil més discret perquè no competeixin amb el propi.
      const scheduleRows = scheduleItems.filter((it) => it.time || it.label);
      if (scheduleRows.length) {
        ctx.textAlign = "left";
        const lineH = 64;
        const startY = H / 2 - ((scheduleRows.length - 1) * lineH) / 2;
        scheduleRows.forEach((it, i) => {
          const y = startY + i * lineH;
          let x = 72;
          if (it.isOwn) {
            if (it.time) {
              ctx.font = "700 40px 'Space Grotesk', sans-serif";
              ctx.save();
              ctx.shadowColor = accent;
              ctx.shadowBlur = 16;
              ctx.fillStyle = accent;
              const timeStr = `${it.time}h`;
              ctx.fillText(timeStr, x, y);
              ctx.restore();
              x += ctx.measureText(timeStr).width + 14;
            }
            if (it.label) {
              ctx.font = "800 46px 'Space Grotesk', sans-serif";
              ctx.fillStyle = cream;
              ctx.fillText(it.label, x, y);
            }
          } else {
            const line = [it.time ? `${it.time}h` : "", it.label].filter(Boolean).join(" · ");
            ctx.font = "600 30px Inter, sans-serif";
            ctx.fillStyle = "rgba(244,239,228,0.65)";
            ctx.fillText(line, x, y);
          }
        });
        ctx.textAlign = "center";
      }

      // Mini-mapa: carrers en neó (tenyits amb el color d'accent del grup i
      // amb resplendor), sense cap cercle ni vora — es dilueix cap al fons
      // del pòster amb una màscara radial de transparència, en comptes de
      // quedar retallat en sec dins d'un cercle.
      const mapCx = W / 2, mapCy = H - 430;
      const mapSize = 680;

      // Ubicació, enganxada al mapa (a sobre de tot) i una mica corbada
      // (com un arc molt suau, ja que fem servir un radi molt gran), amb
      // una xinxeta petita al costat.
      if (concert.venue) {
        const venueText = concert.venue.toUpperCase();
        const venueFont = "700 34px 'Space Grotesk', sans-serif";
        const venueY = mapCy - mapSize / 2 + 34;
        // Posició exacta de la primera lletra sobre l'arc, perquè la
        // xinxeta hi quedi perfectament alineada (no una aproximació amb
        // l'amplada en línia recta, que no té en compte la corba).
        const firstChar = arcTextStartPos(ctx, venueText, mapCx, venueY, 1700, venueFont);
        const iconX = firstChar.x - 24, iconY = firstChar.y - 12;
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(iconX, iconY, 9, 0, Math.PI * 2);
        ctx.moveTo(iconX - 5, iconY + 4);
        ctx.lineTo(iconX + 5, iconY + 4);
        ctx.lineTo(iconX, iconY + 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(iconX, iconY, 6.5, 0, Math.PI * 2);
        ctx.moveTo(iconX - 3.2, iconY + 3);
        ctx.lineTo(iconX + 3.2, iconY + 3);
        ctx.lineTo(iconX, iconY + 9.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        drawArcText(ctx, venueText, mapCx, venueY, 1700, venueFont, cream);
      }

      let drewMap = false;
      const q = [concert.venue, concert.city].filter(Boolean).join(", ");
      if (q) {
        const geo = await geocode(q);
        if (geo && !cancelled) {
          const { ways } = await getStreetWaysAction(geo.lat, geo.lon, MAP_RADIUS_M);
          if (!cancelled && ways.length) {
            // Projecció local senzilla centrada al punt del concert
            // (equirectangular amb correcció de cos(lat), com ja fa servir
            // la resta de l'app per a mapes petits): en una àrea tan
            // reduïda la distorsió és imperceptible. L'escala es dedueix
            // del mateix radi (en metres) que s'ha demanat a l'acció, per
            // omplir bé el quadrat sense números arbitraris.
            const centerLon = geo.lon, centerLat = geo.lat;
            const cosLat = Math.cos((centerLat * Math.PI) / 180);
            const dLatAtRadius = MAP_RADIUS_M / 111320; // graus de latitud que cobreix el radi demanat
            const scale = (mapSize / 2) / dLatAtRadius; // px per grau de latitud (i de longitud ja corregida per cos(lat))
            function project(lon: number, lat: number): [number, number] {
              return [
                mapSize / 2 + (lon - centerLon) * cosLat * scale,
                mapSize / 2 - (lat - centerLat) * scale,
              ];
            }

            // Es dibuixen els carrers grans (avingudes) i els petits en
            // dos mosaics a part, només perquè cadascun pugui tenir el seu
            // propi radi de dissolució: els grans continuen el seu traçat
            // una mica més enllà del bassal principal abans d'apagar-se
            // del tot — els petits es queden més continguts. Tots brillen
            // per igual (mateix gruix, mateixa resplendor petita i suau),
            // enganxada a cada línia (no difuminant tot el mosaic): així
            // la llum només s'enganxa als carrers mateixos, sense
            // escampar-se com un núvol de fons sobre les zones buides (com
            // el mar o un parc).
            function drawWays(list: { highway: string; pts: [number, number][] }[]): HTMLCanvasElement {
              const c = document.createElement("canvas");
              c.width = mapSize; c.height = mapSize;
              const bctx = c.getContext("2d");
              if (bctx) {
                bctx.strokeStyle = accent;
                bctx.lineCap = "round";
                bctx.lineJoin = "round";
                bctx.lineWidth = 2;
                list.forEach((w) => {
                  bctx.beginPath();
                  w.pts.forEach(([lon, lat], i) => {
                    const [x, y] = project(lon, lat);
                    if (i === 0) bctx.moveTo(x, y); else bctx.lineTo(x, y);
                  });
                  bctx.stroke();
                });
              }
              return c;
            }
            // "Major" també inclou passeigs/rambles (pedestrian/living_street) —
            // sovint segueixen la costa sencera i, com que Overpass no ens
            // dona la línia de costa mateixa (natural=coastline; només
            // demanem highway=*), és el camí vora mar que en fa la funció
            // visualment. Amb el mateix tractament que les avingudes,
            // també es dilueix a poc a poc en comptes de tallar-se en sec.
            const isMajor = (w: { highway: string }) => /^(motorway|trunk|primary|secondary|pedestrian|living_street)/.test(w.highway);
            const baseMinor = drawWays(ways.filter((w) => !isMajor(w)));
            const baseMajor = drawWays(ways.filter(isMajor));

            // Cada mosaic (petit/gran) es munta en el SEU propi canvas
            // aïllat del pòster — així la màscara de transparència
            // (destination-in) només hi afecta aquest mapa i mai el text
            // ja dibuixat al pòster, ni l'altre mosaic (si compartissin un
            // mateix canvas, la segona màscara tornaria a atenuar el que
            // ja havia dissolt la primera).
            function paintLayer(img: HTMLCanvasElement, outerFrac: number): HTMLCanvasElement {
              const layer = document.createElement("canvas");
              layer.width = W; layer.height = H;
              const lctx = layer.getContext("2d");
              if (!lctx) return layer;
              lctx.drawImage(img, mapCx - mapSize / 2, mapCy - mapSize / 2, mapSize, mapSize);
              // El radi extern es queda ben per dins de la meitat de
              // mapSize (on el mosaic dibuixat s'acaba en sec) perquè la
              // dissolució s'acabi de veres abans d'arribar-hi.
              lctx.globalCompositeOperation = "destination-in";
              const fade = lctx.createRadialGradient(mapCx, mapCy, 0, mapCx, mapCy, mapSize * outerFrac);
              fade.addColorStop(0, "rgba(255,255,255,1)");
              fade.addColorStop(0.25, "rgba(255,255,255,0.92)");
              fade.addColorStop(0.5, "rgba(255,255,255,0.66)");
              fade.addColorStop(0.7, "rgba(255,255,255,0.38)");
              fade.addColorStop(0.85, "rgba(255,255,255,0.15)");
              fade.addColorStop(1, "rgba(255,255,255,0)");
              lctx.fillStyle = fade;
              lctx.fillRect(mapCx - mapSize, mapCy - mapSize, mapSize * 2, mapSize * 2);
              return layer;
            }
            // Els carrers grans continuen el seu traçat una mica més enllà
            // del bassal principal (radi extern més gran) abans de
            // dissoldre's del tot; els petits es queden més continguts.
            const minorLayer = paintLayer(baseMinor, 0.4);
            const majorLayer = paintLayer(baseMajor, 0.49);

            // Es dibuixen normalment (no en mode additiu) sobre el pòster:
            // les dues capes són transparents de veres allà on no hi ha
            // cap carrer, així que no calia sumar-les — i sumar-les feia
            // que als encreuaments entre un carrer "gran" (el passeig, per
            // exemple) i un "petit" que el creués, la brillantor de tots
            // dos es sumés, sobreexposant-se localment; en reduir-se la
            // mida de previsualització, aquests punts massa clars es
            // difuminaven visualment com si fos un resplendor de fons, per
            // exemple allà on el passeig marítim creua molts carrers a
            // prop de la platja.
            ctx.drawImage(minorLayer, 0, 0);
            ctx.drawImage(majorLayer, 0, 0);

            drewMap = true;
            setMapStatus("");
          }
        }
      }
      if (!drewMap) {
        // Resguard: bassal de llum de l'accent que ja es dilueix sol.
        ctx.save();
        const glow = ctx.createRadialGradient(mapCx, mapCy, 0, mapCx, mapCy, mapSize * 0.42);
        glow.addColorStop(0, accent + "70");
        glow.addColorStop(0.4, accent + "48");
        glow.addColorStop(0.7, accent + "1c");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(mapCx - mapSize, mapCy - mapSize, mapSize * 2, mapSize * 2);
        ctx.restore();
        setMapStatus("mapa no disponible — marcador estilitzat");
      }
      // Xinxeta allà on serà el concert — com la del mapa del resum
      // mensual dels bolos, però en un to més fosc del color d'accent i
      // amb una vora blanca neta perquè es distingeixi clarament sigui
      // quin sigui el fons, sense cap resplendor difuminada. La vora es fa
      // dibuixant primer la mateixa silueta (cap + punta) una mica més
      // grossa en blanc per sota, no fent "stroke" del contorn combinat
      // (el cap i el triangle es tallen per dins, i el "stroke" hi deixava
      // una línia estranya travessant el cap).
      const pinColor = accent;
      const pinTipY = mapCy;
      function pinSilhouette(headR: number, halfW: number, tipOffset: number) {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(mapCx, pinTipY - 23, headR, 0, Math.PI * 2);
        ctx.moveTo(mapCx - halfW, pinTipY - 15);
        ctx.lineTo(mapCx + halfW, pinTipY - 15);
        ctx.lineTo(mapCx, pinTipY + tipOffset);
        ctx.closePath();
        ctx.fill();
      }
      ctx.save();
      ctx.fillStyle = "#ffffff";
      pinSilhouette(19, 11, 3);
      ctx.fillStyle = pinColor;
      pinSilhouette(16, 8, 0);
      ctx.restore();
      ctx.fillStyle = "#0b0a14";
      ctx.beginPath();
      ctx.arc(mapCx, pinTipY - 23, 6, 0, Math.PI * 2);
      ctx.fill();

      // Peu
      ctx.shadowBlur = 24;
      ctx.font = "600 28px Inter, sans-serif";
      ctx.fillStyle = "rgba(244,239,228,0.75)";
      ctx.fillText("@escenari.app", W / 2, H - 70);
      ctx.shadowBlur = 0;
    }

    draw().catch((err) => console.error("ConcertPosterModal: error dibuixant el pòster", err));
    return () => { cancelled = true; };
    // El pare (ConcertDetailView) reconstrueix l'objecte "concert" a cada
    // render seu (liveConcert = {...concert, ...cf, ...}), així que fer
    // servir concert/band sencers com a dependències feia que qualsevol
    // render del pare —per exemple un altre camp autodesant-se en segon
    // pla— cancel·lés i tornés a engegar aquest efecte a mig fer, sense
    // temps mai d'acabar la consulta d'Overpass (uns quants segons). Es
    // depèn només dels valors que realment afecten el dibuix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concert.id, concert.bandName, concert.date, concert.time, concert.venue, concert.city, band?.id, accent, scheduleItems]);

  async function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const c = canvasRef.current;
      if (!c) return resolve(null);
      try {
        c.toBlob((b) => resolve(b), "image/png");
      } catch {
        // Canvas "tainted" (una rajola del mapa sense CORS): no es pot exportar.
        resolve(null);
      }
    });
  }

  async function handleDownload() {
    setBusy(true);
    const blob = await toBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `poster-${concert.date}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert("No s'ha pogut exportar (el mapa extern ho impedeix?). Torna-ho a provar.");
    }
    setBusy(false);
  }

  async function handleShare() {
    setBusy(true);
    const blob = await toBlob();
    if (blob) {
      const file = new File([blob], "poster.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); } catch { /* cancel·lat */ }
      } else await handleDownload();
    }
    setBusy(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-month-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Pòster del concert</div>
          <button className="cf-head-close" onClick={onClose}>✕</button>
        </div>
        <div className="share-month-body">
          <div className="share-month-preview-wrap poster-preview">
            <canvas ref={canvasRef} width={W} height={H} className="share-month-canvas" />
          </div>
          <div className="share-month-controls">
            <div className="t-dim" style={{ fontSize: 13 }}>
              PNG 1080×1920 amb fons transparent: nom, data, hora, lloc i el mini-mapa amb el punt marcat.
              Posa&apos;l sobre una foto vostra a la story d&apos;Instagram.
            </div>
            {mapStatus && <div className="t-dim" style={{ fontSize: 12 }}>{mapStatus}</div>}
            <div>
              <button type="button" className="link-btn" style={{ marginBottom: 6 }} onClick={() => addScheduleItem("before")}>+ Afegeix abans</button>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {scheduleItems.map((it, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="time" className="field-input compact-field" style={{ width: 100, flex: "none" }}
                      value={it.time} onChange={(e) => updateScheduleItem(i, { time: e.target.value })} />
                    <input type="text" className="field-input compact-field" style={{ flex: 1, minWidth: 0 }} placeholder="Grup / actuació"
                      value={it.label} onChange={(e) => updateScheduleItem(i, { label: e.target.value })} />
                    <button type="button" className="row-delete-btn" title="Elimina" onClick={() => removeScheduleItem(i)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="link-btn" style={{ marginTop: 6 }} onClick={() => addScheduleItem("after")}>+ Afegeix després</button>
            </div>
            <div className="share-month-accents">
              {ACCENTS.map((a) => (
                <button key={a} type="button" className={"share-accent-dot" + (accent === a ? " active" : "")} style={{ background: a }} onClick={() => setAccent(a)} aria-label={a} />
              ))}
            </div>
            <div className="share-month-actions">
              <button type="button" className="btn-outline" disabled={busy} onClick={handleDownload}>Descarrega PNG</button>
              <button type="button" className="btn-save" disabled={busy} onClick={handleShare}>Comparteix</button>
            </div>
            <div className="t-dim" style={{ fontSize: 11 }}>Mapa © OpenStreetMap contributors</div>
          </div>
        </div>
      </div>
    </div>
  );
}
