"use client";

import { useEffect, useRef, useState } from "react";
import type { BandPublicData } from "@/lib/band-public";
import { PLATFORM_META, FOLLOWERS_KEY, formatNumber } from "@/lib/social-history";

// Targeta compartible del grup (1080×1920, mida de story): logo, nom,
// etiquetes, presentació, membres, xifres i xarxes — tot el que hi ha a la
// pàgina pública, en una sola imatge.

const W = 1080;
const H = 1920;

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Parteix un text en línies que càpiguen a `maxWidth` (com a màxim
// `maxLines`; l'última acaba amb "…" si se'n queda).
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width <= maxWidth) { cur = test; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  if (words.join(" ").length > lines.join(" ").length && lines.length) {
    let last = lines[lines.length - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 1) last = last.slice(0, -1);
    lines[lines.length - 1] = last + "…";
  }
  return lines;
}

export default function BandShareModal({ data, logoUrl, onClose }: {
  data: BandPublicData;
  logoUrl: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const c1 = data.color1 || "#8b7bff";
    const c2 = data.color2 || "#e86bd0";

    const draw = (logo: HTMLImageElement | null) => {
      // Fons amb els colors del grup.
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#0c0a15");
      bg.addColorStop(1, "#120f20");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const halo = ctx.createRadialGradient(W / 2, 420, 60, W / 2, 420, 900);
      halo.addColorStop(0, c1 + "66");
      halo.addColorStop(0.6, c2 + "22");
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);

      // Marca
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "700 40px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.letterSpacing = "14px";
      ctx.fillText("ESCENARI", W / 2, 120);
      ctx.letterSpacing = "0px";

      // Logo
      const ls = 440;
      const lx = (W - ls) / 2, ly = 180;
      ctx.save();
      roundRectPath(ctx, lx, ly, ls, ls, 48);
      ctx.clip();
      if (logo) {
        const side = Math.min(logo.width, logo.height);
        ctx.drawImage(logo, (logo.width - side) / 2, (logo.height - side) / 2, side, side, lx, ly, ls, ls);
      } else {
        const g = ctx.createLinearGradient(lx, ly, lx + ls, ly + ls);
        g.addColorStop(0, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g;
        ctx.fillRect(lx, ly, ls, ls);
      }
      ctx.restore();
      ctx.save();
      roundRectPath(ctx, lx, ly, ls, ls, 48);
      ctx.strokeStyle = c1;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();

      // Nom, població i etiquetes
      let y = ly + ls + 96;
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 72px 'Space Grotesk', sans-serif";
      const nameLines = wrapLines(ctx, data.name, W - 160, 2);
      nameLines.forEach((l) => { ctx.fillText(l, W / 2, y); y += 78; });
      const sub = [data.city, ...data.tags.slice(0, 3)].filter(Boolean).join("  ·  ");
      if (sub) {
        ctx.fillStyle = c1;
        ctx.font = "600 34px Inter, sans-serif";
        ctx.fillText(sub, W / 2, y);
        y += 46;
      }

      // Presentació
      if (data.bio) {
        y += 34;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "400 32px Inter, sans-serif";
        wrapLines(ctx, data.bio, W - 200, 6).forEach((l) => { ctx.fillText(l, W / 2, y); y += 44; });
      }

      // Membres
      if (data.members.length) {
        y += 50;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "600 26px Inter, sans-serif";
        ctx.letterSpacing = "6px";
        ctx.fillText("MEMBRES", W / 2, y);
        ctx.letterSpacing = "0px";
        y += 54;
        const members = data.members.slice(0, 10);
        const cols = members.length > 5 ? 2 : 1;
        const colW = (W - 200) / cols;
        ctx.font = "600 32px Inter, sans-serif";
        members.forEach((m, i) => {
          const col = cols === 1 ? 0 : i % 2;
          const row = cols === 1 ? i : Math.floor(i / 2);
          const cx = cols === 1 ? W / 2 : 100 + colW * col + colW / 2;
          const cy = y + row * 60;
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          const label = m.instruments.length ? `${m.name} · ${m.instruments[0]}` : m.name;
          ctx.fillText(wrapLines(ctx, label, colW - 20, 1)[0] || m.name, cx, cy);
        });
        y += Math.ceil(members.length / cols) * 60;
        if (data.members.length > members.length) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = "400 26px Inter, sans-serif";
          ctx.fillText(`i ${data.members.length - members.length} més`, W / 2, y);
          y += 40;
        }
      }

      // Xifres: concerts, membres, des de + xarxes
      const stats: { n: string; l: string }[] = [
        { n: String(data.stats.concertsDone), l: "concerts fets" },
        { n: String(data.members.length), l: "membres" },
      ];
      if (data.stats.since) stats.push({ n: data.stats.since, l: "en actiu des de" });
      data.trackedPlatforms.forEach((p) => {
        const v = data.socialStats[FOLLOWERS_KEY[p]];
        if (v != null) stats.push({ n: formatNumber(v), l: `${PLATFORM_META[p].metrics[0].label.toLowerCase()} ${PLATFORM_META[p].label}` });
      });
      if (data.socialStats.spotifyMonthlyListeners != null && data.trackedPlatforms.includes("spotify")) {
        stats.push({ n: formatNumber(data.socialStats.spotifyMonthlyListeners), l: "oients/mes Spotify" });
      }
      const statY = Math.max(y + 90, H - 470);
      const shown = stats.slice(0, 6);
      const perRow = Math.min(3, shown.length);
      const cellW = (W - 120) / perRow;
      shown.forEach((s, i) => {
        const row = Math.floor(i / perRow), col = i % perRow;
        const cx = 60 + cellW * col + cellW / 2;
        const cy = statY + row * 150;
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 64px 'Space Grotesk', sans-serif";
        ctx.fillText(s.n, cx, cy);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "500 24px Inter, sans-serif";
        ctx.fillText(wrapLines(ctx, s.l, cellW - 20, 1)[0] || s.l, cx, cy + 40);
      });

      // Peu
      ctx.fillStyle = c1;
      ctx.font = "700 40px Inter, sans-serif";
      ctx.fillText("escenari.app", W / 2, H - 90);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "400 26px Inter, sans-serif";
      ctx.fillText("la pàgina completa del grup, al nostre enllaç", W / 2, H - 48);
    };

    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => draw(null);
    img.src = logoUrl;
  }, [data, logoUrl]);

  async function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const c = canvasRef.current;
      if (!c) return resolve(null);
      c.toBlob((b) => resolve(b), "image/png");
    });
  }

  async function handleDownload() {
    setBusy(true);
    const blob = await toBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `escenari-${data.name.toLowerCase().replace(/\s+/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setBusy(false);
  }

  async function handleShare() {
    setBusy(true);
    const blob = await toBlob();
    if (blob) {
      const file = new File([blob], "escenari-grup.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: data.name, url: window.location.href }); } catch { /* cancel·lat */ }
      } else {
        await handleDownload();
      }
    }
    setBusy(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-month-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Comparteix {data.name}</div>
          <button className="cf-head-close" onClick={onClose}>✕</button>
        </div>
        <div className="share-month-body">
          <div className="share-month-preview-wrap">
            <canvas ref={canvasRef} width={W} height={H} className="share-month-canvas" />
          </div>
          <div className="share-month-controls">
            <div className="t-dim" style={{ fontSize: 13 }}>
              1080×1920 — a punt per a la story: logo, presentació, membres, xifres i xarxes del grup, amb l&apos;enllaç d&apos;escenari.app.
            </div>
            <div className="share-month-actions">
              <button type="button" className="btn-outline" disabled={busy} onClick={handleDownload}>Descarrega PNG</button>
              <button type="button" className="btn-save" disabled={busy} onClick={handleShare}>Comparteix</button>
            </div>
            <button
              type="button" className="link-btn" style={{ alignSelf: "flex-start", fontSize: 12.5 }}
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
            >🔗 {copied ? "Enllaç copiat ✓" : "Copia també l'enllaç de la pàgina"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
