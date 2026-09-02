"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, SocialLinks } from "@/lib/types";
import { bandPhotoDataUri } from "@/lib/tags";
import { uploadBandImageAction, saveBandAppearanceAction } from "@/app/(app)/grup/actions";
import { removeSimpleBackground } from "@/lib/image-bg-remove";
import { InstagramIcon, YoutubeIcon, TiktokIcon, SpotifyIcon } from "@/components/SocialIcons";

// Editor d'aparença del grup: nom, logo, portada (estil LinkedIn), colors,
// etiquetes lliures i xarxes socials.
export default function GroupAppearanceModal({ band, onClose }: { band: Band; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(band.name);
  const [color1, setColor1] = useState(band.color1 || "#8b7bff");
  const [color2, setColor2] = useState(band.color2 || "#e86bd0");
  const [tags, setTags] = useState<string[]>(band.tags || []);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(band.socialLinks || {});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function upload(kind: "logo" | "cover", file: File) {
    setUploading(kind);
    // Al logo (mai a la portada, que sol ser una foto de veritat): si té un
    // fons pla i senzill, es treu sol abans de pujar-lo.
    const finalFile = kind === "logo" ? await removeSimpleBackground(file) : file;
    const fd = new FormData();
    fd.set("bandId", band.id);
    fd.set("kind", kind);
    fd.set("file", finalFile);
    const res = await uploadBandImageAction(fd);
    if (!res.ok) alert(res.error);
    else {
      const preview = URL.createObjectURL(finalFile);
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
          {/* Nom del grup */}
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Nom del grup</div>
            <input className="field-input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

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

          {/* Xarxes socials */}
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Xarxes socials</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="t-dim" style={{ flex: "none" }}><InstagramIcon /></span>
                <input className="field-input" style={{ flex: 1 }} type="url" placeholder="Instagram (enllaç)" value={socialLinks.instagram || ""}
                  onChange={(e) => setSocialLinks((prev) => ({ ...prev, instagram: e.target.value }))} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="t-dim" style={{ flex: "none" }}><YoutubeIcon /></span>
                <input className="field-input" style={{ flex: 1 }} type="url" placeholder="YouTube (enllaç)" value={socialLinks.youtube || ""}
                  onChange={(e) => setSocialLinks((prev) => ({ ...prev, youtube: e.target.value }))} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="t-dim" style={{ flex: "none" }}><TiktokIcon /></span>
                <input className="field-input" style={{ flex: 1 }} type="url" placeholder="TikTok (enllaç)" value={socialLinks.tiktok || ""}
                  onChange={(e) => setSocialLinks((prev) => ({ ...prev, tiktok: e.target.value }))} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="t-dim" style={{ flex: "none" }}><SpotifyIcon /></span>
                <input className="field-input" style={{ flex: 1 }} type="url" placeholder="Spotify (enllaç)" value={socialLinks.spotify || ""}
                  onChange={(e) => setSocialLinks((prev) => ({ ...prev, spotify: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <div className="spacer"></div>
            <button className="btn-outline" onClick={onClose}>Tanca</button>
            <button className="btn-save" disabled={saving}
              onClick={async () => {
                setSaving(true);
                await saveBandAppearanceAction(band.id, { name, color1, color2, tags: tags.map((t) => t.trim()).filter(Boolean), socialLinks });
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
