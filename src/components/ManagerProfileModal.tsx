"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveManagerProfileAction } from "@/app/(app)/manager-profile-actions";
import { initialsOf } from "@/lib/nav";

export type ManagerProfile = {
  name: string;
  roleLabel: string;
  photoUrl: string;
  phone: string;
  whatsapp: string;
  email: string;
};

// Edició del perfil del gestor des del menú de compte: foto, WhatsApp,
// telèfon, correu i rol. Es reflecteix a l'equip tècnic de tots els grups.
export default function ManagerProfileModal({ profile, onClose }: { profile: ManagerProfile; onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
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
    const fd = new FormData();
    fd.set("role", form.role);
    fd.set("whatsapp", form.whatsapp);
    fd.set("phone", form.phone);
    fd.set("email", form.email);
    const f = fileRef.current?.files?.[0];
    if (f) fd.set("photo", f);
    const res = await saveManagerProfileAction(fd);
    setBusy(false);
    if (!res.ok) { setError(res.error || "No s'ha pogut desar"); return; }
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
                if (f) setPhotoPreview(URL.createObjectURL(f));
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
    </div>
  );
}
