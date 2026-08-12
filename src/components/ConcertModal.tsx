"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Band, Concert, Person } from "@/lib/types";
import { MONTH_FULL, WEEKDAY_SHORT, pad2, capitalize, formatDateLong, statusColors, today } from "@/lib/format";
import { saveConcertAction, deleteConcertAction } from "@/app/(app)/concerts/actions";
import { rsIsComplete } from "@/lib/route-sheet";
import { bandColorHue } from "@/lib/tags";
import RouteSheetEditor from "@/components/RouteSheetEditor";
import ShareStoryModal from "@/components/ShareStoryModal";

type Cf = {
  bandId: string;
  bandName: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  festaEntitat: string;
  amount: string;
  status: string;
  attendance: Record<string, string>;
  substitutes: Record<string, string>;
  noSubstitute: Record<string, boolean>;
};

function personLabel(m: Person): string {
  return m.name + (m.role ? " — " + m.role : "");
}

export default function ConcertModal({
  mode, concert, bands, onClose, onOpenRouteSheetPreview, onNavigate, hasPrev, hasNext,
}: {
  mode: "new" | "edit";
  concert: Concert | null;
  bands: Band[];
  onClose: () => void;
  onOpenRouteSheetPreview?: () => void;
  onNavigate?: (dir: "prev" | "next") => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const router = useRouter();
  const [cf, setCf] = useState<Cf>(() => {
    if (mode === "edit" && concert) {
      return {
        bandId: concert.bandId, bandName: concert.bandName, date: concert.date, time: concert.time,
        venue: concert.venue, city: concert.city, festaEntitat: concert.festaEntitat || "", amount: String(concert.amount), status: concert.status,
        attendance: { ...(concert.attendance || {}) }, substitutes: { ...(concert.substitutes || {}) }, noSubstitute: { ...(concert.noSubstitute || {}) },
      };
    }
    return {
      bandId: bands[0]?.id || "", bandName: bands[0]?.name || "", date: today(), time: "21:00",
      venue: "", city: "", festaEntitat: "", amount: "1500", status: "confirmat", attendance: {}, substitutes: {}, noSubstitute: {},
    };
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerYM, setPickerYM] = useState((cf.date || today()).slice(0, 7));
  const [bandDropdownOpen, setBandDropdownOpen] = useState(false);
  const [bandSearch, setBandSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === "new");
  const [editSnapshot, setEditSnapshot] = useState<Cf | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "routesheet" | "attendance">("info");
  const [shareOpen, setShareOpen] = useState(false);
  const substituteSaveTimer = useRef<number | null>(null);

  const bandTyped = (cf.bandName || "").trim().toLowerCase();
  const currentBand = bands.find((b) => b.name.toLowerCase() === bandTyped) || bands.find((b) => b.id === cf.bandId);
  const bandSearchLower = bandSearch.trim().toLowerCase();
  const bandMatches = bands.filter((b) => !bandSearchLower || b.name.toLowerCase().indexOf(bandSearchLower) !== -1);

  async function persist(payload: Cf) {
    setSaving(true);
    await saveConcertAction({
      id: mode === "edit" ? concert!.id : null,
      bandName: payload.bandName, date: payload.date, time: payload.time, venue: payload.venue, city: payload.city,
      festaEntitat: payload.festaEntitat, amount: parseInt(payload.amount, 10) || 0, status: payload.status,
      attendance: payload.attendance, substitutes: payload.substitutes, noSubstitute: payload.noSubstitute,
    });
    router.refresh();
    setSaving(false);
  }

  async function handleCreate() {
    await persist(cf);
    onClose();
  }

  function startEditing() {
    setEditSnapshot(cf);
    setIsEditing(true);
  }

  async function confirmEdit() {
    await persist(cf);
    setEditSnapshot(null);
    setIsEditing(false);
  }

  function discardEditAndGoBack() {
    if (editSnapshot) {
      setCf((prev) => ({
        ...prev,
        bandId: editSnapshot.bandId, bandName: editSnapshot.bandName, date: editSnapshot.date, time: editSnapshot.time,
        venue: editSnapshot.venue, city: editSnapshot.city, festaEntitat: editSnapshot.festaEntitat, amount: editSnapshot.amount, status: editSnapshot.status,
      }));
    }
    setEditSnapshot(null);
    setIsEditing(false);
  }

  function handleCloseClick() {
    if (mode === "edit" && isEditing) discardEditAndGoBack();
    else onClose();
  }

  async function handleDelete() {
    if (!concert) return;
    if (!confirm("Segur que vols eliminar aquest concert?")) return;
    setSaving(true);
    await deleteConcertAction(concert.id);
    router.refresh();
    setSaving(false);
    onClose();
  }

  function setAttendance(name: string, value: string) {
    setCf((prev) => {
      const attendance = { ...prev.attendance, [name]: value };
      const substitutes = { ...prev.substitutes };
      if (value === "no" && substitutes[name] === undefined) substitutes[name] = "";
      const next = { ...prev, attendance, substitutes };
      if (mode === "edit") persist(next);
      return next;
    });
  }
  function resetAttendance(name: string) {
    setCf((prev) => {
      const attendance = { ...prev.attendance }; delete attendance[name];
      const substitutes = { ...prev.substitutes }; delete substitutes[name];
      const noSubstitute = { ...prev.noSubstitute }; delete noSubstitute[name];
      const next = { ...prev, attendance, substitutes, noSubstitute };
      if (mode === "edit") persist(next);
      return next;
    });
  }
  function markNoSubstitute(name: string) {
    setCf((prev) => {
      const next = { ...prev, noSubstitute: { ...prev.noSubstitute, [name]: true }, substitutes: { ...prev.substitutes, [name]: "" } };
      if (mode === "edit") persist(next);
      return next;
    });
  }
  function setSubstituteName(name: string, value: string) {
    setCf((prev) => {
      const next = { ...prev, substitutes: { ...prev.substitutes, [name]: value } };
      if (mode === "edit") {
        if (substituteSaveTimer.current) window.clearTimeout(substituteSaveTimer.current);
        substituteSaveTimer.current = window.setTimeout(() => { persist(next); }, 500);
      }
      return next;
    });
  }

  function renderAttendanceRows(people: Person[]) {
    return people.map((m) => {
      const state = cf.attendance[m.name];
      if (state === "yes") {
        return (
          <div key={m.name} className="cf-convocat-row cf-convocat-yes" title="Clica per reiniciar" onClick={() => resetAttendance(m.name)}>
            <span className="cf-convocat-name">{personLabel(m)}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        );
      } else if (state === "no") {
        return (
          <div key={m.name}>
            <div className="cf-convocat-row cf-convocat-no" title="Clica per reiniciar" onClick={() => resetAttendance(m.name)}>
              <span className="cf-convocat-name">{personLabel(m)}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
            {!cf.noSubstitute[m.name] && (
              <div className="cf-substitute-row">
                <input className="field-input cf-substitute-input" type="text" placeholder="Nom del substitut"
                  value={cf.substitutes[m.name] || ""}
                  onChange={(e) => setSubstituteName(m.name, e.target.value)} />
                <span className="cf-substitute-role">{m.role ? " — " + m.role : ""}</span>
                <button type="button" className="cf-substitute-none-btn" title="Sense substitut" aria-label="Sense substitut" onClick={() => markNoSubstitute(m.name)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            )}
          </div>
        );
      }
      return (
        <div key={m.name} className="cf-convocat-row">
          <span className="cf-convocat-name">{personLabel(m)}</span>
          <div className="cf-convocat-controls">
            <button type="button" className="cf-attend-btn yes" title="Confirma assistència" onClick={() => setAttendance(m.name, "yes")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button type="button" className="cf-attend-btn no" title="No pot assistir" onClick={() => setAttendance(m.name, "no")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      );
    });
  }

  const hasMusics = currentBand && currentBand.members && currentBand.members.length > 0;
  const hasCrew = currentBand && currentBand.crew && currentBand.crew.length > 0;

  // Date picker grid
  const y = parseInt(pickerYM.slice(0, 4), 10), mIdx = parseInt(pickerYM.slice(5, 7), 10) - 1;
  const dpMonthLabel = capitalize(MONTH_FULL[mIdx]) + " " + y;
  const dpBase = new Date(y, mIdx, 1);
  const dpStartOffset = (dpBase.getDay() + 6) % 7;
  const dpDaysInMonth = new Date(y, mIdx + 1, 0).getDate();
  const dpCells: (number | null)[] = [];
  for (let i = 0; i < dpStartOffset; i++) dpCells.push(null);
  for (let d = 1; d <= dpDaysInMonth; d++) dpCells.push(d);
  while (dpCells.length % 7 !== 0) dpCells.push(null);

  function shiftPickerMonth(delta: number) {
    const d = new Date(y, mIdx + delta, 1);
    setPickerYM(d.getFullYear() + "-" + pad2(d.getMonth() + 1));
  }

  const [routeSheetComplete, setRouteSheetComplete] = useState(() => mode === "edit" && concert ? rsIsComplete(concert) : false);
  const rsBadgeColors = routeSheetComplete
    ? { bg: "oklch(0.72 0.15 155 / 0.16)", color: "oklch(0.78 0.15 155)" }
    : { bg: "oklch(0.78 0.15 80 / 0.16)", color: "oklch(0.82 0.15 80)" };

  const bandHue = cf.bandId ? bandColorHue(cf.bandId) : null;
  const modalStyle = bandHue !== null
    ? { background: `linear-gradient(160deg, oklch(0.32 0.1 ${bandHue} / 0.55) 0%, oklch(0.2 0.02 258) 55%), oklch(0.2 0.02 258)` }
    : undefined;

  useEffect(() => {
    if (!onNavigate) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (shareOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft" && hasPrev) onNavigate!("prev");
      else if (e.key === "ArrowRight" && hasNext) onNavigate!("next");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNavigate, hasPrev, hasNext, shareOpen]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      {onNavigate && (
        <button type="button" className="cf-nav-edge-btn" title="Concert anterior" aria-label="Concert anterior" disabled={!hasPrev} onClick={(e) => { e.stopPropagation(); onNavigate("prev"); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
      )}
      <div className="modal concert-modal" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="modal-title">{mode === "new" ? "Nou concert" : "Detall del concert"}</div>
            {mode === "edit" && saving && <span className="cf-saving-indicator">Desant…</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {mode === "edit" && activeTab === "info" && !isEditing && (
              <button type="button" className="row-rs-btn" title="Comparteix l'story" aria-label="Comparteix l'story" onClick={() => setShareOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              </button>
            )}
            {mode === "edit" && activeTab === "info" && (
              isEditing ? (
                <button type="button" className="row-rs-btn" title="Guardar canvis" aria-label="Guardar canvis" disabled={saving} onClick={confirmEdit}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
              ) : (
                <button type="button" className="row-rs-btn" title="Editar" aria-label="Editar" onClick={startEditing}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
              )
            )}
            {mode === "new" && (
              <button type="button" className="row-rs-btn" title="Crear concert" aria-label="Crear concert" disabled={saving} onClick={handleCreate}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              </button>
            )}
            <button className="modal-close" title="Cancel·lar" aria-label="Cancel·lar" onClick={handleCloseClick}>✕</button>
          </div>
        </div>

        {mode === "edit" && (
          <div className="modal-tabs">
            <button type="button" className={activeTab === "info" ? "active" : ""} onClick={() => setActiveTab("info")}>Info</button>
            <div className="cf-rs-tab-wrap">
              {!routeSheetComplete && (
                <div className="cf-rs-warning-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  <span>Inacabat</span>
                </div>
              )}
              <button type="button" className={activeTab === "routesheet" ? "active" : ""} onClick={() => setActiveTab("routesheet")}>Full de ruta</button>
            </div>
            <button type="button" className={activeTab === "attendance" ? "active" : ""} onClick={() => setActiveTab("attendance")}>Assistència</button>
          </div>
        )}

        <div className="modal-form">
          {activeTab === "info" && (
            isEditing ? (
              <>
                <div className="form-row">
                  <div style={{ position: "relative" }}>
                    <label className="form-label">Grup</label>
                    <input className="field-input form-field" type="text" autoComplete="off" placeholder="Cerca o selecciona un grup…"
                      value={bandDropdownOpen ? bandSearch : cf.bandName}
                      onFocus={(e) => { setBandSearch(""); setBandDropdownOpen(true); e.target.select(); }}
                      onChange={(e) => setBandSearch(e.target.value)} />
                    {bandDropdownOpen && (
                      <>
                        <div className="year-picker-overlay" onClick={() => setBandDropdownOpen(false)}></div>
                        <div className="year-dropdown cf-band-dropdown" onClick={(e) => e.stopPropagation()}>
                          {bandMatches.length ? bandMatches.map((b) => (
                            <button key={b.id} type="button" className={"year-option" + (b.id === cf.bandId ? " active" : "")} onClick={() => {
                              setCf((prev) => ({ ...prev, bandName: b.name, bandId: b.id, attendance: {}, substitutes: {}, noSubstitute: {} }));
                              setBandDropdownOpen(false);
                            }}>{b.name}</button>
                          )) : <div className="cf-band-noresults">Cap grup coincideix</div>}
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <label className="form-label">Data</label>
                    <input className="field-input form-field" type="text" readOnly placeholder="Selecciona una data"
                      value={cf.date ? formatDateLong(cf.date) : ""}
                      onClick={() => { setPickerYM((cf.date || today()).slice(0, 7)); setDatePickerOpen((v) => !v); }} />
                    {datePickerOpen && (
                      <>
                        <div className="year-picker-overlay" onClick={() => setDatePickerOpen(false)}></div>
                        <div className="year-dropdown cf-datepicker" onClick={(e) => e.stopPropagation()}>
                          <div className="cf-dp-header">
                            <button type="button" className="cal-nav-btn" onClick={() => shiftPickerMonth(-1)}>‹</button>
                            <div className="cf-dp-month-label">{dpMonthLabel}</div>
                            <button type="button" className="cal-nav-btn" onClick={() => shiftPickerMonth(1)}>›</button>
                          </div>
                          <div className="cf-dp-grid">
                            {WEEKDAY_SHORT.map((w) => <div key={w} className="cf-dp-weekday">{w}</div>)}
                          </div>
                          <div className="cf-dp-grid">
                            {dpCells.map((dd, i) => {
                              if (!dd) return <button key={i} type="button" className="cf-dp-day empty" disabled></button>;
                              const dateStr = y + "-" + pad2(mIdx + 1) + "-" + pad2(dd);
                              const selected = cf.date === dateStr;
                              const isToday = dateStr === today();
                              return (
                                <button key={i} type="button" className={"cf-dp-day" + (selected ? " selected" : "") + (isToday ? " today" : "")}
                                  onClick={() => { setCf((prev) => ({ ...prev, date: dateStr })); setDatePickerOpen(false); }}>{dd}</button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Ubicació</label><input className="field-input form-field" type="text" value={cf.venue} onChange={(e) => setCf((prev) => ({ ...prev, venue: e.target.value }))} /></div>
                  <div><label className="form-label">Població</label><input className="field-input form-field" type="text" value={cf.city} onChange={(e) => setCf((prev) => ({ ...prev, city: e.target.value }))} /></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Colla/Festa</label><input className="field-input form-field" type="text" value={cf.festaEntitat} onChange={(e) => setCf((prev) => ({ ...prev, festaEntitat: e.target.value }))} /></div>
                  <div><label className="form-label">Catxet (€)</label><input className="field-input form-field" type="text" inputMode="numeric" value={cf.amount} onChange={(e) => setCf((prev) => ({ ...prev, amount: e.target.value }))} /></div>
                </div>
                <div className="form-row">
                  <div>
                    <label className="form-label">Estat</label>
                    <button type="button" className="status-cycle-btn" style={{ background: statusColors(cf.status).bg, color: statusColors(cf.status).color }}
                      onClick={() => {
                        const order = ["confirmat", "pendent", "cancel·lat"];
                        setCf((prev) => ({ ...prev, status: order[(order.indexOf(prev.status) + 1) % order.length] }));
                      }}>{cf.status}</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="cf-view-grid">
                <div className="cf-view-item"><span className="form-label">Grup</span><div className="cf-view-value">{cf.bandName || "—"}</div></div>
                <div className="cf-view-item"><span className="form-label">Data</span><div className="cf-view-value">{cf.date ? capitalize(formatDateLong(cf.date)) : "—"}</div></div>
                <div className="cf-view-item"><span className="form-label">Hora</span><div className="cf-view-value">{cf.time}h</div></div>
                <div className="cf-view-item"><span className="form-label">Ubicació</span><div className="cf-view-value">{cf.venue || "—"}</div></div>
                <div className="cf-view-item"><span className="form-label">Població</span><div className="cf-view-value">{cf.city || "—"}</div></div>
                <div className="cf-view-item"><span className="form-label">Colla/Festa</span><div className="cf-view-value">{cf.festaEntitat || "—"}</div></div>
              </div>
            )
          )}

          {activeTab === "routesheet" && mode === "edit" && concert && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span className="badge sm" style={{ background: rsBadgeColors.bg, color: rsBadgeColors.color }}>{routeSheetComplete ? "Acabat" : "Inacabat"}</span>
                <button type="button" className={"row-rs-btn" + (routeSheetComplete ? " rs-complete" : "")} title="Previsualitza el PDF" aria-label="Previsualitza el PDF" onClick={onOpenRouteSheetPreview}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              </div>
              <RouteSheetEditor concert={concert} onCompleteChange={setRouteSheetComplete} />
            </div>
          )}

          {activeTab === "attendance" && (
            (hasMusics || hasCrew) ? (
              <div>
                {hasMusics && (
                  <>
                    <label className="form-label">Músics</label>
                    <div className="cf-convocatoria-list">{renderAttendanceRows(currentBand!.members)}</div>
                  </>
                )}
                {hasCrew && (
                  <>
                    <label className="form-label" style={{ display: "block", marginTop: hasMusics ? 12 : 0 }}>Crew</label>
                    <div className="cf-convocatoria-list">{renderAttendanceRows(currentBand!.crew)}</div>
                  </>
                )}
              </div>
            ) : (
              <div className="empty-state">Aquest grup no té músics ni crew registrats.</div>
            )
          )}

          {mode === "new" && (
            <div style={{ marginTop: 4 }}>
              {(hasMusics || hasCrew) && (
                <>
                  <div className="modal-title" style={{ margin: "4px 0 12px" }}>Assistència</div>
                  {hasMusics && (
                    <>
                      <label className="form-label">Músics</label>
                      <div className="cf-convocatoria-list">{renderAttendanceRows(currentBand!.members)}</div>
                    </>
                  )}
                  {hasCrew && (
                    <>
                      <label className="form-label" style={{ display: "block", marginTop: hasMusics ? 12 : 0 }}>Crew</label>
                      <div className="cf-convocatoria-list">{renderAttendanceRows(currentBand!.crew)}</div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {mode === "edit" && (
            <button type="button" className="cf-delete-btn" disabled={saving} onClick={handleDelete}>
              <span>Eliminar concert</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          )}
        </div>
      </div>
      {onNavigate && (
        <button type="button" className="cf-nav-edge-btn" title="Concert següent" aria-label="Concert següent" disabled={!hasNext} onClick={(e) => { e.stopPropagation(); onNavigate("next"); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      )}
      {shareOpen && concert && <ShareStoryModal concert={concert} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
