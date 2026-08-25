"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Band, Person } from "@/lib/types";
import { bandPhotoDataUri, tagColors, bandColorHue, instrumentsFor, instrumentIconFor, splitInstruments } from "@/lib/tags";
import { saveBandAction, searchCitiesAction, generateJoinCodeAction, revokeJoinCodeAction } from "@/app/(app)/grups/actions";
import MemberProfileModal from "@/components/MemberProfileModal";
import InstrumentPicker from "@/components/InstrumentPicker";
import CrewRolePicker from "@/components/CrewRolePicker";
import { InstrumentSvg } from "@/lib/instruments";
import { CrewRoleSvg, crewRoleIconKey } from "@/lib/crewRoles";

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

function bfFromBand(band: Band): Bf {
  return {
    name: band.name, tags: (band.tags || []).slice(), city: band.city, rate: String(band.rate),
    contact: band.contact, phone: band.phone,
    members: (band.members || []).map((p) => ({ name: p.name, role: p.role, phone: p.phone, email: p.email, instruments: p.instruments })),
    crew: (band.crew || []).map((p) => ({ name: p.name, role: p.role, phone: p.phone, email: p.email, instruments: p.instruments })),
  };
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
  const [bf, setBf] = useState<Bf>(() => bfFromBand(band));
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const lastSyncedBand = useRef(band);

  // La fitxa de perfil (oberta des de la visualització) pot canviar el nom, el
  // contacte, els instruments o el rol d'un membre sense passar per aquí. Quan
  // torna a refrescar dades del servidor, l'estat local es resincronitza
  // perquè la visualització del grup mostri sempre el mateix que el perfil.
  // Es compara per referència perquè sortir del mode edició no dispari una
  // resincronització amb dades encara no refrescades (revertiria el que
  // s'acaba de desar just abans que arribi la resposta del servidor).
  useEffect(() => {
    if (!isEditing && band !== lastSyncedBand.current) {
      setBf(bfFromBand(band));
      lastSyncedBand.current = band;
    }
  }, [band, isEditing]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  async function handleGenerateCode() {
    setCodeBusy(true);
    await generateJoinCodeAction(band.id);
    router.refresh();
    setCodeBusy(false);
  }

  async function handleRevokeCode() {
    setCodeBusy(true);
    await revokeJoinCodeAction(band.id);
    router.refresh();
    setCodeBusy(false);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1500);
    });
  }
  const [instrumentPickerRow, setInstrumentPickerRow] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<"members" | "crew" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState("");
  const [draftInstruments, setDraftInstruments] = useState<string[]>([]);
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [cityResults, setCityResults] = useState<{ description: string; placeId: string }[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const citySearchTimer = useRef<number | null>(null);
  const [copiedEmailKey, setCopiedEmailKey] = useState<string | null>(null);

  function copyEmail(key: string, email: string) {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmailKey(key);
      window.setTimeout(() => setCopiedEmailKey((k) => (k === key ? null : k)), 1500);
    });
  }

  function personContactActions(key: string, p: Person) {
    const phone = (p.phone || "").trim();
    const email = (p.email || "").trim();
    const digits = phone.replace(/[^\d+]/g, "");
    const intl = digits.indexOf("+") === 0 ? digits.slice(1) : "34" + digits;
    return (
      <span style={{ display: "inline-flex", gap: 2, flex: "none" }} onClick={(e) => e.stopPropagation()}>
        <a href={phone ? "tel:+" + intl : undefined} title={phone ? "Truca a " + phone : "Sense telèfon"}
          className="row-rs-btn" aria-disabled={!phone} style={!phone ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        </a>
        <a href={phone ? "https://wa.me/" + intl : undefined} target="_blank" rel="noopener" title={phone ? "WhatsApp a " + phone : "Sense telèfon"}
          className="row-rs-btn" aria-disabled={!phone} style={!phone ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        </a>
        <span style={{ position: "relative" }}>
          <button type="button" className="row-rs-btn" title={email ? "Copia el correu (" + email + ")" : "Sense correu"} disabled={!email}
            onClick={() => email && copyEmail(key, email)}>
            {copiedEmailKey === key ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 6-10 7L2 6"></path></svg>
            )}
          </button>
          {copiedEmailKey === key && <span className="copy-email-toast">{email} copiat</span>}
        </span>
      </span>
    );
  }

  useEffect(() => {
    if (citySearchTimer.current) window.clearTimeout(citySearchTimer.current);
    const q = citySearch.trim();
    if (q.length < 2) { setCityResults([]); setCitySearching(false); return; }
    setCitySearching(true);
    citySearchTimer.current = window.setTimeout(async () => {
      const results = await searchCitiesAction(q);
      setCityResults(results);
      setCitySearching(false);
    }, 300);
    return () => { if (citySearchTimer.current) window.clearTimeout(citySearchTimer.current); };
  }, [citySearch]);

  async function handleSave() {
    setSaving(true);
    await saveBandAction({ id: band.id, ...bf });
    router.refresh();
    setSaving(false);
    setIsEditing(false);
  }

  function startAddPerson(listName: "members" | "crew") {
    setDraftName("");
    setDraftRole("");
    setDraftInstruments([]);
    setDraftPickerOpen(false);
    setAddingTo(listName);
  }

  function cancelAddPerson() {
    setAddingTo(null);
    setDraftName("");
    setDraftRole("");
    setDraftInstruments([]);
    setDraftPickerOpen(false);
  }

  async function confirmAddPerson() {
    if (!addingTo || !draftName.trim()) return;
    const listName = addingTo;
    const person = listName === "members"
      ? { name: draftName.trim(), role: draftRole.trim(), instruments: draftInstruments }
      : { name: draftName.trim(), role: draftRole.trim() };
    const next = { ...bf, [listName]: [...bf[listName], person] };
    setAddingSaving(true);
    setBf(next);
    await saveBandAction({ id: band.id, ...next });
    router.refresh();
    setAddingSaving(false);
    cancelAddPerson();
  }

  function addPersonForm(listName: "members" | "crew") {
    if (addingTo !== listName) return null;
    const isMusician = listName === "members";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Nom" autoFocus
            value={draftName} onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !isMusician) confirmAddPerson(); if (e.key === "Escape") cancelAddPerson(); }} />
          <button type="button" className="rs-mini-btn" title={isMusician ? "Afegeix instruments" : "Afegeix funcions"} aria-label={isMusician ? "Afegeix instruments" : "Afegeix funcions"}
            onClick={() => setDraftPickerOpen((v) => !v)}>
            {isMusician ? <InstrumentSvg icon="note" size={14} /> : <CrewRoleSvg icon={crewRoleIconKey(splitInstruments(draftRole)[0] || "")} size={14} />}
          </button>
          <button type="button" className="rs-mini-btn" title="Desa" disabled={addingSaving || !draftName.trim()} onClick={confirmAddPerson}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <button type="button" className="rs-mini-btn danger" title="Cancel·la" disabled={addingSaving} onClick={cancelAddPerson}>
            <XIcon />
          </button>
        </div>
        {!isMusician && draftRole && !draftPickerOpen && (
          <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", alignSelf: "flex-start" }}>
            {splitInstruments(draftRole).map((fn, i) => (
              <span key={i} className="badge instrument-badge sm">
                <CrewRoleSvg icon={crewRoleIconKey(fn)} size={14} />
                {fn}
              </span>
            ))}
          </span>
        )}
        {draftPickerOpen && (
          isMusician ? (
            <InstrumentPicker value={draftInstruments} onChange={setDraftInstruments} />
          ) : (
            <CrewRolePicker value={splitInstruments(draftRole)} onChange={(next) => setDraftRole(next.join(", "))} />
          )
        )}
      </div>
    );
  }

  function personRow(listName: "members" | "crew", i: number, p: Person) {
    const rowKey = listName + "-" + i;
    const isMusician = listName === "members";
    return (
      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Nom" value={p.name}
            onChange={(e) => setBf((prev) => { const list = [...prev[listName]]; list[i] = { ...list[i], name: e.target.value }; return { ...prev, [listName]: list }; })} />
          <button type="button" className="rs-mini-btn" title={isMusician ? "Afegeix instruments" : "Afegeix funcions"} aria-label={isMusician ? "Afegeix instruments" : "Afegeix funcions"}
            onClick={() => setInstrumentPickerRow((prev) => prev === rowKey ? null : rowKey)}>
            {isMusician ? <InstrumentSvg icon="note" size={14} /> : <CrewRoleSvg icon={crewRoleIconKey(splitInstruments(p.role)[0] || "")} size={14} />}
          </button>
          <button type="button" className="rs-mini-btn danger" title="Elimina"
            onClick={() => setBf((prev) => ({ ...prev, [listName]: prev[listName].filter((_, idx) => idx !== i) }))}>
            <XIcon />
          </button>
        </div>
        {!isMusician && p.role && instrumentPickerRow !== rowKey && (
          <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", alignSelf: "flex-start" }}>
            {splitInstruments(p.role).map((fn, fi) => (
              <span key={fi} className="badge instrument-badge sm">
                <CrewRoleSvg icon={crewRoleIconKey(fn)} size={14} />
                {fn}
              </span>
            ))}
          </span>
        )}
        {instrumentPickerRow === rowKey && (
          isMusician ? (
            <InstrumentPicker
              value={p.instruments || []}
              onChange={(next) => setBf((prev) => { const list = [...prev[listName]]; list[i] = { ...list[i], instruments: next }; return { ...prev, [listName]: list }; })}
            />
          ) : (
            <CrewRolePicker
              value={splitInstruments(p.role)}
              onChange={(next) => setBf((prev) => { const list = [...prev[listName]]; list[i] = { ...list[i], role: next.join(", ") }; return { ...prev, [listName]: list }; })}
            />
          )
        )}
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
              <>
                <div style={{ position: "relative" }}>
                  <button type="button" className="modal-close" title="Comparteix codi d'invitació" aria-label="Comparteix codi d'invitació" onClick={() => setShareOpen((v) => !v)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="10.6" x2="15.4" y2="6.4"></line><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"></line></svg>
                  </button>
                  {shareOpen && (
                    <>
                      <div className="year-picker-overlay" onClick={() => setShareOpen(false)}></div>
                      <div className="year-dropdown share-code-dropdown" onClick={(e) => e.stopPropagation()}>
                        {band.joinCodeActive && band.joinCode ? (
                          <>
                            <div className="share-code-label">Codi d&apos;invitació</div>
                            <button type="button" className="share-code-value" title="Copia el codi" onClick={() => copyCode(band.joinCode as string)}>
                              {band.joinCode}
                              {copiedCode ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                              )}
                            </button>
                            <div className="share-code-hint">Comparteix-lo amb els músics i crew perquè s&apos;uneixin al grup des del seu compte.</div>
                            <button type="button" className="btn-danger-outline" style={{ marginTop: 10, width: "100%", boxSizing: "border-box" }} disabled={codeBusy} onClick={handleRevokeCode}>Bloqueja el codi</button>
                          </>
                        ) : (
                          <>
                            <div className="share-code-hint" style={{ marginTop: 0, marginBottom: 10 }}>Genera un codi perquè els músics i crew s&apos;uneixin al grup des del seu compte.</div>
                            <button type="button" className="btn-primary" style={{ width: "100%", boxSizing: "border-box" }} disabled={codeBusy} onClick={handleGenerateCode}>Genera codi</button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button type="button" className="modal-close" title="Editar" aria-label="Editar" onClick={() => setIsEditing(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
              </>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-form">
          {isEditing ? (
            <>
              <div className="form-row">
                <div style={{ position: "relative" }}>
                  <label className="form-label">Ciutat</label>
                  <input className="field-input form-field" type="text" autoComplete="off" placeholder="Cerca una ciutat…"
                    value={cityDropdownOpen ? citySearch : bf.city}
                    onFocus={(e) => { setCitySearch(""); setCityDropdownOpen(true); e.target.select(); }}
                    onChange={(e) => setCitySearch(e.target.value)} />
                  {cityDropdownOpen && (
                    <>
                      <div className="year-picker-overlay" onClick={() => setCityDropdownOpen(false)}></div>
                      <div className="year-dropdown cf-band-dropdown" onClick={(e) => e.stopPropagation()}>
                        {citySearch.trim().length < 2 ? (
                          <div className="cf-band-noresults">Escriu almenys 2 lletres…</div>
                        ) : citySearching ? (
                          <div className="cf-band-noresults">Cercant…</div>
                        ) : cityResults.length ? cityResults.map((c) => (
                          <button key={c.placeId} type="button" className={"year-option" + (c.description === bf.city ? " active" : "")}
                            onClick={() => { setBf((prev) => ({ ...prev, city: c.description })); setCityDropdownOpen(false); }}>{c.description}</button>
                        )) : <div className="cf-band-noresults">Cap ciutat coincideix</div>}
                      </div>
                    </>
                  )}
                </div>
                <div><label className="form-label">Catxet (€)</label><input className="field-input form-field" type="text" inputMode="numeric" value={bf.rate} onChange={(e) => setBf((prev) => ({ ...prev, rate: e.target.value }))} /></div>
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
              <div>
                <label className="form-label">Músics{bf.members.length ? " · " + bf.members.length : ""}</label>
                {addingTo === "members" ? addPersonForm("members") : (
                  <button type="button" className="rs-add-btn" style={{ marginTop: 6, display: "block" }} onClick={() => startAddPerson("members")}>+ Afegeix músic</button>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {bf.members.length ? bf.members.map((p, i) => {
                    const instruments = instrumentsFor(p);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button type="button" className="cf-view-value member-row-btn" style={{ flex: 1, minWidth: 0 }} onClick={() => setProfileName(p.name)}>
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
                        {personContactActions("members-" + i, p)}
                      </div>
                    );
                  }) : <div className="empty-state">Cap músic registrat.</div>}
                </div>
              </div>
              <div>
                <label className="form-label">Crew{bf.crew.length ? " · " + bf.crew.length : ""}</label>
                {addingTo === "crew" ? addPersonForm("crew") : (
                  <button type="button" className="rs-add-btn" style={{ marginTop: 6, display: "block" }} onClick={() => startAddPerson("crew")}>+ Afegeix membre</button>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {bf.crew.length ? bf.crew.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button type="button" className="cf-view-value member-row-btn" style={{ flex: 1, minWidth: 0 }} onClick={() => setProfileName(p.name)}>
                        <span>{p.name}</span>
                        {p.role && (
                          <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", marginLeft: 8, verticalAlign: "middle" }}>
                            {splitInstruments(p.role).map((fn, fi) => (
                              <span key={fi} className="badge instrument-badge sm">
                                <CrewRoleSvg icon={crewRoleIconKey(fn)} size={14} />
                                {fn}
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                      {personContactActions("crew-" + i, p)}
                    </div>
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
          onRenamed={(newName) => setProfileName(newName)}
        />
      )}
    </div>
  );
}
