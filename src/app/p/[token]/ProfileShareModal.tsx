"use client";

import { useEffect, useRef, useState } from "react";
import type { PersonProfileData } from "@/lib/person-profile";

// Targeta compartible del músic (1080×1920, optimitzada per a story
// d'Instagram): foto, nom, @, instruments, grups i concerts + escenari.app.
// Sense calendari: només la identitat.

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

export default function ProfileShareModal({ data, photoUrl, onClose }: {
  data: PersonProfileData;
  photoUrl: string;
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

    const accent = data.bands[0]?.color1 || data.crewRoles[0]?.color1 || "#8b7bff";

    // Grups on hi ets músic i grups on hi ets crew, junts (sense repetir-ne
    // cap si en resulta que ets totes dues coses del mateix grup).
    const groupsById = new Map<string, { id: string; name: string; color1: string }>();
    data.bands.forEach((b) => groupsById.set(b.id, { id: b.id, name: b.name, color1: b.color1 }));
    data.crewRoles.forEach((c) => {
      if (!groupsById.has(c.bandId)) groupsById.set(c.bandId, { id: c.bandId, name: c.bandName, color1: c.color1 });
    });
    const allGroups = Array.from(groupsById.values());

    const draw = (photo: HTMLImageElement | null) => {
      // Fons
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#0c0a15");
      bg.addColorStop(1, "#120f20");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const halo = ctx.createRadialGradient(W / 2, 460, 80, W / 2, 460, 900);
      halo.addColorStop(0, accent + "55");
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

      // Foto (quadrada arrodonida)
      const ps = 560;
      const px = (W - ps) / 2;
      const py = 190;
      ctx.save();
      roundRectPath(ctx, px, py, ps, ps, 44);
      ctx.clip();
      if (photo) {
        const side = Math.min(photo.width, photo.height);
        ctx.drawImage(photo, (photo.width - side) / 2, (photo.height - side) / 2, side, side, px, py, ps, ps);
      } else {
        ctx.fillStyle = accent;
        ctx.fillRect(px, py, ps, ps);
      }
      ctx.restore();
      ctx.save();
      roundRectPath(ctx, px, py, ps, ps, 44);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();

      // Nom i @
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 76px 'Space Grotesk', sans-serif";
      ctx.fillText(data.name, W / 2, py + ps + 110);
      if (data.igHandle) {
        ctx.fillStyle = accent;
        ctx.font = "600 40px Inter, sans-serif";
        ctx.fillText("@" + data.igHandle, W / 2, py + ps + 168);
      }

      // Instruments
      let y = py + ps + (data.igHandle ? 250 : 200);
      if (data.instruments.length) {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "600 26px Inter, sans-serif";
        ctx.letterSpacing = "6px";
        ctx.fillText("INSTRUMENTS", W / 2, y);
        ctx.letterSpacing = "0px";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "500 40px Inter, sans-serif";
        ctx.fillText(data.instruments.slice(0, 4).join("  ·  "), W / 2, y + 58);
        y += 150;
      }

      // Grups (músic i/o crew)
      if (allGroups.length) {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "600 26px Inter, sans-serif";
        ctx.letterSpacing = "6px";
        ctx.fillText("GRUPS", W / 2, y);
        ctx.letterSpacing = "0px";
        allGroups.slice(0, 4).forEach((b, i) => {
          const by = y + 60 + i * 62;
          ctx.fillStyle = b.color1 || accent;
          ctx.beginPath();
          ctx.arc(W / 2 - ctx.measureText(b.name).width / 2 - 120, by - 12, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.font = "600 42px Inter, sans-serif";
          ctx.fillText(b.name, W / 2, by);
        });
        y += 60 + Math.min(allGroups.length, 4) * 62 + 60;
      }

      // Concerts
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 120px 'Space Grotesk', sans-serif";
      ctx.fillText(String(data.totalConcerts), W / 2, y + 90);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "500 36px Inter, sans-serif";
      ctx.fillText("concerts en directe", W / 2, y + 145);

      // Peu
      ctx.fillStyle = accent;
      ctx.font = "700 40px Inter, sans-serif";
      ctx.fillText("escenari.app", W / 2, H - 90);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "400 26px Inter, sans-serif";
      ctx.fillText("el perfil complet, al meu enllaç", W / 2, H - 48);
    };

    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => draw(null);
    img.src = photoUrl;
  }, [data, photoUrl]);

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
      const file = new File([blob], "escenari-perfil.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); } catch { /* cancel·lat */ }
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
          <div className="modal-title">Comparteix el perfil</div>
          <button className="cf-head-close" onClick={onClose}>✕</button>
        </div>
        <div className="share-month-body">
          <div className="share-month-preview-wrap">
            <canvas ref={canvasRef} width={W} height={H} className="share-month-canvas" />
          </div>
          <div className="share-month-controls">
            <div className="t-dim" style={{ fontSize: 13 }}>
              1080×1920 — a punt per a la story d&apos;Instagram: foto, @, instruments, grups i concerts, amb l&apos;enllaç d&apos;escenari.app.
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
