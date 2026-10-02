"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveManagerProfileAction } from "@/app/(app)/manager-profile-actions";
import { initialsOf } from "@/lib/nav";
import ImageCropModal from "@/components/ImageCropModal";

export type ManagerProfile = {
  name: string;
  roleLabel: string;
  photoUrl: string;
  phone: string;
  whatsapp: string;
  email: string;
};

// Edició del perfil del gestor des del menú de compte: foto, WhatsApp,
// telèfon, correu i rol (es reflecteix a l'equip tècnic de tots els grups).
export default function ManagerProfileModal({ profile, onClose }: { profile: ManagerProfile; onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  // Fitxer acabat de triar, pendent de retallar — obre ImageCropModal.
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    role: profile.roleLabel || "Mànager",
    whatsapp: profile.whatsapp,
    phone: profile.phone,
    email: profile.email,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shownPhoto = photoPreview || profile.photoUrl;

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("role", form.role);
      fd.set("whatsapp", form.whatsapp);
      fd.set("phone", form.phone);
      fd.set("email", form.email);
      if (photoFile) fd.set("photo", photoFile);
      const res = await saveManagerProfileAction(fd);
      if (!res.ok) { setBusy(false); setError(res.error || "No s'ha pogut desar"); return; }
    } catch {
      // Si el servidor triga massa (la foto és gran, o hi ha molts grups a
      // sincronitzar) la crida pot acabar rebutjada en lloc de respondre
      // net — sense aquest catch el botó es quedava a "Desant…" per sempre.
      setBusy(false);
      setError("No s'ha pogut desar — torna-ho a provar");
      return;
    }
    setBusy(false);
    router.refresh();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">El meu perfil</div>
          <button className="cf-head-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <div className="mp-avatar-row">
            <button type="button" className="mp-avatar" onClick={() => fileRef.current?.click()} title="Canvia la foto">
              {shownPhoto ? <img src={shownPhoto} alt="" /> : <span>{initialsOf(profile.name)}</span>}
              <span className="mp-avatar-edit">📷</span>
            </button>
            <div>
              <div className="t-strong" style={{ fontSize: 15 }}>{profile.name}</div>
              <div className="t-dim" style={{ fontSize: 12 }}>Fes clic a la foto per canviar-la</div>
            </div>
            <input
              ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setCropFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <div>
            <label className="form-label">Rol (com apareixes a l&apos;equip tècnic)</label>
            <input className="field-input form-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Mànager" />
          </div>
          <div>
            <label className="form-label">WhatsApp</label>
            <input className="field-input form-field" type="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+34 600 00 00 00" />
          </div>
          <div>
            <label className="form-label">Telèfon</label>
            <input className="field-input form-field" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+34 600 00 00 00" />
          </div>
          <div>
            <label className="form-label">Correu de contacte</label>
            <input className="field-input form-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tu@exemple.cat" />
            <div className="t-dim" style={{ fontSize: 11.5, marginTop: 4 }}>És el correu que veuen els grups — no canvia el correu d&apos;inici de sessió.</div>
          </div>
          {error && <div className="fin-neg" style={{ fontSize: 13 }}>{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel·la</button>
            <button type="button" className="btn-save" disabled={busy} onClick={handleSave}>{busy ? "Desant…" : "Desa"}</button>
          </div>
        </div>
      </div>
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          aspect={1}
          circular
          title="Retalla la foto de perfil"
          onCancel={() => setCropFile(null)}
          onDone={(blob) => {
            setCropFile(null);
            const f = new File([blob], "perfil.png", { type: "image/png" });
            setPhotoFile(f);
            setPhotoPreview(URL.createObjectURL(blob));
          }}
        />
      )}
    </div>
  );
}
