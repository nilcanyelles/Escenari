"use client";

import { useEffect, useRef, useState } from "react";
import type { Concert, Band } from "@/lib/types";
import { MONTH_FULL, WEEKDAY_FULL } from "@/lib/format";

// Pòster del concert per a Instagram: PNG 1080×1920 amb fons transparent,
// tipografia gran de cartell i un mini-mapa rodó amb la ubicació marcada
// (geocodificació Photon + rajoles OSM; si falla, marcador estilitzat).

const W = 1080;
const H = 1920;

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const c = data.features?.[0]?.geometry?.coordinates;
    return c ? { lat: c[1], lon: c[0] } : null;
  } catch { return null; }
}

function tileXY(lat: number, lon: number, z: number) {
  const x = ((lon + 180) / 360) * Math.pow(2, z);
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z);
  return { x, y };
}

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  });
}

export default function ConcertPosterModal({ concert, band, onClose }: { concert: Concert; band: Band | null; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [mapStatus, setMapStatus] = useState("carregant el mapa…");

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cream = "#f4efe4";
    const accent = band?.color1 || "#cdb4ff";

    async function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 24;

      // Nom del grup, apilat i gegant
      const words = (concert.bandName || "Concert").toUpperCase().split(" ");
      const lines: string[] = [];
      let cur = "";
      words.forEach((w) => {
        if ((cur + " " + w).trim().length > 12 && cur) { lines.push(cur.trim()); cur = w; }
        else cur = (cur + " " + w).trim();
      });
      if (cur) lines.push(cur);
      ctx.fillStyle = cream;
      let ty = 230;
      lines.slice(0, 3).forEach((ln) => {
        let size = 160;
        ctx.font = `700 ${size}px 'Space Grotesk', sans-serif`;
        while (ctx.measureText(ln).width > W - 110 && size > 64) {
          size -= 6;
          ctx.font = `700 ${size}px 'Space Grotesk', sans-serif`;
        }
        ctx.fillText(ln, W / 2, ty);
        ty += size * 0.95;
      });

      // Data i hora
      const [yy, mm, dd] = concert.date.split("-").map(Number);
      const weekday = WEEKDAY_FULL[new Date(yy, mm - 1, dd).getDay()];
      ctx.font = "italic 500 44px Inter, sans-serif";
      ctx.fillStyle = "rgba(244,239,228,0.9)";
      ctx.fillText(`${weekday.toLowerCase()}, ${dd} ${MONTH_FULL[mm - 1]} ${yy}`, W / 2, ty + 40);
      if (concert.time) {
        ctx.font = "700 56px 'Space Grotesk', sans-serif";
        ctx.fillStyle = cream;
        ctx.fillText(`${concert.time}h`, W / 2, ty + 116);
      }

      // Lloc
      const placeLine = [concert.venue, concert.city?.split(",")[0]].filter(Boolean).join(" · ");
      if (placeLine) {
        ctx.font = "600 40px Inter, sans-serif";
        ctx.fillStyle = "rgba(244,239,228,0.95)";
        ctx.fillText(`📍 ${placeLine}`, W / 2, ty + (concert.time ? 190 : 120));
      }

      // Mini-mapa rodó amb pin
      const mapCx = W / 2, mapCy = H - 470, mapR = 200;
      let drewMap = false;
      const q = [concert.venue, concert.city].filter(Boolean).join(", ");
      if (q) {
        const geo = await geocode(q);
        if (geo && !cancelled) {
          const z = 14;
          const t = tileXY(geo.lat, geo.lon, z);
          const tx = Math.floor(t.x), tyy = Math.floor(t.y);
          const tiles = await Promise.all([
            loadTile(z, tx, tyy), loadTile(z, tx + 1, tyy), loadTile(z, tx, tyy + 1), loadTile(z, tx + 1, tyy + 1),
            loadTile(z, tx - 1, tyy), loadTile(z, tx - 1, tyy + 1), loadTile(z, tx - 1, tyy - 1), loadTile(z, tx, tyy - 1), loadTile(z, tx + 1, tyy - 1),
          ]);
          if (!cancelled && tiles.some(Boolean)) {
            const TS = 256;
            const scale = 1.35;
            const px = (t.x - Math.floor(t.x)) * TS;
            const py = (t.y - Math.floor(t.y)) * TS;
            ctx.save();
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(mapCx, mapCy, mapR, 0, Math.PI * 2);
            ctx.clip();
            const offsets: [number, number, number][] = [
              [0, 0, 0], [1, 1, 0], [2, 0, 1], [3, 1, 1], [4, -1, 0], [5, -1, 1], [6, -1, -1], [7, 0, -1], [8, 1, -1],
            ];
            offsets.forEach(([i, ox, oy]) => {
              const img = tiles[i];
              if (!img) return;
              ctx.drawImage(
                img,
                mapCx - (px - ox * TS) * scale,
                mapCy - (py - oy * TS) * scale,
                TS * scale, TS * scale
              );
            });
            // Lleuger to per integrar-lo
            ctx.fillStyle = "rgba(20,16,36,0.18)";
            ctx.fillRect(mapCx - mapR, mapCy - mapR, mapR * 2, mapR * 2);
            ctx.restore();
            drewMap = true;
            setMapStatus("");
          }
        }
      }
      if (!drewMap) {
        // Fallback: cercle estilitzat
        ctx.save();
        ctx.shadowBlur = 0;
        const grad = ctx.createRadialGradient(mapCx, mapCy, 20, mapCx, mapCy, mapR);
        grad.addColorStop(0, "rgba(60,52,96,0.85)");
        grad.addColorStop(1, "rgba(24,20,40,0.85)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mapCx, mapCy, mapR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        setMapStatus("mapa no disponible — marcador estilitzat");
      }
      // Vora + pin
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(mapCx, mapCy, mapR, 0, Math.PI * 2);
      ctx.stroke();
      // Pin
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(mapCx, mapCy - 14, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(mapCx - 17, mapCy - 6);
      ctx.lineTo(mapCx + 17, mapCy - 6);
      ctx.lineTo(mapCx, mapCy + 26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#14101f";
      ctx.beginPath();
      ctx.arc(mapCx, mapCy - 14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Peu
      ctx.shadowBlur = 24;
      ctx.font = "600 28px Inter, sans-serif";
      ctx.fillStyle = "rgba(244,239,228,0.75)";
      ctx.fillText("@escenari.app", W / 2, H - 70);
      ctx.shadowBlur = 0;
    }

    draw();
    return () => { cancelled = true; };
  }, [concert, band]);

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
