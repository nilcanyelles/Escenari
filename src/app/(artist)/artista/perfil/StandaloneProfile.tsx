"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { personPhotoDataUri } from "@/lib/tags";
import InstrumentPicker from "@/components/InstrumentPicker";
import NavAppBadge from "@/components/NavAppBadge";
import { NAV_APP_OPTIONS, type NavApp } from "@/lib/nav-app";
import { updateStandaloneProfileAction, uploadStandalonePhotoAction } from "./standalone-actions";

// Perfil del músic abans d'unir-se a cap grup: foto, xarxes, contacte i
// instruments, desats directament al seu compte (profiles). Quan s'uneixi
// a un grup, aquestes dades es copien soles al perfil públic del grup.
export default function StandaloneProfile({ name, initial }: {
  name: string;
  initial: { photoFileId: string | null; bio: string; igHandle: string; phone: string; whatsapp: string; instruments: string[]; navApp: NavApp };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [navSaving, setNavSaving] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  async function handleNavApp(navApp: NavApp) {
    setForm((f) => ({ ...f, navApp }));
    setNavSaving(true);
    await updateStandaloneProfileAction({ navApp });
    setNavSaving(false);
  }

  const photoUrl = localPhoto || (initial.photoFileId ? `/api/file/${initial.photoFileId}?v=${initial.photoFileId}` : personPhotoDataUri(name));

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.set("file", f);
    const res = await uploadStandalonePhotoAction(fd);
    if (!res.ok) alert(res.error);
    else setLocalPhoto(URL.createObjectURL(f));
    router.refresh();
    e.target.value = "";
  }

  async function handleSave() {
    setSaving(true);
    await updateStandaloneProfileAction({
      bio: form.bio, igHandle: form.igHandle, phone: form.phone, instruments: form.instruments,
    });
    router.refresh();
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <div className="panel-title" style={{ marginBottom: 4 }}>El teu perfil</div>
      <div className="t-dim" style={{ fontSize: 13, marginBottom: 16 }}>
        Encara no estàs a cap grup. Quan t&apos;uneixis amb el codi apareixeràn aquí.
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div className="pv-photo-wrap" style={{ width: 150, height: 150, flex: "none" }}>
          <img className="pv-photo" src={photoUrl} alt={name} style={{ width: "100%", height: "100%" }} />
          <button type="button" className="pv-photo-edit" title="Canvia la foto" onClick={() => photoInput.current?.click()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </button>
          <input ref={photoInput} type="file" hidden accept="image/*" onChange={handlePhoto} />
        </div>
        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label className="form-label">Instruments</label>
            <InstrumentPicker value={form.instruments} onChange={(next) => setForm({ ...form, instruments: next })} /></div>
          <div><label className="form-label">Instagram</label>
            <input className="field-input form-field" placeholder="@elteuusuari" value={form.igHandle}
              onChange={(e) => setForm({ ...form, igHandle: e.target.value })} /></div>
          <div><label className="form-label">Telèfon</label>
            <input className="field-input form-field" placeholder="+34 600 000 000" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="form-label">Bio</label>
            <textarea className="field-input rider-textarea" rows={3} placeholder="Presenta't en dues frases…" value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <div>
            <label className="form-label">App de navegació preferida</label>
            <div className="t-dim" style={{ fontSize: 11.5, marginBottom: 6 }}>Amb quina app s&apos;obren les ubicacions del full de ruta.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {NAV_APP_OPTIONS.map((o) => (
                <button key={o.value} type="button" className={"access-chip navapp-chip" + (form.navApp === o.value ? " active" : "")}
                  disabled={navSaving} onClick={() => handleNavApp(o.value)}>
                  <NavAppBadge app={o.value} size={15} />{o.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn-save" style={{ alignSelf: "flex-start" }} disabled={saving} onClick={handleSave}>
            {saving ? "Desant…" : saved ? "Desat ✓" : "Desa"}
          </button>
        </div>
      </div>
    </div>
  );
}
