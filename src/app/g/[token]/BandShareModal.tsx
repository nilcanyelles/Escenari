"use client";

import { useEffect, useRef, useState } from "react";
import type { BandPublicData } from "@/lib/band-public";
import type { SocialPlatform } from "@/lib/types";
import { PLATFORM_META, FOLLOWERS_KEY, formatHeroNumber } from "@/lib/social-history";

// Targeta compartible del grup (1080×1920, mida de story): logo, nom,
// etiquetes, presentació, músics, crew, xifres (amb la icona de cada
// xarxa) i el peu amb la marca d'Escenari — tot el que hi ha a la pàgina
// pública, en una sola imatge.

const W = 1080;
const H = 1920;

// Mateixes icones que SocialIcons.tsx, però com a SVG en cru (amb el
// color ja fixat, no "currentColor") perquè es puguin carregar com a
// imatge i dibuixar-les al canvas — el canvas no entén JSX/CSS.
const SOCIAL_ICON_SVG: Record<SocialPlatform, string> = {
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>`,
  youtube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="4"/><polygon points="10 9 15 12 10 15 10 9" fill="#fff" stroke="none"/></svg>`,
  tiktok: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c0 2.5 2 4.5 4.5 4.5"/></svg>`,
  spotify: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M7 10.5c3.5-1 6.5-.6 9.5 1"/><path d="M7.5 13c2.8-.7 5.2-.4 7.8.9"/><path d="M8 15.5c2.2-.5 4-.3 6 .7"/></svg>`,
};
function svgDataUri(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

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

    const draw = (logo: HTMLImageElement | null, escenariMark: HTMLImageElement | null, iconByPlatform: Partial<Record<SocialPlatform, HTMLImageElement>>) => {
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

      // Músics i crew — mateix dibuix per als dos grups, cada un amb la
      // seva capçalera pròpia (només si n'hi ha). Tots els instruments
      // (no només el primer), separats per comes.
      const drawRoster = (heading: string, list: typeof data.members, cap: number) => {
        if (!list.length) return;
        y += 50;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "600 26px Inter, sans-serif";
        ctx.letterSpacing = "6px";
        ctx.fillText(heading, W / 2, y);
        ctx.letterSpacing = "0px";
        y += 54;
        const shown = list.slice(0, cap);
        const cols = shown.length > 5 ? 2 : 1;
        const colW = (W - 200) / cols;
        ctx.font = "600 32px Inter, sans-serif";
        shown.forEach((m, i) => {
          const col = cols === 1 ? 0 : i % 2;
          const row = cols === 1 ? i : Math.floor(i / 2);
          const cx = cols === 1 ? W / 2 : 100 + colW * col + colW / 2;
          const cy = y + row * 60;
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          const label = m.instruments.length ? `${m.name} · ${m.instruments.join(", ")}` : m.role ? `${m.name} · ${m.role}` : m.name;
          ctx.fillText(wrapLines(ctx, label, colW - 20, 1)[0] || m.name, cx, cy);
        });
        y += Math.ceil(shown.length / cols) * 60;
        if (list.length > shown.length) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = "400 26px Inter, sans-serif";
          ctx.fillText(`i ${list.length - shown.length} més`, W / 2, y);
          y += 40;
        }
      };
      drawRoster("MÚSICS", data.members, 8);
      drawRoster("CREW", data.crew, 6);

      // Xifres: concerts, membres, des de + xarxes (amb la icona de la
      // xarxa a sobre del número, i el número en format comprimit).
      const stats: { n: string; l: string; platform?: SocialPlatform }[] = [
        { n: String(data.stats.concertsDone), l: "concerts fets" },
        { n: String(data.members.length), l: "membres" },
      ];
      if (data.stats.since) stats.push({ n: data.stats.since, l: "en actiu des de" });
      data.trackedPlatforms.forEach((p) => {
        const key = FOLLOWERS_KEY[p];
        const v = key ? data.socialStats[key] : undefined;
        if (v != null) stats.push({ n: formatHeroNumber(v), l: `${PLATFORM_META[p].metrics[0].label.toLowerCase()} ${PLATFORM_META[p].label}`, platform: p });
      });
      if (data.socialStats.spotifyMonthlyListeners != null && data.trackedPlatforms.includes("spotify")) {
        stats.push({ n: formatHeroNumber(data.socialStats.spotifyMonthlyListeners), l: "oients/mes Spotify", platform: "spotify" });
      }
      const rowH = 175;
      const statY = Math.max(y + 100, H - 500);
      const shownStats = stats.slice(0, 6);
      const perRow = Math.min(3, shownStats.length);
      const cellW = (W - 120) / perRow;
      shownStats.forEach((s, i) => {
        const row = Math.floor(i / perRow), col = i % perRow;
        const cx = 60 + cellW * col + cellW / 2;
        const cy = statY + row * rowH;
        const icon = s.platform ? iconByPlatform[s.platform] : undefined;
        if (icon && s.platform) {
          const r = 24;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy - 58, r, 0, Math.PI * 2);
          ctx.fillStyle = PLATFORM_META[s.platform].color;
          ctx.fill();
          ctx.clip();
          ctx.drawImage(icon, cx - r, cy - 58 - r, r * 2, r * 2);
          ctx.restore();
        }
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 60px 'Space Grotesk', sans-serif";
        ctx.fillText(s.n, cx, cy);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "500 24px Inter, sans-serif";
        ctx.fillText(wrapLines(ctx, s.l, cellW - 20, 1)[0] || s.l, cx, cy + 40);
      });

      // Peu: logo i nom d'Escenari (imatge, com la resta de peus de
      // l'app) en comptes de "escenari.app" en text.
      const footY = H - 80;
      const brandText = "ESCENARI";
      ctx.font = "700 34px 'Space Grotesk', sans-serif";
      ctx.letterSpacing = "4px";
      const textW = ctx.measureText(brandText).width;
      const iconSize = 46, gap = 14;
      const totalW = (escenariMark ? iconSize + gap : 0) + textW;
      let startX = W / 2 - totalW / 2;
      if (escenariMark) {
        ctx.drawImage(escenariMark, startX, footY - iconSize / 2, iconSize, iconSize);
        startX += iconSize + gap;
      }
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(brandText, startX, footY + 12);
      ctx.letterSpacing = "0px";
      ctx.textAlign = "center";
    };

    (async () => {
      const [logo, escenariMark, ...icons] = await Promise.all([
        loadImg(logoUrl),
        loadImg("/logo-mark.png"),
        ...data.trackedPlatforms.map((p) => loadImg(svgDataUri(SOCIAL_ICON_SVG[p]))),
      ]);
      const iconByPlatform: Partial<Record<SocialPlatform, HTMLImageElement>> = {};
      data.trackedPlatforms.forEach((p, i) => { if (icons[i]) iconByPlatform[p] = icons[i] as HTMLImageElement; });
      draw(logo, escenariMark, iconByPlatform);
    })();
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
              1080×1920 — a punt per a la story: logo, presentació, músics, crew, xifres i xarxes del grup, amb l&apos;enllaç d&apos;escenari.app.
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
