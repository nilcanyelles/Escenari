"use client";

import { useState } from "react";
import type { Band, Concert } from "@/lib/types";
import { MONTH_ABBR, MONTH_FULL, WEEKDAY_FULL, WEEKDAY_SHORT, pad2, capitalize, formatDateFull, statusColors } from "@/lib/format";
import { rsIsComplete } from "@/lib/route-sheet";

function groupByDate(list: Concert[]) {
  const byDate: Record<string, Concert[]> = {};
  const dates: string[] = [];
  list.forEach((c) => {
    if (!byDate[c.date]) { byDate[c.date] = []; dates.push(c.date); }
    byDate[c.date].push(c);
  });
  return { byDate, dates };
}

export default function CalendariView({ bands, concerts, today }: { bands: Band[]; concerts: Concert[]; today: string }) {
  const [calMonthIndex, setCalMonthIndex] = useState(7);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);
  const [calBandFilter, setCalBandFilter] = useState<string[]>([]);
  const [calBandFilterOpen, setCalBandFilterOpen] = useState(false);

  const base = new Date(2026, calMonthIndex, 1);
  const y = base.getFullYear(), mIdx = base.getMonth();
  const monthLabel = MONTH_FULL[mIdx] + " de " + y;
  const startOffset = (base.getDay() + 6) % 7;
  const daysInMonth = new Date(y, mIdx + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const calBandSet: Record<string, boolean> = {};
  calBandFilter.forEach((id) => { calBandSet[id] = true; });
  const calConcerts = calBandFilter.length ? concerts.filter((c) => calBandSet[c.bandId]) : concerts;

  const eventsByDate: Record<string, Concert[]> = {};
  calConcerts.forEach((c) => { (eventsByDate[c.date] = eventsByDate[c.date] || []).push(c); });

  const selDate = calSelectedDate;
  let shownDates: string[];
  if (selDate) {
    shownDates = calConcerts.filter((c) => c.date >= selDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .reduce<string[]>((acc, c) => { if (acc.indexOf(c.date) === -1) acc.push(c.date); return acc; }, [])
      .slice(0, 3);
  } else {
    shownDates = calConcerts.filter((c) => c.date >= today && c.status !== "cancel·lat")
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .reduce<string[]>((acc, c) => { if (acc.indexOf(c.date) === -1) acc.push(c.date); return acc; }, [])
      .slice(0, 3);
  }

  const weeks: (number | null)[][] = [];
  for (let wStart = 0; wStart < cells.length; wStart += 7) weeks.push(cells.slice(wStart, wStart + 7));

  function dayCards(dates: string[], byDate: Record<string, Concert[]>) {
    return dates.map((date) => {
      const dayNum = parseInt(date.slice(8, 10), 10);
      const mi = parseInt(date.slice(5, 7), 10) - 1;
      const weekday = WEEKDAY_FULL[new Date(parseInt(date.slice(0, 4), 10), mi, dayNum).getDay()];
      return (
        <div key={date} className={"upcoming-day-card" + (date === calSelectedDate ? " cal-hover-highlight" : "")} data-date={date}>
          <div className="upcoming-day-card-header">
            <div className="upcoming-day-card-num">{dayNum}</div>
            <div className="upcoming-day-card-meta">
              <div className="upcoming-day-card-weekday">{weekday}</div>
              <div className="upcoming-day-card-month">{MONTH_ABBR[mi]}</div>
            </div>
            <div className="spacer"></div>
            <div className="upcoming-day-card-fdr-label">FDR</div>
          </div>
          <div className="upcoming-day-card-concerts">
            {byDate[date].map((c) => (
              <div key={c.id} className="upcoming-concert-row clickable">
                <div className="upcoming-concert-top">
                  <span className="upcoming-concert-band">{c.bandName}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <button className="row-rs-btn" title="Edita el full de ruta" aria-label="Edita el full de ruta">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                      </svg>
                    </button>
                    <button className={"row-rs-btn" + (rsIsComplete(c) ? " rs-complete" : "")} title="Previsualitza el full de ruta" aria-label="Previsualitza el full de ruta">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="upcoming-concert-place">{c.venue}, {c.city}</div>
              </div>
            ))}
          </div>
        </div>
      );
    });
  }

  let sideTitle: string, sideContent: React.ReactNode;
  if (selDate) {
    const forward = groupByDate(
      calConcerts.filter((c) => c.date >= selDate).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    );
    sideTitle = capitalize(formatDateFull(selDate));
    sideContent = (
      <div className="cal-side-panel">
        <div className="upcoming-days">
          {shownDates.length ? dayCards(shownDates, forward.byDate) : <div className="empty-state">Cap actuació propera.</div>}
        </div>
      </div>
    );
  } else {
    const upcoming = groupByDate(
      calConcerts.filter((c) => c.date >= today && c.status !== "cancel·lat").sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    );
    sideTitle = "Propers bolos";
    sideContent = (
      <div className="cal-side-panel">
        <div className="upcoming-days">
          {shownDates.length ? dayCards(shownDates, upcoming.byDate) : <div className="empty-state">Cap actuació propera.</div>}
        </div>
      </div>
    );
  }

  const calBandLabel = calBandFilter.length === 0
    ? "Tots els grups"
    : calBandFilter.length === 1
      ? (bands.find((b) => b.id === calBandFilter[0])?.name || "1 grup")
      : calBandFilter.length + " grups";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="range-pills">
        <div className="year-select-wrap">
          <button className="pill active" onClick={() => setCalBandFilterOpen((v) => !v)}>{calBandLabel} ▾</button>
          {calBandFilterOpen && (
            <>
              <div className="year-picker-overlay" onClick={() => setCalBandFilterOpen(false)}></div>
              <div className="year-dropdown band-dropdown" onClick={(e) => e.stopPropagation()}>
                <button className={"year-option" + (calBandFilter.length === 0 ? " active" : "")} onClick={() => setCalBandFilter([])}>
                  <span className="band-check">{calBandFilter.length === 0 ? "✓" : ""}</span>Tots els grups
                </button>
                <div className="year-option-divider"></div>
                {bands.map((b) => {
                  const checked = !!calBandSet[b.id];
                  return (
                    <button key={b.id} className={"year-option" + (checked ? " active" : "")}
                      onClick={() => setCalBandFilter((prev) => checked ? prev.filter((id) => id !== b.id) : prev.concat([b.id]))}>
                      <span className="band-check">{checked ? "✓" : ""}</span>{b.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="cal-cols">
        <div className="cal-left-col">
          <div className="cal-toolbar">
            <button className="cal-nav-btn" onClick={() => setCalMonthIndex((v) => v - 1)}>‹</button>
            <div className="cal-month-label">{capitalize(monthLabel)}</div>
            <button className="cal-nav-btn" onClick={() => setCalMonthIndex((v) => v + 1)}>›</button>
          </div>
          <div className="cal-grid-panel">
            <div className="cal-weekdays">
              {WEEKDAY_SHORT.map((w) => <div key={w} className="cal-weekday">{w}</div>)}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="cal-week">
                {week.map((dd, di) => {
                  if (!dd) return <button key={di} className="cal-day empty" disabled></button>;
                  const dateStr = y + "-" + pad2(mIdx + 1) + "-" + pad2(dd);
                  const evs = eventsByDate[dateStr] || [];
                  const selected = calSelectedDate === dateStr;
                  const isToday = dateStr === today;
                  const showTooltip = evs.length > 0 && shownDates.indexOf(dateStr) === -1;
                  return (
                    <button key={di} className={"cal-day" + (selected ? " selected" : "") + (isToday ? " today" : "")}
                      onClick={() => setCalSelectedDate(dateStr)}>
                      <span className="cal-day-num">{dd}</span>
                      <div className="cal-day-dots">
                        {evs.map((e) => <span key={e.id} className="cal-day-dot" style={{ background: statusColors(e.status).color }}></span>)}
                      </div>
                      {showTooltip && (
                        <div className="cal-day-tooltip">
                          {evs.map((e) => (
                            <div key={e.id} className="cal-day-tooltip-row">
                              <span className="cal-day-tooltip-band">{e.bandName}</span>
                              <span className="cal-day-tooltip-city">{e.city}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="cal-right-col">
          <div className="cal-side-title">{sideTitle}</div>
          {sideContent}
        </div>
      </div>
    </div>
  );
}
