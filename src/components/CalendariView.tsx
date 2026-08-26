"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Concert } from "@/lib/types";
import { MONTH_ABBR, MONTH_FULL, WEEKDAY_FULL, WEEKDAY_SHORT, pad2, capitalize, formatDateFull, monthWithPrep } from "@/lib/format";
import { rsIsComplete } from "@/lib/route-sheet";
import RouteSheetModal from "@/components/RouteSheetModal";
import RouteSheetPreview from "@/components/RouteSheetPreview";
import NewEventButton from "@/components/NewEventButton";

// Tipus d'esdeveniment amb el seu color (la "Legend" del calendari).
export const KIND_META: Record<string, { label: string; color: string; bg: string }> = {
  bolo: { label: "Bolo", color: "oklch(0.72 0.16 290)", bg: "oklch(0.72 0.16 290 / 0.18)" },
  assaig: { label: "Assaig", color: "oklch(0.72 0.15 155)", bg: "oklch(0.72 0.15 155 / 0.16)" },
  reunio: { label: "Reunió", color: "oklch(0.78 0.14 70)", bg: "oklch(0.78 0.14 70 / 0.16)" },
  altre: { label: "Altre", color: "oklch(0.72 0.12 230)", bg: "oklch(0.72 0.12 230 / 0.16)" },
};
const KIND_ORDER = ["bolo", "assaig", "reunio", "altre"];

function kindOf(c: Concert): string {
  return c.kind && KIND_META[c.kind] ? c.kind : "bolo";
}

function groupByDate(list: Concert[]) {
  const byDate: Record<string, Concert[]> = {};
  const dates: string[] = [];
  list.forEach((c) => {
    if (!byDate[c.date]) { byDate[c.date] = []; dates.push(c.date); }
    byDate[c.date].push(c);
  });
  return { byDate, dates };
}

export default function CalendariView({ bands, concerts, selectedBandId = "", today }: { bands: Band[]; concerts: Concert[]; selectedBandId?: string; today: string }) {
  const router = useRouter();
  const [calMonthIndex, setCalMonthIndex] = useState(() => parseInt(today.slice(5, 7), 10) - 1);
  const [calViewMode, setCalViewMode] = useState<"month" | "week" | "year">("month");
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);
  const [calBandFilter, setCalBandFilter] = useState<string[]>([]);
  const [calBandFilterOpen, setCalBandFilterOpen] = useState(false);
  const [kindsOn, setKindsOn] = useState<Record<string, boolean>>({ bolo: true, assaig: true, reunio: true, altre: true });
  const [rsModalConcertId, setRsModalConcertId] = useState<string | null>(null);
  const [rsPreviewConcertId, setRsPreviewConcertId] = useState<string | null>(null);
  const dayCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (calSelectedDate) {
      const card = dayCardRefs.current[calSelectedDate];
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [calSelectedDate]);

  const base = new Date(parseInt(today.slice(0, 4), 10), calMonthIndex, 1);
  const y = base.getFullYear(), mIdx = base.getMonth();
  const monthLabel = MONTH_FULL[mIdx] + " de " + y;
  const startOffset = (base.getDay() + 6) % 7;
  const daysInMonth = new Date(y, mIdx + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let wStart = 0; wStart < cells.length; wStart += 7) weeks.push(cells.slice(wStart, wStart + 7));

  const calBandSet: Record<string, boolean> = {};
  calBandFilter.forEach((id) => { calBandSet[id] = true; });
  const calConcerts = concerts.filter((c) =>
    (!calBandFilter.length || calBandSet[c.bandId]) && kindsOn[kindOf(c)]
  );

  const eventsByDate: Record<string, Concert[]> = {};
  calConcerts.slice().sort((a, b) => a.time.localeCompare(b.time)).forEach((c) => {
    (eventsByDate[c.date] = eventsByDate[c.date] || []).push(c);
  });

  // Setmana
  const todayYear = parseInt(today.slice(0, 4), 10), todayMonth = parseInt(today.slice(5, 7), 10) - 1, todayDay = parseInt(today.slice(8, 10), 10);
  const todayObj = new Date(todayYear, todayMonth, todayDay);
  const todayDow = (todayObj.getDay() + 6) % 7;
  const weekStart = new Date(todayObj);
  weekStart.setDate(todayObj.getDate() - todayDow + calWeekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekDatesArr: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDatesArr.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
  }
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.getDate()} - ${weekEnd.getDate()} ${monthWithPrep(MONTH_FULL[weekStart.getMonth()])} de ${weekEnd.getFullYear()}`
    : `${weekStart.getDate()} ${monthWithPrep(MONTH_FULL[weekStart.getMonth()])} - ${weekEnd.getDate()} ${monthWithPrep(MONTH_FULL[weekEnd.getMonth()])} de ${weekEnd.getFullYear()}`;

  const goPrev = () => { if (calViewMode === "week") setCalWeekOffset((v) => v - 1); else if (calViewMode === "year") setCalMonthIndex((v) => v - 12); else setCalMonthIndex((v) => v - 1); };
  const goNext = () => { if (calViewMode === "week") setCalWeekOffset((v) => v + 1); else if (calViewMode === "year") setCalMonthIndex((v) => v + 12); else setCalMonthIndex((v) => v + 1); };

  const selDate = calSelectedDate;
  const shownDates = (selDate
    ? calConcerts.filter((c) => c.date >= selDate)
    : calConcerts.filter((c) => c.date >= today && c.status !== "cancel·lat"))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .reduce<string[]>((acc, c) => { if (acc.indexOf(c.date) === -1) acc.push(c.date); return acc; }, [])
    .slice(0, 3);

  // Cel·la de dia: entrades "còmodes" fins a 3, compactes amb recompte a partir de 4.
  function renderDayCell(dateStr: string, dayNum: number, extraClass = "") {
    const evs = eventsByDate[dateStr] || [];
    const isSelected = calSelectedDate === dateStr;
    const isToday = dateStr === today;
    const compact = evs.length > 3;

    let body: React.ReactNode;
    if (compact) {
      const counts: Record<string, number> = {};
      evs.forEach((c) => { counts[kindOf(c)] = (counts[kindOf(c)] || 0) + 1; });
      body = (
        <div className="calx-compact">
          {KIND_ORDER.filter((k) => counts[k]).map((k) => (
            <span key={k} className="calx-compact-chip" style={{ background: KIND_META[k].bg, color: KIND_META[k].color }}>
              <i style={{ background: KIND_META[k].color }}></i>{counts[k]}
            </span>
          ))}
        </div>
      );
    } else {
      body = (
        <div className="calx-evs">
          {evs.map((c) => {
            const k = kindOf(c);
            return (
              <button
                key={c.id}
                type="button"
                className="calx-ev"
                style={{ background: KIND_META[k].bg, color: KIND_META[k].color, ["--calx-bar" as string]: KIND_META[k].color }}
                title={`${c.bandName} · ${c.city || c.venue || "—"}${c.time ? ` · ${c.time}h` : ""}`}
                onClick={(e) => { e.stopPropagation(); router.push(`/concerts/${c.id}`); }}
              >
                <span className="calx-ev-text">{(c.city || c.venue || c.bandName).split(",")[0]}</span>
                {c.time && <span className="calx-ev-time">{c.time}</span>}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div
        key={dateStr}
        role="button"
        tabIndex={0}
        className={"calx-day" + (extraClass ? " " + extraClass : "") + (isSelected ? " selected" : "") + (isToday ? " today" : "")}
        onClick={() => setCalSelectedDate(dateStr)}
      >
        <span className={"calx-num" + (isToday ? " today" : "")}>{dayNum}</span>
        {body}
      </div>
    );
  }

  function dayCards(dates: string[], byDate: Record<string, Concert[]>) {
    return dates.map((date) => {
      const dayNum = parseInt(date.slice(8, 10), 10);
      const mi = parseInt(date.slice(5, 7), 10) - 1;
      const weekday = WEEKDAY_FULL[new Date(parseInt(date.slice(0, 4), 10), mi, dayNum).getDay()];
      return (
        <div key={date} ref={(el) => { dayCardRefs.current[date] = el; }} className={"upcoming-day-card" + (date === calSelectedDate ? " cal-hover-highlight" : "")} data-date={date}>
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
            {(byDate[date] || []).map((c) => {
              const k = kindOf(c);
              return (
                <div key={c.id} className="upcoming-concert-row clickable" onClick={() => router.push(`/concerts/${c.id}`)}>
                  <div className="upcoming-concert-text">
                    <span className="upcoming-concert-band">
                      <span className="cal-day-dot" style={{ background: KIND_META[k].color, marginRight: 6, display: "inline-block" }}></span>
                      {c.bandName}
                    </span>
                    <div className="upcoming-concert-place">{c.time}h · {c.venue}{c.city ? `, ${c.city}` : ""}</div>
                  </div>
                  <div className="upcoming-concert-actions">
                    <button className={"row-rs-btn" + (rsIsComplete(c) ? " rs-complete" : "")} title="Previsualitza el full de ruta" aria-label="Previsualitza el full de ruta" onClick={(ev) => { ev.stopPropagation(); setRsPreviewConcertId(c.id); }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  }

  const forward = groupByDate(
    calConcerts
      .filter((c) => (selDate ? c.date >= selDate : c.date >= today && c.status !== "cancel·lat"))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  );
  const sideTitle = selDate ? capitalize(formatDateFull(selDate)) : "Propers bolos";

  const calBandLabel = calBandFilter.length === 0
    ? "Tots els grups"
    : calBandFilter.length === 1
      ? (bands.find((b) => b.id === calBandFilter[0])?.name || "1 grup")
      : calBandFilter.length + " grups";

  // Mini calendari del mes (a la barra de la llegenda).
  const miniCells = cells;

  const rsModalConcert = rsModalConcertId ? concerts.find((c) => c.id === rsModalConcertId) || null : null;
  const rsPreviewConcert = rsPreviewConcertId ? concerts.find((c) => c.id === rsPreviewConcertId) || null : null;

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glow-blooms" aria-hidden="true"></div>

      {/* Barra superior */}
      <div className="range-pills cal-view-pills">
        <div className="cal-view-pills-left">
          {selectedBandId ? null : (
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
          )}
        </div>
        <div className="stats-tabs">
          <button className={"stats-tab" + (calViewMode === "month" ? " active" : "")} onClick={() => setCalViewMode("month")}>Mes</button>
          <button className={"stats-tab" + (calViewMode === "week" ? " active" : "")} onClick={() => setCalViewMode("week")}>Setmana</button>
          <button className={"stats-tab" + (calViewMode === "year" ? " active" : "")} onClick={() => setCalViewMode("year")}>Any</button>
        </div>
        <div className="cal-view-pills-right">
          <NewEventButton bands={bands} selectedBandId={selectedBandId} defaultDate={calSelectedDate || today} />
        </div>
      </div>

      <div className="calx-layout">
        {/* Llegenda + mini mes */}
        <aside className="calx-sidebar">
          <div className="calx-side-title">Legend</div>
          <div className="calx-legend">
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                className={"calx-legend-item" + (kindsOn[k] ? " on" : "")}
                onClick={() => setKindsOn((p) => ({ ...p, [k]: !p[k] }))}
              >
                <span className="calx-legend-check" style={kindsOn[k] ? { background: KIND_META[k].color, borderColor: KIND_META[k].color } : {}}>
                  {kindsOn[k] ? "✓" : ""}
                </span>
                <span className="calx-legend-swatch" style={{ background: KIND_META[k].bg, color: KIND_META[k].color }}>{KIND_META[k].label}</span>
              </button>
            ))}
          </div>

          <div className="calx-mini">
            <div className="calx-mini-title">{capitalize(MONTH_FULL[mIdx])} {y}</div>
            <div className="calx-mini-grid">
              {WEEKDAY_SHORT.map((w) => <span key={w} className="calx-mini-wd">{w[0]}</span>)}
              {miniCells.map((d, i) => {
                if (!d) return <span key={"e" + i}></span>;
                const dateStr = y + "-" + pad2(mIdx + 1) + "-" + pad2(d);
                const has = (eventsByDate[dateStr] || []).length > 0;
                return (
                  <button
                    key={dateStr}
                    type="button"
                    className={"calx-mini-day" + (dateStr === today ? " today" : "") + (dateStr === calSelectedDate ? " selected" : "") + (has ? " has" : "")}
                    onClick={() => setCalSelectedDate(dateStr)}
                  >{d}</button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Graella principal */}
        <div className="calx-main">
          <div className="calx-toolbar">
            <div className="calx-month-label">{calViewMode === "year" ? String(y) : capitalize(calViewMode === "week" ? weekLabel : monthLabel)}</div>
            <div className="calx-nav">
              <button className="cal-nav-btn" onClick={goPrev}>‹</button>
              <button className="cal-nav-btn" onClick={goNext}>›</button>
            </div>
          </div>
          <div className="calx-grid-panel">
            {calViewMode !== "year" && (<div className="calx-weekdays">
              {WEEKDAY_SHORT.map((w) => <div key={w} className="calx-weekday">{w}</div>)}
            </div>)}
            {calViewMode === "year" ? (
              <div className="calx-year">
                {Array.from({ length: 12 }, (_, mi) => {
                  const first = new Date(y, mi, 1);
                  const off = (first.getDay() + 6) % 7;
                  const dim = new Date(y, mi + 1, 0).getDate();
                  const mCells: (number | null)[] = [];
                  for (let i = 0; i < off; i++) mCells.push(null);
                  for (let d = 1; d <= dim; d++) mCells.push(d);
                  const monthCount = calConcerts.filter((c) => c.date.slice(0, 7) === `${y}-${pad2(mi + 1)}`).length;
                  return (
                    <button
                      key={mi} type="button" className="calx-year-month"
                      onClick={() => { setCalMonthIndex(mi + (y - parseInt(today.slice(0, 4), 10)) * 12); setCalViewMode("month"); }}
                    >
                      <div className="calx-year-month-head">
                        <span>{capitalize(MONTH_FULL[mi])}</span>
                        {monthCount > 0 && <span className="calx-year-count">{monthCount}</span>}
                      </div>
                      <div className="calx-mini-grid">
                        {mCells.map((d, i) => {
                          if (!d) return <span key={"e" + i}></span>;
                          const ds = `${y}-${pad2(mi + 1)}-${pad2(d)}`;
                          const evs = eventsByDate[ds] || [];
                          const k = evs.length ? (evs[0].kind && KIND_META[evs[0].kind] ? evs[0].kind : "bolo") : null;
                          return (
                            <span key={ds} className={"calx-year-day" + (ds === today ? " today" : "")}
                              style={k ? { background: KIND_META[k].bg, color: KIND_META[k].color, fontWeight: 700 } : {}}>
                              {d}
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : calViewMode === "week" ? (
              <div className="calx-week calx-week-solo">
                {weekDatesArr.map((dateStr) => renderDayCell(dateStr, parseInt(dateStr.slice(8, 10), 10), "week-cell"))}
              </div>
            ) : (
              weeks.map((week, wi) => (
                <div key={wi} className="calx-week">
                  {week.map((dd, di) => {
                    if (!dd) return <div key={di} className="calx-day empty"></div>;
                    const dateStr = y + "-" + pad2(mIdx + 1) + "-" + pad2(dd);
                    return renderDayCell(dateStr, dd);
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Propers bolos */}
        {calViewMode === "month" && (
          <div className="cal-right-col">
            <div className="cal-side-title">{sideTitle}</div>
            <div className="cal-side-panel">
              <div className="upcoming-days">
                {shownDates.length ? dayCards(shownDates, forward.byDate) : <div className="empty-state">Cap actuació propera.</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {rsModalConcert && (
        <RouteSheetModal
          key={rsModalConcert.id}
          concert={rsModalConcert}
          onClose={() => setRsModalConcertId(null)}
          onOpenPreview={() => { setRsModalConcertId(null); setRsPreviewConcertId(rsModalConcert.id); }}
        />
      )}
      {rsPreviewConcert && (
        <RouteSheetPreview
          concert={rsPreviewConcert}
          onClose={() => setRsPreviewConcertId(null)}
          onEdit={() => { setRsPreviewConcertId(null); setRsModalConcertId(rsPreviewConcert.id); }}
        />
      )}
    </div>
  );
}
