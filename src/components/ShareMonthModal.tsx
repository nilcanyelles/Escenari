"use client";

import { useEffect, useRef, useState } from "react";
import type { Band, Concert } from "@/lib/types";
import { MONTH_FULL, WEEKDAY_SHORT, pad2 } from "@/lib/format";
import { bandColor } from "@/lib/tags";

// Imatge estil "Strava" del mes: un PNG 1080x1920 (story / fons de pantalla)
// amb la graella del mes i tots els concerts marcats, a punt per compartir.

const W = 1080;
const H = 1920;

const ACCENTS = ["#8b7bff", "#38E1C6", "#FFD400", "#FF5A36", "#FF3D8A"];

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

  function shiftMonth(delta: number) {
    let m = monthIdx + delta, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonthIdx(m); setYear(y);
  }

  const ymPrefix = year + "-" + pad2(monthIdx + 1);
  const monthConcerts = concerts
    .filter((c) => c.date.slice(0, 7) === ymPrefix && c.status !== "cancel·lat")
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

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

    // Mes gegant.
    const monthName = MONTH_FULL[monthIdx].toUpperCase();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 118px 'Space Grotesk', sans-serif";
    ctx.fillText(monthName, 72, 300);
    ctx.fillStyle = accent;
    ctx.font = "700 60px 'Space Grotesk', sans-serif";
    ctx.fillText(String(year), 76, 380);

    // Comptador.
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 130px 'Space Grotesk', sans-serif";
    ctx.fillText(String(monthConcerts.length), W - 80, 320);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "500 34px Inter, sans-serif";
    ctx.fillText(monthConcerts.length === 1 ? "concert" : "concerts", W - 80, 372);
    ctx.textAlign = "left";

    // Graella del mes.
    const gridTop = 470;
    const gridX = 72;
    const gridW = W - 144;
    const cell = gridW / 7;
    const base = new Date(year, monthIdx, 1);
    const startOffset = (base.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const numRows = Math.ceil((startOffset + daysInMonth) / 7);

    const byDay: Record<number, Concert[]> = {};
    monthConcerts.forEach((c) => {
      const d = parseInt(c.date.slice(8, 10), 10);
      (byDay[d] = byDay[d] || []).push(c);
    });

    ctx.font = "600 26px Inter, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "center";
    WEEKDAY_SHORT.forEach((wd, i) => {
      ctx.fillText(wd.toUpperCase(), gridX + cell * i + cell / 2, gridTop);
    });

    const rowH = 108;
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

    // Llista de concerts (fins a 8).
    if (showList && monthConcerts.length) {
      const listTop = gridTop + 60 + numRows * rowH + 50;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "600 26px Inter, sans-serif";
      ctx.letterSpacing = "6px";
      ctx.fillText("ON SONAREM", 72, listTop);
      ctx.letterSpacing = "0px";

      const maxRows = Math.min(monthConcerts.length, 8);
      const rowGap = Math.min(88, (H - listTop - 160) / maxRows);
      for (let i = 0; i < maxRows; i++) {
        const c = monthConcerts[i];
        const yy = listTop + 60 + i * rowGap;
        const d = parseInt(c.date.slice(8, 10), 10);
        drawRoundRect(ctx, 72, yy - 40, 84, 58, 14);
        ctx.fillStyle = accent + "2e";
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.font = "700 34px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(d), 114, yy + 2);
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = "600 34px Inter, sans-serif";
        const place = (c.city || c.venue || "").split(",")[0];
        ctx.fillText(place, 190, yy);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "400 27px Inter, sans-serif";
        const bandLabel = c.bandName + (c.festaEntitat ? " · " + c.festaEntitat : "");
        ctx.fillText(bandLabel.length > 46 ? bandLabel.slice(0, 45) + "…" : bandLabel, 190 + ctx.measureText("").width, yy + 36);
      }
      if (monthConcerts.length > maxRows) {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "500 28px Inter, sans-serif";
        ctx.fillText("+" + (monthConcerts.length - maxRows) + " més…", 72, listTop + 60 + maxRows * rowGap);
      }
    }

    // Peu.
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "500 26px Inter, sans-serif";
    ctx.fillText("fet amb escenari.app", 72, H - 64);
  }, [monthIdx, year, accent, showList, monthConcerts, bands, mode, concerts, today]);

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
      a.download = `escenari-${ymPrefix}.png`;
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
        await navigator.share({ files: [new File([blob], `escenari-${ymPrefix}.png`, { type: "image/png" })] });
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
            <div className="share-month-nav">
              <button className="cal-nav-btn" onClick={() => shiftMonth(-1)}>‹</button>
              <span className="share-month-label">{MONTH_FULL[monthIdx]} {year}</span>
              <button className="cal-nav-btn" onClick={() => shiftMonth(1)}>›</button>
            </div>
            <div className="share-month-accents">
              {ACCENTS.map((a) => (
                <button key={a} type="button" className={"share-accent-dot" + (accent === a ? " active" : "")} style={{ background: a }} onClick={() => setAccent(a)} aria-label={a} />
              ))}
            </div>
            <label className="share-month-toggle">
              <input type="checkbox" checked={showList} onChange={(e) => setShowList(e.target.checked)} />
              Mostra la llista de bolos
            </label>
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
