"use client";

import { useState } from "react";
import { MONTH_FULL, WEEKDAY_SHORT, pad2, capitalize } from "@/lib/format";

// Calendari de disponibilitat per a suplències: cada dia es marca en verd
// (disponible) o vermell (no disponible) amb un clic; els dies amb bolo
// surten en vermell sols i no es poden tocar (amb el motiu, si es té dret a
// veure'l). El mateix component serveix per editar-lo (el músic) i per
// mirar-lo (el perfil públic).
export default function AvailabilityCalendar({ availability, busy, editable, today, onToggle }: {
  availability: Record<string, boolean>;
  busy: Record<string, string>; // dia -> motiu ("" si no es pot veure)
  editable: boolean;
  today: string;
  onToggle?: (day: string, next: boolean | null) => void;
}) {
  const [ym, setYm] = useState(() => today.slice(0, 7));
  const [y, m] = ym.split("-").map(Number);

  function shift(delta: number) {
    const d = new Date(y, m - 1 + delta, 1);
    setYm(d.getFullYear() + "-" + pad2(d.getMonth() + 1));
  }

  const base = new Date(y, m - 1, 1);
  const startOffset = (base.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="pv-cal av-cal">
      <div className="pv-cal-head">
        <button type="button" className="cal-nav-btn" onClick={() => shift(-1)}>‹</button>
        <span className="pv-cal-title">{capitalize(MONTH_FULL[m - 1])} {y}</span>
        <button type="button" className="cal-nav-btn" onClick={() => shift(1)}>›</button>
        <div className="pv-cal-legend">
          <span><i className="pv-dot yes"></i>Disponible</span>
          <span><i className="pv-dot no"></i>No disponible</span>
          <span><i className="pv-dot busy"></i>Bolo</span>
        </div>
      </div>
      <div className="pv-cal-grid">
        {WEEKDAY_SHORT.map((w) => <div key={w} className="pv-cal-wd">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={"e" + i} className="pv-cal-day av-day empty"></div>;
          const day = `${ym}-${pad2(d)}`;
          const reason = busy[day];
          const isBusy = reason !== undefined;
          const state = isBusy ? "busy" : availability[day] === true ? "yes" : availability[day] === false ? "no" : "";
          const past = day < today;
          const canClick = editable && !isBusy && !past;
          const title = isBusy ? (reason || "No disponible: té bolo") : state === "yes" ? "Disponible" : state === "no" ? "No disponible" : canClick ? "Toca per marcar-te disponible" : "";
          return (
            <button
              key={day} type="button"
              className={"pv-cal-day av-day " + state + (day === today ? " today" : "") + (past ? " past" : "") + (canClick ? " clickable" : "")}
              title={title} disabled={!canClick}
              onClick={() => {
                if (!canClick || !onToggle) return;
                // Cicle: res → disponible → no disponible → res.
                const next = availability[day] === undefined ? true : availability[day] === true ? false : null;
                onToggle(day, next);
              }}
            >
              <span className="pv-cal-num">{d}</span>
              {isBusy && reason && <span className="av-reason">{reason}</span>}
              {isBusy && !reason && <span className="av-reason">Bolo</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
