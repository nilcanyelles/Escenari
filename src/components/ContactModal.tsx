"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Contact } from "@/lib/types";
import { personPhotoDataUri, personColorHue } from "@/lib/tags";
import { saveContactAction, deleteContactAction } from "@/app/(app)/contactes/actions";

const KIND_META: Record<string, { label: string; hue: number }> = {
  grup: { label: "Artista", hue: 290 },
  ruta: { label: "Full de ruta", hue: 220 },
  empresa: { label: "Empresa", hue: 155 },
};

type Cf = { name: string; role: string; phone: string; email: string; company: string; cif: string; address: string; iban: string; notes: string };

export default function ContactModal({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const router = useRouter();
  const isNew = !contact;
  const [cf, setCf] = useState<Cf>({
    name: contact?.name || "", role: contact?.role || "", phone: contact?.phone || "", email: contact?.email || "",
    company: contact?.company || "", cif: contact?.cif || "", address: contact?.address || "", iban: contact?.iban || "",
    notes: contact?.notes || "",
  });
  const [isEditing, setIsEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleSave() {
    if (!cf.name.trim()) return;
    setSaving(true);
    await saveContactAction({ id: contact?.id || null, ...cf });
    router.refresh();
    setSaving(false);
    if (isNew) onClose();
    else setIsEditing(false);
  }

  async function handleDelete() {
    if (!contact) return;
    setShowDeleteConfirm(false);
    setSaving(true);
    await deleteContactAction(contact.id);
    router.refresh();
    setSaving(false);
    onClose();
  }

  const hue = personColorHue(cf.name || "?");
  const modalStyle = { background: `linear-gradient(160deg, oklch(0.32 0.1 ${hue} / 0.5) 0%, oklch(0.2 0.02 258) 55%), oklch(0.2 0.02 258)` };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal member-profile-modal" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 24 }}>
          {!isNew && <img className="member-avatar" src={personPhotoDataUri(cf.name || contact!.name)} alt="" />}
          <div style={{ flex: 1, minWidth: 0, paddingTop: isNew ? 0 : 6 }}>
            {isEditing ? (
              <input className="field-input" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, background: "oklch(1 0 0 / 0.1)", borderColor: "transparent", color: "#fff" }}
                type="text" placeholder="Nom del contacte" value={cf.name} onChange={(e) => setCf((p) => ({ ...p, name: e.target.value }))} autoFocus={isNew} />
            ) : (
              <div className="band-modal-name">{cf.name}</div>
            )}
            {!isNew && contact!.kinds.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                {contact!.kinds.map((k) => {
                  const meta = KIND_META[k] || { label: k, hue: 258 };
                  return <span key={k} className="badge" style={{ background: `oklch(0.72 0.14 ${meta.hue} / 0.16)`, color: `oklch(0.75 0.14 ${meta.hue})` }}>{meta.label}</span>;
                })}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
            {isEditing ? (
              <button type="button" className="modal-close" title="Desar" aria-label="Desar" disabled={saving} onClick={handleSave}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
            ) : (
              <button type="button" className="modal-close" title="Editar" aria-label="Editar" onClick={() => setIsEditing(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {isEditing ? (
          <>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div><label className="form-label">Rol / càrrec</label><input className="field-input form-field" type="text" value={cf.role} onChange={(e) => setCf((p) => ({ ...p, role: e.target.value }))} /></div>
              <div><label className="form-label">Empresa</label><input className="field-input form-field" type="text" value={cf.company} onChange={(e) => setCf((p) => ({ ...p, company: e.target.value }))} /></div>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div><label className="form-label">Telèfon</label><input className="field-input form-field" type="text" value={cf.phone} onChange={(e) => setCf((p) => ({ ...p, phone: e.target.value }))} /></div>
              <div><label className="form-label">Correu electrònic</label><input className="field-input form-field" type="text" value={cf.email} onChange={(e) => setCf((p) => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div><label className="form-label">CIF/NIF</label><input className="field-input form-field" type="text" value={cf.cif} onChange={(e) => setCf((p) => ({ ...p, cif: e.target.value }))} /></div>
              <div><label className="form-label">IBAN</label><input className="field-input form-field" type="text" value={cf.iban} onChange={(e) => setCf((p) => ({ ...p, iban: e.target.value }))} /></div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Adreça</label>
              <input className="field-input form-field" type="text" value={cf.address} onChange={(e) => setCf((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Notes</label>
              <input className="field-input form-field" type="text" value={cf.notes} onChange={(e) => setCf((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </>
        ) : (
          <>
            <div className="cf-view-grid" style={{ marginBottom: 16 }}>
              <div><span className="form-label">Rol / càrrec</span><div className="cf-view-value">{cf.role || "—"}</div></div>
              <div><span className="form-label">Empresa</span><div className="cf-view-value">{cf.company || "—"}</div></div>
              <div><span className="form-label">Telèfon</span><div className="cf-view-value">{cf.phone || "—"}</div></div>
              <div><span className="form-label">Correu electrònic</span><div className="cf-view-value">{cf.email || "—"}</div></div>
              <div><span className="form-label">CIF/NIF</span><div className="cf-view-value">{cf.cif || "—"}</div></div>
              <div><span className="form-label">IBAN</span><div className="cf-view-value">{cf.iban || "—"}</div></div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="form-label">Adreça</span>
              <div className="cf-view-value">{cf.address || "—"}</div>
            </div>
            {cf.notes && (
              <div style={{ marginBottom: 16 }}>
                <span className="form-label">Notes</span>
                <div className="cf-view-value">{cf.notes}</div>
              </div>
            )}
          </>
        )}

        {!isNew && (
          <button type="button" className="cf-delete-btn" disabled={saving} onClick={() => setShowDeleteConfirm(true)}>
            <span>Eliminar contacte</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay cf-confirm-overlay" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}>
          <div className="modal cf-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cf-confirm-message">Estàs segur que vols eliminar aquest contacte?</div>
            <div className="modal-actions cf-confirm-actions">
              <button type="button" className="btn-danger-outline" disabled={saving} onClick={handleDelete}>Eliminar</button>
              <button type="button" className="btn-outline" onClick={() => setShowDeleteConfirm(false)}>Torna enrere</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
