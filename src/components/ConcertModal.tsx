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
import WhatsappShareModal from "@/components/WhatsappShareModal";

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
  isDraft, startInEditMode, onDiscardDraft,
}: {
  mode: "new" | "edit";
  concert: Concert | null;
  bands: Band[];
  onClose: () => void;
  onOpenRouteSheetPreview?: () => void;
  onNavigate?: (dir: "prev" | "next") => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  isDraft?: boolean;
  startInEditMode?: boolean;
  onDiscardDraft?: () => void;
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
  const [isEditing, setIsEditing] = useState(mode === "new" || !!startInEditMode);
  const [editSnapshot, setEditSnapshot] = useState<Cf | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "routesheet" | "attendance">("info");
  const [shareOpen, setShareOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingNavDir, setPendingNavDir] = useState<"prev" | "next" | null>(null);
  const substituteSaveTimer = useRef<number | null>(null);
  const everSavedRef = useRef(false);

  const bandTyped = (cf.bandName || "").trim().toLowerCase();
  const currentBand = bands.find((b) => b.name.toLowerCase() === bandTyped) || bands.find((b) => b.id === cf.bandId);
  const bandSearchLower = bandSearch.trim().toLowerCase();
  const bandMatches = bands.filter((b) => !bandSearchLower || b.name.toLowerCase().indexOf(bandSearchLower) !== -1);

  async function persist(payload: Cf) {
    everSavedRef.current = true;
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

  function closeModal() {
    if (isDraft && !everSavedRef.current) onDiscardDraft?.();
    else onClose();
  }

  function handleCloseClick() {
    if (isDraft && !everSavedRef.current) { setShowDiscardConfirm(true); return; }
    if (mode === "edit" && isEditing) discardEditAndGoBack();
    else closeModal();
  }

  function requestNavigate(dir: "prev" | "next") {
    if (isEditing) { setPendingNavDir(dir); return; }
    onNavigate?.(dir);
  }

  function handleOverlayClick() {
    if (isDraft && !everSavedRef.current) { setShowDiscardConfirm(true); return; }
    closeModal();
  }

  async function confirmDelete() {
    if (!concert) return;
    setShowDeleteConfirm(false);
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
      if (e.key === "ArrowLeft" && hasPrev) requestNavigate("prev");
      else if (e.key === "ArrowRight" && hasNext) requestNavigate("next");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNavigate, hasPrev, hasNext, shareOpen, isEditing]);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      {onNavigate && (
        <button type="button" className="cf-nav-edge-btn" title="Concert anterior" aria-label="Concert anterior" disabled={!hasPrev} onClick={(e) => { e.stopPropagation(); requestNavigate("prev"); }}>
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
              <div className="cf-share-menu-wrap">
                <button type="button" className="row-rs-btn" title="Comparteix" aria-label="Comparteix">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
                <div className="cf-share-menu">
                  <div className="cf-share-menu-panel">
                    <button type="button" className="cf-share-menu-btn" title="Instagram" aria-label="Instagram" onClick={() => setShareOpen(true)}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                    </button>
                    <button type="button" className="cf-share-menu-btn" title="WhatsApp" aria-label="WhatsApp" onClick={() => setWhatsappOpen(true)}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
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
            {mode === "edit" && activeTab === "routesheet" && concert && (
              <button type="button" className={"row-rs-btn" + (routeSheetComplete ? " rs-complete" : "")} title="Previsualitza el PDF" aria-label="Previsualitza el PDF" onClick={onOpenRouteSheetPreview}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
            )}
            <button className="cf-head-close" title="Cancel·lar" aria-label="Cancel·lar" onClick={handleCloseClick}>✕</button>
          </div>
        </div>

        <div className="modal-tabs">
          <div
            className="modal-tabs-indicator"
            style={{ transform: `translateX(${activeTab === "info" ? 0 : activeTab === "routesheet" ? 100 : 200}%)` }}
            aria-hidden="true"
          ></div>
          <button type="button" className={activeTab === "info" ? "active" : ""} onClick={() => setActiveTab("info")}>Info</button>
          {mode === "edit" && (
            <div className="cf-rs-tab-wrap">
              {!routeSheetComplete && (
                <div className="cf-rs-warning-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  <span>Inacabat</span>
                </div>
              )}
              <button type="button" className={activeTab === "routesheet" ? "active" : ""} onClick={() => setActiveTab("routesheet")}>Full de ruta</button>
            </div>
          )}
          <button type="button" className={activeTab === "attendance" ? "active" : ""} onClick={() => setActiveTab("attendance")}>Assistència</button>
        </div>

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
                              setCf((prev) => ({ ...prev, bandName: b.name, bandId: b.id, attendance: {}, substitutes: {}, noSubstitute: {}, ...(isDraft ? { amount: String(b.rate) } : {}) }));
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
            <RouteSheetEditor concert={concert} onCompleteChange={setRouteSheetComplete} onSaved={() => { everSavedRef.current = true; }} />
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


          {mode === "edit" && (
            <button type="button" className="cf-delete-btn" disabled={saving} onClick={() => setShowDeleteConfirm(true)}>
              <span>Eliminar concert</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          )}
        </div>
      </div>
      {onNavigate && (
        <button type="button" className="cf-nav-edge-btn" title="Concert següent" aria-label="Concert següent" disabled={!hasNext} onClick={(e) => { e.stopPropagation(); requestNavigate("next"); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      )}
      {shareOpen && concert && <ShareStoryModal concert={concert} onClose={() => setShareOpen(false)} />}
      {whatsappOpen && concert && <WhatsappShareModal concert={concert} onClose={() => setWhatsappOpen(false)} />}
      {showDiscardConfirm && (
        <div className="modal-overlay cf-confirm-overlay" onClick={(e) => { e.stopPropagation(); setShowDiscardConfirm(false); }}>
          <div className="modal cf-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cf-confirm-message">Els canvis no es desaran.</div>
            <div className="modal-actions cf-confirm-actions">
              <button type="button" className="btn-outline" onClick={() => setShowDiscardConfirm(false)}>Torna a l&apos;edició</button>
              <button type="button" className="btn-danger-outline" onClick={() => { setShowDiscardConfirm(false); onDiscardDraft?.(); }}>Cancel·lar</button>
            </div>
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="modal-overlay cf-confirm-overlay" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}>
          <div className="modal cf-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cf-confirm-message">Estàs segur que vols eliminar el concert?</div>
            <div className="modal-actions cf-confirm-actions">
              <button type="button" className="btn-danger-outline" disabled={saving} onClick={confirmDelete}>Eliminar</button>
              <button type="button" className="btn-outline" onClick={() => setShowDeleteConfirm(false)}>Torna enrere</button>
            </div>
          </div>
        </div>
      )}
      {pendingNavDir && (
        <div className="modal-overlay cf-confirm-overlay" onClick={(e) => { e.stopPropagation(); setPendingNavDir(null); }}>
          <div className="modal cf-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cf-confirm-message">Els canvis no es desaran.</div>
            <div className="modal-actions cf-confirm-actions">
              <button type="button" className="btn-outline" onClick={() => setPendingNavDir(null)}>Seguir editant</button>
              <button type="button" className="btn-danger-outline" onClick={() => { const dir = pendingNavDir; setPendingNavDir(null); onNavigate?.(dir); }}>Cancel·lar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
