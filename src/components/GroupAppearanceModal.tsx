"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import { TAG_PRESETS, bandPhotoDataUri } from "@/lib/tags";
import { uploadBandImageAction, saveBandAppearanceAction } from "@/app/(app)/grup/actions";

// Editor d'aparença del grup: logo, portada (estil LinkedIn), colors i estil.
export default function GroupAppearanceModal({ band, onClose }: { band: Band; onClose: () => void }) {
  const router = useRouter();
  const [color1, setColor1] = useState(band.color1 || "#8b7bff");
  const [color2, setColor2] = useState(band.color2 || "#e86bd0");
  const [tags, setTags] = useState<string[]>(band.tags || []);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function upload(kind: "logo" | "cover", file: File) {
    setUploading(kind);
    const fd = new FormData();
    fd.set("bandId", band.id);
    fd.set("kind", kind);
    fd.set("file", file);
    const res = await uploadBandImageAction(fd);
    if (!res.ok) alert(res.error);
    else {
      const preview = URL.createObjectURL(file);
      if (kind === "logo") setLogoPreview(preview); else setCoverPreview(preview);
    }
    router.refresh();
    setUploading(null);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ga-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Aparença del grup</div>
          <button className="cf-head-close" onClick={onClose}>✕</button>
        </div>

        <div className="ga-body">
          {/* Portada + logo, previsualitzats com a la pàgina */}
          <div className="ga-preview">
            <div
              className="ga-cover"
              style={{
                backgroundImage: coverPreview || band.coverUrl
                  ? `url(${coverPreview || band.coverUrl})`
                  : `linear-gradient(120deg, ${color1}, ${color2})`,
              }}
              onClick={() => coverInput.current?.click()}
              title="Canvia la portada"
            >
              <span className="ga-cover-hint">{uploading === "cover" ? "Pujant…" : "📷 Canvia la portada"}</span>
            </div>
            <div className="ga-logo-wrap" onClick={() => logoInput.current?.click()} title="Canvia el logo">
              <img className="ga-logo" src={logoPreview || band.logo || bandPhotoDataUri(band)} alt="" />
              <span className="ga-logo-hint">{uploading === "logo" ? "…" : "📷"}</span>
            </div>
            <input ref={coverInput} type="file" hidden accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("cover", f); e.target.value = ""; }} />
            <input ref={logoInput} type="file" hidden accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("logo", f); e.target.value = ""; }} />
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

          {/* Estil */}
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Estil del grup</div>
            <div className="access-box-list">
              {TAG_PRESETS.map((t) => {
                const on = tags.includes(t);
                return (
                  <button key={t} type="button" className={"access-chip" + (on ? " active" : "")}
                    onClick={() => setTags((prev) => on ? prev.filter((x) => x !== t) : prev.concat([t]))}>
                    {on ? "✓ " : ""}{t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="modal-actions">
            <div className="spacer"></div>
            <button className="btn-outline" onClick={onClose}>Tanca</button>
            <button className="btn-save" disabled={saving}
              onClick={async () => {
                setSaving(true);
                await saveBandAppearanceAction(band.id, { color1, color2, tags });
                router.refresh();
                setSaving(false);
                onClose();
              }}>{saving ? "Desant…" : "Desa"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
