"use client";

import { useState } from "react";
import { capitalize, MONTH_FULL, WEEKDAY_SHORT, pad2 } from "@/lib/format";

// Calendari propi (mateixa icona/popover arreu de l'app) per triar una data —
// cada instància porta el seu propi mes/estat obert, així que se'n poden fer
// servir tantes com calgui a la mateixa pàgina (fitxa del concert, nou
// esdeveniment...).
export default function InlineDatePicker({ value, onChange, today, highlightDates, initialMonth, minDate }: {
  value: string; onChange: (v: string) => void; today: string;
  // Dies a ressaltar al calendari a banda del sel·leccionat (per exemple,
  // les properes ocurrències d'una repetició) i mes amb què s'obre la
  // primera vegada si encara no hi ha cap data triada.
  highlightDates?: Set<string>;
  initialMonth?: string;
  minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickerYM, setPickerYM] = useState((value || initialMonth || today).slice(0, 7));

  const dpY = parseInt(pickerYM.slice(0, 4), 10), dpMIdx = parseInt(pickerYM.slice(5, 7), 10) - 1;
  const dpMonthLabel = capitalize(MONTH_FULL[dpMIdx]) + " " + dpY;
  const dpBase = new Date(dpY, dpMIdx, 1);
  const dpStartOffset = (dpBase.getDay() + 6) % 7;
  const dpDaysInMonth = new Date(dpY, dpMIdx + 1, 0).getDate();
  const dpCells: (number | null)[] = [];
  for (let i = 0; i < dpStartOffset; i++) dpCells.push(null);
  for (let d = 1; d <= dpDaysInMonth; d++) dpCells.push(d);
  while (dpCells.length % 7 !== 0) dpCells.push(null);
  function shiftPickerMonth(delta: number) {
    const d = new Date(dpY, dpMIdx + delta, 1);
    setPickerYM(d.getFullYear() + "-" + pad2(d.getMonth() + 1));
  }

  return (
    <div className="cd-inline-datepicker" style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input type="date" className="field-input form-field cd-date-input" min={minDate} value={value} onChange={(e) => onChange(e.target.value)} />
        <button
          type="button" className="cd-date-icon-btn" title="Tria del calendari" aria-label="Tria del calendari"
          onClick={() => { setPickerYM((value || initialMonth || today).slice(0, 7)); setOpen((v) => !v); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2"></rect>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <line x1="8" y1="3" x2="8" y2="7"></line>
            <line x1="16" y1="3" x2="16" y2="7"></line>
          </svg>
        </button>
      </div>
      {open && (
        <>
          <div className="year-picker-overlay" onClick={() => setOpen(false)}></div>
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
                const dateStr = dpY + "-" + pad2(dpMIdx + 1) + "-" + pad2(dd);
                const selected = value === dateStr;
                const isToday = dateStr === today;
                const isOccurrence = highlightDates?.has(dateStr);
                const isPast = !!minDate && dateStr < minDate;
                return (
                  <button key={i} type="button" disabled={isPast}
                    className={"cf-dp-day" + (selected ? " selected" : "") + (isToday ? " today" : "") + (isOccurrence ? " repeat-day" : "")}
                    title={isOccurrence && !selected ? "Es repetirà aquest dia" : undefined}
                    onClick={() => { onChange(dateStr); setOpen(false); }}>{dd}</button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
