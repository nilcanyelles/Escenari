"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { Band } from "@/lib/types";
import { personPhotoDataUri, personColorHue, bandColor, INSTRUMENT_PRESETS, instrumentIconFor, splitInstruments } from "@/lib/tags";
import { updatePersonContactAction } from "@/app/(app)/grups/actions";

function contactActions(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  const intl = digits.indexOf("+") === 0 ? digits.slice(1) : "34" + digits;
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      <a href={"tel:+" + intl} title={"Truca a " + phone} className="row-rs-btn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
      </a>
      <a href={"https://wa.me/" + intl} target="_blank" rel="noopener" title={"WhatsApp a " + phone} className="row-rs-btn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      </a>
    </span>
  );
}

export default function MemberProfileModal({
  name, allBands, concertCountByPerson, onClose,
}: {
  name: string;
  allBands: Band[];
  concertCountByPerson: Record<string, number>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const memberships = useMemo(() => {
    const out: { bandId: string; bandName: string; role: string; listType: "members" | "crew" }[] = [];
    allBands.forEach((b) => {
      (b.members || []).forEach((p) => { if (p.name === name) out.push({ bandId: b.id, bandName: b.name, role: p.role, listType: "members" }); });
      (b.crew || []).forEach((p) => { if (p.name === name) out.push({ bandId: b.id, bandName: b.name, role: p.role, listType: "crew" }); });
    });
    return out;
  }, [allBands, name]);

  const initialPhone = useMemo(() => {
    for (const b of allBands) {
      const m = (b.members || []).concat(b.crew || []).find((p) => p.name === name && p.phone);
      if (m) return m.phone || "";
    }
    return "";
  }, [allBands, name]);
  const initialEmail = useMemo(() => {
    for (const b of allBands) {
      const m = (b.members || []).concat(b.crew || []).find((p) => p.name === name && p.email);
      if (m) return m.email || "";
    }
    return "";
  }, [allBands, name]);

  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);

  const initialInstruments = useMemo(() => {
    for (const b of allBands) {
      const m = (b.members || []).concat(b.crew || []).find((p) => p.name === name && p.instruments && p.instruments.length);
      if (m) return m.instruments as string[];
    }
    // Cap instrument desat encara: dedueix-los dels rols que ja té a cada grup on toca.
    const seen: Record<string, boolean> = {};
    const out: string[] = [];
    memberships.filter((m) => m.listType === "members").forEach((m) => {
      splitInstruments(m.role).forEach((instr) => {
        const key = instr.toLowerCase();
        if (!seen[key]) { seen[key] = true; out.push(instr); }
      });
    });
    return out;
  }, [allBands, memberships, name]);

  const [instruments, setInstruments] = useState(initialInstruments);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const pickerBtnRef = useRef<HTMLButtonElement>(null);

  function openPicker() {
    const btn = pickerBtnRef.current;
    if (btn) {
      const r = btn.getBoundingClientRect();
      const width = 240;
      const left = Math.min(r.left, window.innerWidth - width - 12);
      setPickerPos({ top: r.bottom + 6, left: Math.max(12, left) });
    }
    setPickerOpen(true);
  }

  const pickerOptions = useMemo(() => {
    const selected: Record<string, boolean> = {};
    instruments.forEach((i) => { selected[i.toLowerCase()] = true; });
    const q = pickerSearch.trim().toLowerCase();
    return INSTRUMENT_PRESETS.filter((i) => !selected[i.toLowerCase()] && (!q || i.toLowerCase().includes(q)));
  }, [instruments, pickerSearch]);

  function addInstrument(instr: string) {
    setInstruments((prev) => prev.concat([instr]));
    setPickerSearch("");
    setPickerOpen(false);
  }
  function removeInstrument(instr: string) {
    setInstruments((prev) => prev.filter((i) => i !== instr));
  }

  const concertCount = concertCountByPerson[name] || 0;
  const hue = personColorHue(name);
  const modalStyle = { background: `linear-gradient(160deg, oklch(0.32 0.1 ${hue} / 0.5) 0%, oklch(0.2 0.02 258) 55%), oklch(0.2 0.02 258)` };

  async function handleSave() {
    setSaving(true);
    await updatePersonContactAction({ name, phone, email, instruments });
    router.refresh();
    setSaving(false);
    setIsEditing(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal member-profile-modal" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 24 }}>
          <img className="member-avatar" src={personPhotoDataUri(name)} alt={name} />
          <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
            <div className="band-modal-name">{name}</div>
            <div style={{ fontSize: 13.5, color: "var(--text-faint)", marginTop: 6 }}>{concertCount} {concertCount === 1 ? "concert" : "concerts"} fets</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
            {isEditing ? (
              <button type="button" className="modal-close" title="Desar" aria-label="Desar" disabled={saving} onClick={handleSave}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
            ) : (
              <button type="button" className="modal-close" title="Editar contacte" aria-label="Editar contacte" onClick={() => setIsEditing(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {isEditing ? (
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div><label className="form-label">Telèfon</label><input className="field-input form-field" type="text" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><label className="form-label">Correu electrònic</label><input className="field-input form-field" type="text" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
        ) : (
          <div className="cf-view-grid" style={{ marginBottom: 16 }}>
            <div>
              <span className="form-label">Telèfon</span>
              <div className="cf-view-value" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {phone || "—"}
                {phone && contactActions(phone)}
              </div>
            </div>
            <div><span className="form-label">Correu electrònic</span><div className="cf-view-value">{email || "—"}</div></div>
          </div>
        )}

        {(instruments.length > 0 || isEditing) && (
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Instruments</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
              {instruments.map((instr, i) => {
                const icon = instrumentIconFor(instr);
                return isEditing ? (
                  <span key={i} className="badge instrument-badge">
                    {icon && <img className="instrument-badge-icon" src={icon} alt="" />}
                    {instr}
                    <button type="button" className="instrument-badge-x" title={"Elimina " + instr} onClick={() => removeInstrument(instr)}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </span>
                ) : (
                  <span key={i} className="badge instrument-badge">
                    {icon && <img className="instrument-badge-icon" src={icon} alt="" />}
                    {instr}
                  </span>
                );
              })}
              {isEditing && (
                <button ref={pickerBtnRef} type="button" className="rs-add-btn" style={{ marginTop: 0 }} onClick={() => (pickerOpen ? setPickerOpen(false) : openPicker())}>+ Instrument</button>
              )}
              {pickerOpen && (
                <>
                  <div className="year-picker-overlay" onClick={() => setPickerOpen(false)}></div>
                  <div className="year-dropdown instrument-dropdown" style={{ position: "fixed", top: pickerPos.top, left: pickerPos.left }} onClick={(e) => e.stopPropagation()}>
                    <input className="field-input instrument-search" type="text" placeholder="Cerca un instrument…" autoFocus
                      value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} />
                    <div className="instrument-option-list">
                      {pickerOptions.length ? pickerOptions.map((opt) => (
                        <button key={opt} type="button" className="year-option" onClick={() => addInstrument(opt)}>{opt}</button>
                      )) : <div className="cf-band-noresults">Cap instrument coincideix</div>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="form-label">Grups{memberships.length ? " · " + memberships.length : ""}</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {memberships.map((m, i) => {
              const bc = bandColor(m.bandId);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: bc.color, flex: "none" }}></span>
                  <span className="cf-view-value" style={{ marginTop: 0 }}>{m.bandName}{m.role && <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> — {m.role}</span>}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
