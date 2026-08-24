"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Band, Person } from "@/lib/types";
import { bandPhotoDataUri, tagColors, bandColorHue, instrumentsFor, instrumentIconFor } from "@/lib/tags";
import { saveBandAction } from "@/app/(app)/grups/actions";
import MemberProfileModal from "@/components/MemberProfileModal";

type Bf = {
  name: string;
  tags: string[];
  city: string;
  rate: string;
  contact: string;
  phone: string;
  members: Person[];
  crew: Person[];
};

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}

export default function BandModal({
  band, allBands, concertCountByPerson, onClose,
}: {
  band: Band;
  allBands: Band[];
  concertCountByPerson: Record<string, number>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [bf, setBf] = useState<Bf>({
    name: band.name, tags: (band.tags || []).slice(), city: band.city, rate: String(band.rate),
    contact: band.contact, phone: band.phone,
    members: (band.members || []).map((p) => ({ name: p.name, role: p.role, phone: p.phone, email: p.email, instruments: p.instruments })),
    crew: (band.crew || []).map((p) => ({ name: p.name, role: p.role, phone: p.phone, email: p.email, instruments: p.instruments })),
  });
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    await saveBandAction({ id: band.id, ...bf });
    router.refresh();
    setSaving(false);
    onClose();
  }

  function personRow(listName: "members" | "crew", i: number, p: Person) {
    return (
      <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Nom" value={p.name}
          onChange={(e) => setBf((prev) => { const list = [...prev[listName]]; list[i] = { ...list[i], name: e.target.value }; return { ...prev, [listName]: list }; })} />
        <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Instrument/funció" value={p.role}
          onChange={(e) => setBf((prev) => { const list = [...prev[listName]]; list[i] = { ...list[i], role: e.target.value }; return { ...prev, [listName]: list }; })} />
        <button type="button" className="rs-mini-btn danger" title="Elimina"
          onClick={() => setBf((prev) => ({ ...prev, [listName]: prev[listName].filter((_, idx) => idx !== i) }))}>
          <XIcon />
        </button>
      </div>
    );
  }

  const bandHue = bandColorHue(band.id);
  const modalStyle = { background: `linear-gradient(160deg, oklch(0.32 0.1 ${bandHue} / 0.55) 0%, oklch(0.2 0.02 258) 55%), oklch(0.2 0.02 258)` };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide band-edit-modal" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div className="band-modal-head" style={{ backgroundImage: `linear-gradient(180deg, rgba(9,7,16,0.88) 0%, rgba(9,7,16,0.55) 45%, rgba(9,7,16,0.32) 100%), url("${band.logo || bandPhotoDataUri(band)}")` }}>
          {isEditing ? (
            <div style={{ width: "100%" }}>
              <input className="field-input" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 17, fontWeight: 700, background: "oklch(1 0 0 / 0.12)", borderColor: "transparent", color: "#fff" }}
                type="text" value={bf.name} onChange={(e) => setBf((prev) => ({ ...prev, name: e.target.value }))} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                {bf.tags.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input className="field-input" style={{ width: 110, padding: "6px 8px", fontSize: 12 }} type="text" placeholder="Etiqueta" value={t}
                      onChange={(e) => setBf((prev) => { const tags = [...prev.tags]; tags[i] = e.target.value; return { ...prev, tags }; })} />
                    <button type="button" className="rs-mini-btn danger" title="Elimina"
                      onClick={() => setBf((prev) => ({ ...prev, tags: prev.tags.filter((_, idx) => idx !== i) }))}>
                      <XIcon />
                    </button>
                  </div>
                ))}
                <button type="button" className="rs-add-btn" style={{ color: "#fff", alignSelf: "center", marginTop: 0 }}
                  onClick={() => setBf((prev) => ({ ...prev, tags: [...prev.tags, ""] }))}>+ Etiqueta</button>
              </div>
            </div>
          ) : (
            <div style={{ width: "100%" }}>
              <div className="band-modal-name">{bf.name}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                {bf.tags.map((t, i) => {
                  const tc = tagColors(t);
                  return <span key={i} className="badge" style={{ background: tc.bg, color: tc.color }}>{t}</span>;
                })}
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
            {isEditing ? (
              <button type="button" className="modal-close" title="Desar i tornar" aria-label="Desar i tornar" disabled={saving} onClick={handleSave}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
            ) : (
              <button type="button" className="modal-close" title="Editar" aria-label="Editar" onClick={() => setIsEditing(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-form">
          {isEditing ? (
            <>
              <div className="form-row">
                <div><label className="form-label">Ciutat</label><input className="field-input form-field" type="text" value={bf.city} onChange={(e) => setBf((prev) => ({ ...prev, city: e.target.value }))} /></div>
                <div><label className="form-label">Catxet (€)</label><input className="field-input form-field" type="text" inputMode="numeric" value={bf.rate} onChange={(e) => setBf((prev) => ({ ...prev, rate: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div><label className="form-label">Contacte</label><input className="field-input form-field" type="text" value={bf.contact} onChange={(e) => setBf((prev) => ({ ...prev, contact: e.target.value }))} /></div>
                <div><label className="form-label">Telèfon</label><input className="field-input form-field" type="text" value={bf.phone} onChange={(e) => setBf((prev) => ({ ...prev, phone: e.target.value }))} /></div>
              </div>
              <div>
                <label className="form-label">Músics</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                  {bf.members.map((p, i) => personRow("members", i, p))}
                </div>
                <button type="button" className="rs-add-btn" style={{ marginTop: 8 }}
                  onClick={() => setBf((prev) => ({ ...prev, members: [...prev.members, { name: "", role: "" }] }))}>+ Afegeix músic</button>
              </div>
              <div>
                <label className="form-label">Crew</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                  {bf.crew.map((p, i) => personRow("crew", i, p))}
                </div>
                <button type="button" className="rs-add-btn" style={{ marginTop: 8 }}
                  onClick={() => setBf((prev) => ({ ...prev, crew: [...prev.crew, { name: "", role: "" }] }))}>+ Afegeix crew</button>
              </div>
            </>
          ) : (
            <div className="band-info-view">
              <div><span className="form-label">Catxet</span><div className="cf-view-value">{bf.rate} €</div></div>
              {band.joinCode && (
                <div>
                  <span className="form-label">Codi d&apos;invitació</span>
                  <div className="cf-view-value" style={{ fontFamily: "'Space Grotesk',monospace", letterSpacing: 3, fontWeight: 700 }}>
                    {band.joinCode}
                    <span style={{ display: "block", fontSize: 11.5, letterSpacing: 0, fontWeight: 400, color: "var(--text-muted)", marginTop: 2 }}>
                      Comparteix-lo amb els músics perquè s&apos;uneixin al grup des del seu compte.
                    </span>
                  </div>
                </div>
              )}
              <div>
                <label className="form-label">Músics{bf.members.length ? " · " + bf.members.length : ""}</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                  {bf.members.length ? bf.members.map((p, i) => {
                    const instruments = instrumentsFor(p);
                    return (
                      <button key={i} type="button" className="cf-view-value member-row-btn" onClick={() => setProfileName(p.name)}>
                        <span>{p.name}</span>
                        {instruments.length > 0 && (
                          <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", marginLeft: 8, verticalAlign: "middle" }}>
                            {instruments.map((instr, j) => {
                              const icon = instrumentIconFor(instr);
                              return (
                                <span key={j} className="badge instrument-badge sm">
                                  {icon && <img className="instrument-badge-icon" src={icon} alt="" />}
                                  {instr}
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </button>
                    );
                  }) : <div className="empty-state">Cap músic registrat.</div>}
                </div>
              </div>
              <div>
                <label className="form-label">Crew{bf.crew.length ? " · " + bf.crew.length : ""}</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {bf.crew.length ? bf.crew.map((p, i) => (
                    <button key={i} type="button" className="cf-view-value member-row-btn" onClick={() => setProfileName(p.name)}>
                      {p.name}{p.role && <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> — {p.role}</span>}
                    </button>
                  )) : <div className="empty-state">Cap crew registrat.</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {profileName && (
        <MemberProfileModal
          key={profileName}
          name={profileName}
          allBands={allBands}
          concertCountByPerson={concertCountByPerson}
          onClose={() => setProfileName(null)}
        />
      )}
    </div>
  );
}
