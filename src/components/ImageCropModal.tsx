"use client";

import { useEffect, useRef, useState } from "react";

// Retall d'imatge amb proporció fixa: la imatge es pot arrossegar (i
// ampliar amb el control lliscant) dins d'un marc amb la proporció triada
// — el que es veu dins el marc és exactament el que es desarà. S'exporta
// en PNG per conservar la transparència dels logos.
export default function ImageCropModal({ file, aspect, title = "Retalla la imatge", onCancel, onDone }: {
  file: File;
  aspect: number; // amplada / alçada
  title?: string;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [url, setUrl] = useState("");
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  // Amplada del marc: el que hi càpiga a la pantalla, fins a 460px.
  const [W] = useState(() => (typeof window !== "undefined" ? Math.min(460, window.innerWidth - 90) : 460));
  const H = Math.round(W / aspect);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Escala base: la mínima perquè la imatge cobreixi tot el marc.
  const base = nat ? Math.max(W / nat.w, H / nat.h) : 1;
  const s = base * zoom;
  const dw = nat ? nat.w * s : W;
  const dh = nat ? nat.h * s : H;
  function clamp(o: { x: number; y: number }, w = dw, h = dh) {
    return { x: Math.min(0, Math.max(W - w, o.x)), y: Math.min(0, Math.max(H - h, o.y)) };
  }

  function onLoaded(e: React.SyntheticEvent<HTMLImageElement>) {
    const w = e.currentTarget.naturalWidth, h = e.currentTarget.naturalHeight;
    setNat({ w, h });
    const b = Math.max(W / w, H / h);
    setOff({ x: (W - w * b) / 2, y: (H - h * b) / 2 });
  }

  // El zoom es fa al voltant del centre del marc, no de la cantonada.
  function setZoomKeepCenter(z: number) {
    if (!nat) { setZoom(z); return; }
    const s2 = base * z;
    const cx = (W / 2 - off.x) / s, cy = (H / 2 - off.y) / s;
    setZoom(z);
    setOff(clamp({ x: W / 2 - cx * s2, y: H / 2 - cy * s2 }, nat.w * s2, nat.h * s2));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setOff(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }));
  }
  function onPointerUp() { drag.current = null; }

  function done() {
    const img = imgRef.current;
    if (!img || !nat) return;
    setBusy(true);
    const sx = -off.x / s, sy = -off.y / s, sw = W / s, sh = H / s;
    const outW = Math.max(1, Math.min(1400, Math.round(sw)));
    const outH = Math.max(1, Math.round(outW / aspect));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setBusy(false); return; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    canvas.toBlob((b) => { setBusy(false); if (b) onDone(b); }, "image/png");
  }

  return (
    <div className="modal-overlay cf-confirm-overlay" onClick={(e) => { e.stopPropagation(); if (!busy) onCancel(); }}>
      <div className="modal crop-modal" style={{ width: W + 48 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-form">
          <div className="t-dim" style={{ fontSize: 12.5 }}>Arrossega la imatge per triar què es veu; amplia-la amb el control de sota.</div>
          <div
            className="crop-frame" style={{ width: W, height: H }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          >
            {url && (
              <img
                ref={imgRef} src={url} alt="" draggable={false} onLoad={onLoaded}
                style={{ position: "absolute", left: off.x, top: off.y, width: dw, height: dh, maxWidth: "none" }}
              />
            )}
          </div>
          <label className="crop-zoom">
            <span>Zoom</span>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoomKeepCenter(parseFloat(e.target.value))} />
          </label>
          <div className="modal-actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn-outline" disabled={busy} onClick={onCancel}>Cancel·la</button>
            <button type="button" className="btn-save" disabled={busy || !nat} onClick={done}>{busy ? "Retallant…" : "Retalla i puja"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
