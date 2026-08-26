"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Band } from "@/lib/types";
import { personPhotoDataUri, personColorHue, bandColor, splitInstruments } from "@/lib/tags";
import { instrumentIconKey } from "@/lib/instruments";
import { updatePersonContactAction, updateMembershipRoleAction } from "@/app/(app)/grups/actions";
import InstrumentPicker, { InstrumentIcon } from "@/components/InstrumentPicker";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import { CrewRoleSvg, crewRoleIconKey } from "@/lib/crewRoles";

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
  name, allBands, concertCountByPerson, onClose, onRenamed,
}: {
  name: string;
  allBands: Band[];
  concertCountByPerson: Record<string, number>;
  onClose: () => void;
  onRenamed?: (newName: string) => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(name);

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
  const phoneValid = isValidPhone(phone);
  const emailValid = isValidEmail(email);
  const [showErrors, setShowErrors] = useState(false);

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
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});

  const crewFunctions = useMemo(() => {
    const seen: Record<string, boolean> = {};
    const out: string[] = [];
    memberships.filter((m) => m.listType === "crew" && m.role).forEach((m) => {
      splitInstruments(m.role).forEach((fn) => {
        const key = fn.toLowerCase();
        if (!seen[key]) { seen[key] = true; out.push(fn); }
      });
    });
    return out;
  }, [memberships]);

  const membershipsByBand = useMemo(() => {
    const out: { bandId: string; bandName: string; entries: { listType: "members" | "crew"; role: string }[] }[] = [];
    const byId: Record<string, (typeof out)[number]> = {};
    memberships.forEach((m) => {
      if (!byId[m.bandId]) {
        byId[m.bandId] = { bandId: m.bandId, bandName: m.bandName, entries: [] };
        out.push(byId[m.bandId]);
      }
      byId[m.bandId].entries.push({ listType: m.listType, role: m.role });
    });
    return out;
  }, [memberships]);

  function membershipKey(m: { bandId: string; listType: "members" | "crew" }) {
    return m.bandId + "-" + m.listType;
  }

  function startEditing() {
    const seed: Record<string, string> = {};
    memberships.forEach((m) => { seed[membershipKey(m)] = m.role; });
    setRoleEdits(seed);
    setShowErrors(false);
    setIsEditing(true);
  }

  const concertCount = concertCountByPerson[name] || 0;
  const hue = personColorHue(name);
  const modalStyle = { background: `linear-gradient(160deg, oklch(0.32 0.1 ${hue} / 0.5) 0%, oklch(0.2 0.02 258) 55%), oklch(0.2 0.02 258)` };

  async function handleSave() {
    const newName = editName.trim();
    if (!newName) { setEditName(name); return; }
    if (!phoneValid || !emailValid) { setShowErrors(true); return; }
    setSaving(true);
    await updatePersonContactAction({ name, newName, phone, email, instruments });
    const roleUpdates = memberships.filter((m) => (roleEdits[membershipKey(m)] ?? m.role) !== m.role);
    await Promise.all(roleUpdates.map((m) =>
      updateMembershipRoleAction({ bandId: m.bandId, listType: m.listType, name: newName, role: roleEdits[membershipKey(m)] ?? m.role })
    ));
    router.refresh();
    setSaving(false);
    setIsEditing(false);
    if (newName !== name) onRenamed?.(newName);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal member-profile-modal" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 24 }}>
          <img className="member-avatar" src={personPhotoDataUri(name)} alt={name} />
          <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
            {isEditing ? (
              <input className="field-input" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 17, fontWeight: 700 }}
                type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
            ) : (
              <div className="band-modal-name">{name}</div>
            )}
            <div style={{ fontSize: 13.5, color: "var(--text-faint)", marginTop: 6 }}>{concertCount} {concertCount === 1 ? "concert" : "concerts"} fets</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
            {isEditing ? (
              <button type="button" className="modal-close" title="Desar" aria-label="Desar" disabled={saving} onClick={handleSave}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
            ) : (
              <button type="button" className="modal-close" title="Editar contacte" aria-label="Editar contacte" onClick={startEditing}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {isEditing ? (
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div>
              <label className="form-label">Telèfon</label>
              <input className={"pill-input form-field" + (showErrors && !phoneValid ? " field-error-border" : "")}
                type="tel" inputMode="tel" autoComplete="tel" placeholder="Ex. 612 345 678"
                value={phone} onChange={(e) => setPhone(e.target.value)} />
              {showErrors && !phoneValid && <div className="field-error">Aquest telèfon no sembla vàlid.</div>}
            </div>
            <div>
              <label className="form-label">Correu electrònic</label>
              <input className={"pill-input form-field" + (showErrors && !emailValid ? " field-error-border" : "")}
                type="email" inputMode="email" autoComplete="email" placeholder="nom@exemple.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              {showErrors && !emailValid && <div className="field-error">Aquest correu no sembla vàlid.</div>}
            </div>
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

        {(instruments.length > 0 || crewFunctions.length > 0 || isEditing) && (
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Instruments/funcions</label>
            {isEditing ? (
              <div style={{ marginTop: 6 }}>
                {(instruments.length > 0 || crewFunctions.length > 0) && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {instruments.map((instr, i) => (
                      <span key={i} className="badge instrument-badge">
                        <InstrumentIcon name={instr} icon={instrumentIconKey(instr)} />
                        {instr}
                      </span>
                    ))}
                    {crewFunctions.map((fn, i) => (
                      <span key={i} className="badge instrument-badge crew-badge">
                        <CrewRoleSvg icon={crewRoleIconKey(fn)} />
                        {fn}
                      </span>
                    ))}
                  </div>
                )}
                <button type="button" className="rs-add-btn" style={{ marginTop: 0 }} onClick={() => setPickerOpen((v) => !v)}>+ Instrument</button>
                {pickerOpen && (
                  <div style={{ marginTop: 8 }}>
                    <InstrumentPicker value={instruments} onChange={setInstruments} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {instruments.map((instr, i) => (
                  <span key={i} className="badge instrument-badge">
                    <InstrumentIcon name={instr} icon={instrumentIconKey(instr)} />
                    {instr}
                  </span>
                ))}
                {crewFunctions.map((fn, i) => (
                  <span key={i} className="badge instrument-badge">
                    <CrewRoleSvg icon={crewRoleIconKey(fn)} />
                    {fn}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="form-label">Grups{membershipsByBand.length ? " · " + membershipsByBand.length : ""}</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {membershipsByBand.map((g) => {
              const bc = bandColor(g.bandId);
              return (
                <div key={g.bandId} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: bc.color, flex: "none" }}></span>
                  <span className="cf-view-value" style={{ marginTop: 0, flex: "none" }}>{g.bandName}</span>
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 }}>
                      {g.entries.map((e, ei) => {
                        if (e.listType === "members") {
                          return instruments.length > 0 ? (
                            <span key={ei} style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                              {instruments.map((instr, ii) => (
                                <span key={ii} className="badge instrument-badge sm">
                                  <InstrumentIcon name={instr} icon={instrumentIconKey(instr)} />
                                  {instr}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span key={ei} style={{ fontSize: 12.5, color: "var(--text-fainter)" }}>Cap instrument desat — afegeix-ne a dalt.</span>
                          );
                        }
                        const key = g.bandId + "-" + e.listType;
                        return (
                          <input key={ei} className="pill-input" type="text"
                            placeholder="Funcions (separades per comes)" value={roleEdits[key] ?? e.role}
                            onChange={(ev) => setRoleEdits((prev) => ({ ...prev, [key]: ev.target.value }))} />
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {g.entries.map((e, ei) => (
                        e.listType === "crew" ? (
                          splitInstruments(e.role).map((fn, fi) => (
                            <span key={ei + "-" + fi} className="badge instrument-badge crew-badge sm">
                              <CrewRoleSvg icon={crewRoleIconKey(fn)} size={14} />
                              {fn}
                            </span>
                          ))
                        ) : instruments.length > 0 ? (
                          instruments.map((instr, ii) => (
                            <span key={ei + "-" + ii} className="badge instrument-badge sm">
                              <InstrumentIcon name={instr} icon={instrumentIconKey(instr)} />
                              {instr}
                            </span>
                          ))
                        ) : e.role ? (
                          <span key={ei} style={{ color: "var(--text-muted)", fontWeight: 500 }}>— {e.role}</span>
                        ) : null
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
