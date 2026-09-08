"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import { bandPhotoDataUri } from "@/lib/tags";
import { uploadBandImageAction, saveBandAppearanceAction } from "@/app/(app)/grup/actions";
import { removeSimpleBackground } from "@/lib/image-bg-remove";
import { LOGO_ASPECTS, logoRatio } from "@/lib/logo";
import ImageCropModal from "@/components/ImageCropModal";

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle>
    </svg>
  );
}

function parsePos(p: string): { x: number; y: number } {
  const m = (p || "").match(/([\d.]+)%\s+([\d.]+)%/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 50, y: 50 };
}

// Editor d'aparença del grup: nom, logo (amb la proporció que es triï i
// retallat a mà), portada (estil LinkedIn, arrossegable per triar què es
// veu), colors i etiquetes lliures — les xarxes socials es gestionen a la
// seva pròpia pestanya (/grup/xarxes).
export default function GroupAppearanceModal({ band, onClose }: { band: Band; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(band.name);
  const [color1, setColor1] = useState(band.color1 || "#8b7bff");
  const [color2, setColor2] = useState(band.color2 || "#e86bd0");
  const [tags, setTags] = useState<string[]>(band.tags || []);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoAspect, setLogoAspect] = useState(band.logoAspect || "1:1");
  const [coverPos, setCoverPos] = useState(band.coverPos || "50% 50%");
  // Fitxer de logo pendent de retallar (obre ImageCropModal).
  const [cropFile, setCropFile] = useState<File | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  // Mida real de la portada: per saber quant "sobra" i, per tant, quant es
  // pot desplaçar en arrossegar.
  const [coverNat, setCoverNat] = useState<{ w: number; h: number } | null>(null);
  const coverDrag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);

  const coverSrc = coverPreview || band.coverUrl || "";
  useEffect(() => {
    if (!coverSrc) { setCoverNat(null); return; }
    const img = new Image();
    img.onload = () => setCoverNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = coverSrc;
  }, [coverSrc]);

  async function upload(kind: "logo" | "cover", file: File) {
    setUploading(kind);
    // Al logo (mai a la portada, que sol ser una foto de veritat): si té un
    // fons pla i senzill, es treu sol abans de pujar-lo.
    const finalFile = kind === "logo" ? await removeSimpleBackground(file) : file;
    const fd = new FormData();
    fd.set("bandId", band.id);
    fd.set("kind", kind);
    fd.set("file", finalFile);
    if (kind === "logo") fd.set("logoAspect", logoAspect);
    const res = await uploadBandImageAction(fd);
    if (!res.ok) alert(res.error);
    else {
      const preview = URL.createObjectURL(finalFile);
      if (kind === "logo") setLogoPreview(preview); else { setCoverPreview(preview); setCoverPos("50% 50%"); }
    }
    router.refresh();
    setUploading(null);
  }

  async function onCropped(blob: Blob) {
    setCropFile(null);
    await upload("logo", new File([blob], "logo.png", { type: "image/png" }));
  }

  // Arrossegar la portada mou el punt focal (background-position): X%
  // desplaça la imatge X% del que sobra, així que moure el dit cap a la
  // dreta porta el punt focal cap a l'esquerra.
  function onCoverPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!coverSrc) { coverInput.current?.click(); return; }
    const p = parsePos(coverPos);
    coverDrag.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onCoverPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = coverDrag.current;
    if (!d || !coverRef.current || !coverNat) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const r = coverRef.current.getBoundingClientRect();
    const scale = Math.max(r.width / coverNat.w, r.height / coverNat.h);
    const overX = coverNat.w * scale - r.width, overY = coverNat.h * scale - r.height;
    const nx = overX > 1 ? Math.min(100, Math.max(0, d.px - (dx / overX) * 100)) : 50;
    const ny = overY > 1 ? Math.min(100, Math.max(0, d.py - (dy / overY) * 100)) : 50;
    setCoverPos(`${Math.round(nx)}% ${Math.round(ny)}%`);
  }
  function onCoverPointerUp() { coverDrag.current = null; }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ga-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Aparença del grup</div>
          <button className="cf-head-close" onClick={onClose}>✕</button>
        </div>

        <div className="ga-body">
          {/* Nom del grup */}
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Nom del grup</div>
            <input className="field-input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Proporció del logo: s'aplica al retallar-lo en pujar-lo */}
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Forma del logo</div>
            <div className="ga-aspect">
              {LOGO_ASPECTS.map((a) => (
                <button key={a.key} type="button" className={"ga-aspect-btn" + (logoAspect === a.key ? " active" : "")} onClick={() => setLogoAspect(a.key)}>{a.label}</button>
              ))}
              <span className="t-dim" style={{ fontSize: 12 }}>Tria la forma i puja el logo per retallar-lo.</span>
            </div>
          </div>

          {/* Portada + logo, previsualitzats com a la pàgina */}
          <div className="ga-preview">
            <div
              ref={coverRef}
              className={"ga-cover" + (coverSrc ? " draggable" : "")}
              style={{
                backgroundImage: coverSrc ? `url(${coverSrc})` : `linear-gradient(120deg, ${color1}, ${color2})`,
                backgroundPosition: coverPos,
              }}
              title={coverSrc ? "Arrossega per triar quina part es veu" : "Puja una portada"}
              onPointerDown={onCoverPointerDown} onPointerMove={onCoverPointerMove} onPointerUp={onCoverPointerUp} onPointerCancel={onCoverPointerUp}
            >
              {coverSrc && <span className="ga-cover-pos-hint">Arrossega per enquadrar</span>}
              <button
                type="button" className="ga-cover-hint"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); coverInput.current?.click(); }}
              >
                {uploading === "cover" ? "Pujant…" : <><CameraIcon /> {coverSrc ? "Canvia la portada" : "Puja una portada"}</>}
              </button>
            </div>
            <div className="ga-logo-wrap" onClick={() => logoInput.current?.click()} title="Canvia el logo">
              <img className="ga-logo" style={{ width: Math.round(76 * logoRatio(logoAspect)), height: 76 }} src={logoPreview || band.logo || bandPhotoDataUri(band)} alt="" />
              <span className="ga-logo-hint">{uploading === "logo" ? "…" : <CameraIcon />}</span>
            </div>
            <input ref={coverInput} type="file" hidden accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("cover", f); e.target.value = ""; }} />
            <input ref={logoInput} type="file" hidden accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = ""; }} />
          </div>

          {/* Colors */}
          <div className="ga-colors">
            <label className="ga-color">
              Color principal
              <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} />
            </label>
            <label className="ga-color">
              Color secundari
              <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} />
            </label>
            <div className="ga-swatch" style={{ background: `linear-gradient(120deg, ${color1}, ${color2})` }}></div>
          </div>

          {/* Etiquetes: text lliure, no una llista tancada d'estils */}
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Etiquetes</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {tags.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input className="field-input" style={{ width: 130, padding: "6px 8px", fontSize: 12 }} type="text" placeholder="Etiqueta" value={t}
                    onChange={(e) => setTags((prev) => prev.map((x, xi) => (xi === i ? e.target.value : x)))} />
                  <button type="button" className="rs-mini-btn danger" title="Elimina"
                    onClick={() => setTags((prev) => prev.filter((_, xi) => xi !== i))}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ))}
              <button type="button" className="rs-add-btn" onClick={() => setTags((prev) => prev.concat([""]))}>+ Etiqueta</button>
            </div>
          </div>

          <div className="modal-actions">
            <div className="spacer"></div>
            <button className="btn-outline" onClick={onClose}>Tanca</button>
            <button className="btn-save" disabled={saving}
              onClick={async () => {
                setSaving(true);
                await saveBandAppearanceAction(band.id, { name, color1, color2, tags: tags.map((t) => t.trim()).filter(Boolean), logoAspect, coverPos });
                router.refresh();
                setSaving(false);
                onClose();
              }}>{saving ? "Desant…" : "Desa"}</button>
          </div>
        </div>
      </div>
      {cropFile && (
        <ImageCropModal
          file={cropFile} aspect={logoRatio(logoAspect)}
          title={`Retalla el logo (${LOGO_ASPECTS.find((a) => a.key === logoAspect)?.label || logoAspect})`}
          onCancel={() => setCropFile(null)} onDone={onCropped}
        />
      )}
    </div>
  );
}
