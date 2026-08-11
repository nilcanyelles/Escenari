"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Band, Concert, Person } from "@/lib/types";
import { MONTH_FULL, WEEKDAY_SHORT, pad2, capitalize, formatDateLong, statusColors, today } from "@/lib/format";
import { saveConcertAction, deleteConcertAction } from "@/app/(app)/concerts/actions";

type Cf = {
  bandId: string;
  bandName: string;
  date: string;
  time: string;
  venue: string;
  city: string;
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
  mode, concert, bands, onClose,
}: {
  mode: "new" | "edit";
  concert: Concert | null;
  bands: Band[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [cf, setCf] = useState<Cf>(() => {
    if (mode === "edit" && concert) {
      return {
        bandId: concert.bandId, bandName: concert.bandName, date: concert.date, time: concert.time,
        venue: concert.venue, city: concert.city, amount: String(concert.amount), status: concert.status,
        attendance: { ...(concert.attendance || {}) }, substitutes: { ...(concert.substitutes || {}) }, noSubstitute: { ...(concert.noSubstitute || {}) },
      };
    }
    return {
      bandId: bands[0]?.id || "", bandName: bands[0]?.name || "", date: today(), time: "21:00",
      venue: "", city: "", amount: "1500", status: "confirmat", attendance: {}, substitutes: {}, noSubstitute: {},
    };
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerYM, setPickerYM] = useState((cf.date || today()).slice(0, 7));
  const [bandDropdownOpen, setBandDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const bandTyped = (cf.bandName || "").trim().toLowerCase();
  const bandMatches = bands.filter((b) => !bandTyped || b.name.toLowerCase().indexOf(bandTyped) !== -1).slice(0, 8);
  const currentBand = bands.find((b) => b.name.toLowerCase() === bandTyped) || bands.find((b) => b.id === cf.bandId);

  async function handleSave() {
    setSaving(true);
    await saveConcertAction({
      id: mode === "edit" ? concert!.id : null,
      bandName: cf.bandName, date: cf.date, time: cf.time, venue: cf.venue, city: cf.city,
      amount: parseInt(cf.amount, 10) || 0, status: cf.status,
      attendance: cf.attendance, substitutes: cf.substitutes, noSubstitute: cf.noSubstitute,
    });
    router.refresh();
    setSaving(false);
    onClose();
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
      return { ...prev, attendance, substitutes };
    });
  }
  function resetAttendance(name: string) {
    setCf((prev) => {
      const attendance = { ...prev.attendance }; delete attendance[name];
      const substitutes = { ...prev.substitutes }; delete substitutes[name];
      const noSubstitute = { ...prev.noSubstitute }; delete noSubstitute[name];
      return { ...prev, attendance, substitutes, noSubstitute };
    });
  }
  function markNoSubstitute(name: string) {
    setCf((prev) => ({ ...prev, noSubstitute: { ...prev.noSubstitute, [name]: true }, substitutes: { ...prev.substitutes, [name]: "" } }));
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
                  onChange={(e) => setCf((prev) => ({ ...prev, substitutes: { ...prev.substitutes, [m.name]: e.target.value } }))} />
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{mode === "new" ? "Nou concert" : "Detall del concert"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {mode === "edit" && (
              <button type="button" className="row-rs-btn" title="Eliminar" aria-label="Eliminar" disabled={saving} onClick={handleDelete}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            )}
            <button type="button" className="row-rs-btn" title="Desar" aria-label="Desar" disabled={saving} onClick={handleSave}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            </button>
            <button className="modal-close" title="Cancel·lar" aria-label="Cancel·lar" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-form">
          <div className="form-row">
            <div style={{ position: "relative" }}>
              <label className="form-label">Grup</label>
              <input className="field-input form-field" type="text" autoComplete="off" placeholder="Escriu el nom del grup…"
                value={cf.bandName}
                onFocus={() => setBandDropdownOpen(true)}
                onChange={(e) => { setCf((prev) => ({ ...prev, bandName: e.target.value })); setBandDropdownOpen(true); }} />
              {bandDropdownOpen && (
                <>
                  <div className="year-picker-overlay" onClick={() => setBandDropdownOpen(false)}></div>
                  <div className="year-dropdown cf-band-dropdown" onClick={(e) => e.stopPropagation()}>
                    {bandMatches.length ? bandMatches.map((b) => (
                      <button key={b.id} type="button" className="year-option" onClick={() => {
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
            <div><label className="form-label">Catxet (€)</label><input className="field-input form-field" type="text" inputMode="numeric" value={cf.amount} onChange={(e) => setCf((prev) => ({ ...prev, amount: e.target.value }))} /></div>
            <div>
              <label className="form-label">Estat</label>
              <button type="button" className="status-cycle-btn" style={{ background: statusColors(cf.status).bg, color: statusColors(cf.status).color }}
                onClick={() => {
                  const order = ["confirmat", "pendent", "cancel·lat"];
                  setCf((prev) => ({ ...prev, status: order[(order.indexOf(prev.status) + 1) % order.length] }));
                }}>{cf.status}</button>
            </div>
          </div>
          {(hasMusics || hasCrew) && (
            <div>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
