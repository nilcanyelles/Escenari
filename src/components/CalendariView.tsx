"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Concert } from "@/lib/types";
import { MONTH_ABBR, MONTH_FULL, WEEKDAY_FULL, WEEKDAY_SHORT, pad2, capitalize, formatDateFull, monthWithPrep } from "@/lib/format";
import { rsIsComplete } from "@/lib/route-sheet";
import { bandColor } from "@/lib/tags";
import { saveConcertAction, deleteConcertAction } from "@/app/(app)/concerts/actions";
import RouteSheetModal from "@/components/RouteSheetModal";
import RouteSheetPreview from "@/components/RouteSheetPreview";
import ConcertModal from "@/components/ConcertModal";

function splitIntoColumns<T>(items: T[], maxPerColumn = 8): T[][] {
  if (!items.length) return [];
  const numCols = Math.ceil(items.length / maxPerColumn);
  const perCol = Math.ceil(items.length / numCols);
  const cols: T[][] = [];
  for (let i = 0; i < items.length; i += perCol) cols.push(items.slice(i, i + perCol));
  return cols;
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

export default function CalendariView({ bands, concerts, today }: { bands: Band[]; concerts: Concert[]; today: string }) {
  const router = useRouter();
  const [draftConcert, setDraftConcert] = useState<Concert | null>(null);
  const [calMonthIndex, setCalMonthIndex] = useState(() => parseInt(today.slice(5, 7), 10) - 1);
  const [calViewMode, setCalViewMode] = useState<"month" | "week">("month");
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [calBandFilter, setCalBandFilter] = useState<string[]>([]);
  const [calBandFilterOpen, setCalBandFilterOpen] = useState(false);
  const [rsModalConcertId, setRsModalConcertId] = useState<string | null>(null);
  const [rsPreviewConcertId, setRsPreviewConcertId] = useState<string | null>(null);
  const [concertModalId, setConcertModalId] = useState<string | null>(null);
  const dayCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const concertRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hoverScrollTimer = useRef<number | null>(null);
  const [tooltipCaps, setTooltipCaps] = useState<Record<string, number>>({});

  useEffect(() => {
    if (calSelectedDate) {
      const card = dayCardRefs.current[calSelectedDate];
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [calSelectedDate]);

  useEffect(() => {
    if (concertModalId) {
      const row = concertRowRefs.current[concertModalId];
      if (row) row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [concertModalId]);

  const base = new Date(parseInt(today.slice(0, 4), 10), calMonthIndex, 1);
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
  calConcerts.slice().sort((a, b) => a.time.localeCompare(b.time)).forEach((c) => { (eventsByDate[c.date] = eventsByDate[c.date] || []).push(c); });

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
    : weekStart.getFullYear() === weekEnd.getFullYear()
      ? `${weekStart.getDate()} ${monthWithPrep(MONTH_FULL[weekStart.getMonth()])} - ${weekEnd.getDate()} ${monthWithPrep(MONTH_FULL[weekEnd.getMonth()])} de ${weekEnd.getFullYear()}`
      : `${weekStart.getDate()} ${monthWithPrep(MONTH_FULL[weekStart.getMonth()])} de ${weekStart.getFullYear()} - ${weekEnd.getDate()} ${monthWithPrep(MONTH_FULL[weekEnd.getMonth()])} de ${weekEnd.getFullYear()}`;

  const goPrev = () => { if (calViewMode === "week") setCalWeekOffset((v) => v - 1); else setCalMonthIndex((v) => v - 1); };
  const goNext = () => { if (calViewMode === "week") setCalWeekOffset((v) => v + 1); else setCalMonthIndex((v) => v + 1); };

  function renderDayCell(dateStr: string, dayNum: number, extraClass: string) {
    const evs = eventsByDate[dateStr] || [];
    const isSelected = calSelectedDate === dateStr;
    const showSelected = isSelected && (hoveredDate === null || hoveredDate === dateStr);
    const isToday = dateStr === today;
    const isWeekCell = extraClass.indexOf("week-cell") !== -1;
    const showTooltip = !isWeekCell && evs.length > 0 && shownDates.indexOf(dateStr) === -1;
    return (
      <div key={dateStr} role="button" tabIndex={0} className={"cal-day" + (extraClass ? " " + extraClass : "") + (showSelected ? " selected" : "") + (isToday ? " today" : "")}
        onClick={() => setCalSelectedDate(dateStr)}
        onMouseEnter={(e) => {
          setHoveredDate(dateStr);
          if (hoverScrollTimer.current) window.clearTimeout(hoverScrollTimer.current);
          hoverScrollTimer.current = window.setTimeout(() => {
            const card = dayCardRefs.current[dateStr];
            if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 500);
          if (showTooltip && tooltipCaps[dateStr] === undefined) {
            const rect = e.currentTarget.getBoundingClientRect();
            const topMarginPx = 38; // ~1cm de marge amb la part superior de la pantalla
            const availableAbove = rect.top - topMarginPx;
            const sampleRow = document.querySelector(".cal-day-tooltip-row") as HTMLElement | null;
            const rowH = sampleRow ? sampleRow.getBoundingClientRect().height : 28;
            const colGap = 7;
            const containerPadding = 18;
            const bottomOffset = 8;
            const usable = availableAbove - bottomOffset - containerPadding;
            const rows = Math.max(1, Math.floor((usable + colGap) / (rowH + colGap)) - 2);
            setTooltipCaps((prev) => ({ ...prev, [dateStr]: Math.min(rows, 8) }));
          }
        }}
        onMouseLeave={() => {
          setHoveredDate((prev) => prev === dateStr ? null : prev);
          if (hoverScrollTimer.current) { window.clearTimeout(hoverScrollTimer.current); hoverScrollTimer.current = null; }
        }}>
        <span className="cal-day-num">{dayNum}</span>
        {isWeekCell ? (
          <div className="week-day-concerts">
            {evs.map((c) => (
              <div key={c.id} ref={(el) => { concertRowRefs.current[c.id] = el; }} className={"upcoming-concert-row clickable" + (concertModalId === c.id ? " selected" : "")} onClick={() => setConcertModalId(c.id)}>
                <div className="upcoming-concert-text">
                  <span className="upcoming-concert-band">
                    <span className="cal-day-dot" style={{ background: bandColor(c.bandId).color, marginRight: 6, display: "inline-block" }}></span>
                    {c.bandName}
                  </span>
                  <div className="upcoming-concert-place">{c.time}h · {c.venue}, {c.city}</div>
                </div>
                <div className="upcoming-concert-actions">
                  <button className="row-rs-btn" title="Edita el full de ruta" aria-label="Edita el full de ruta" onClick={(ev) => { ev.stopPropagation(); setRsModalConcertId(c.id); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                  </button>
                  <button className={"row-rs-btn" + (rsIsComplete(c) ? " rs-complete" : "")} title="Previsualitza el full de ruta" aria-label="Previsualitza el full de ruta" onClick={(ev) => { ev.stopPropagation(); setRsPreviewConcertId(c.id); }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="cal-day-dots">
            {evs.map((e) => <span key={e.id} className="cal-day-dot" style={{ background: bandColor(e.bandId).color }}></span>)}
          </div>
        )}
        {showTooltip && (
          <div className="cal-day-tooltip">
            {splitIntoColumns(evs, tooltipCaps[dateStr] ?? 8).map((col, ci) => (
              <div key={ci} className="cal-day-tooltip-col">
                {col.map((e) => (
                  <div key={e.id} className="cal-day-tooltip-row">
                    <span className="cal-day-tooltip-dot" style={{ background: bandColor(e.bandId).color }}></span>
                    <span className="cal-day-tooltip-text">
                      <span className="cal-day-tooltip-band">{e.bandName}</span>
                      <span className="cal-day-tooltip-city">{e.city}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function dayCards(dates: string[], byDate: Record<string, Concert[]>) {
    return dates.map((date) => {
      const dayNum = parseInt(date.slice(8, 10), 10);
      const mi = parseInt(date.slice(5, 7), 10) - 1;
      const weekday = WEEKDAY_FULL[new Date(parseInt(date.slice(0, 4), 10), mi, dayNum).getDay()];
      const cardHighlighted = hoveredDate !== null ? date === hoveredDate : date === calSelectedDate;
      return (
        <div key={date} ref={(el) => { dayCardRefs.current[date] = el; }} className={"upcoming-day-card" + (cardHighlighted ? " cal-hover-highlight" : "")} data-date={date}>
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
              <div key={c.id} ref={(el) => { concertRowRefs.current[c.id] = el; }} className={"upcoming-concert-row clickable" + (concertModalId === c.id ? " selected" : "")} onClick={() => setConcertModalId(c.id)}>
                <div className="upcoming-concert-text">
                  <span className="upcoming-concert-band">
                    <span className="cal-day-dot" style={{ background: bandColor(c.bandId).color, marginRight: 6, display: "inline-block" }}></span>
                    {c.bandName}
                  </span>
                  <div className="upcoming-concert-place">{c.time}h · {c.venue}, {c.city}</div>
                </div>
                <div className="upcoming-concert-actions">
                  <button className={"row-rs-btn" + (rsIsComplete(c) ? " rs-complete" : "")} title="Previsualitza el full de ruta" aria-label="Previsualitza el full de ruta" onClick={(ev) => { ev.stopPropagation(); setRsPreviewConcertId(c.id); }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
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

  async function handleNewConcert() {
    const created = await saveConcertAction({
      id: null,
      bandName: "",
      date: calSelectedDate || today,
      time: "",
      venue: "",
      city: "",
      festaEntitat: "",
      amount: 0,
      status: "pendent",
      attendance: {},
      substitutes: {},
      noSubstitute: {},
      skipDefaults: true,
    });
    if (!created) return;
    router.refresh();
    setDraftConcert(created);
    setConcertModalId(created.id);
  }

  async function discardDraftAndClose() {
    if (draftConcert) {
      await deleteConcertAction(draftConcert.id);
      router.refresh();
    }
    setConcertModalId(null);
    setDraftConcert(null);
  }

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glow-blooms" aria-hidden="true"></div>
      <div className="range-pills cal-view-pills">
        <div className="cal-view-pills-left">
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
        <div className="view-mode-switch">
          <div className={"view-mode-switch-thumb" + (calViewMode === "week" ? " week" : "")}></div>
          <button className={calViewMode === "month" ? "active" : ""} onClick={() => setCalViewMode("month")}>Mes</button>
          <button className={calViewMode === "week" ? "active" : ""} onClick={() => setCalViewMode("week")}>Setmana</button>
        </div>
        <div className="cal-view-pills-right">
          <button className="glow-cta" onClick={handleNewConcert}>+ Nou concert</button>
        </div>
      </div>

      <div className={"cal-cols" + (calViewMode === "week" ? " cal-cols-week" : "")}>
        <div className="cal-left-col">
          <div className="cal-toolbar">
            <button className="cal-nav-btn" onClick={goPrev}>‹</button>
            <div className="cal-month-label">{capitalize(calViewMode === "week" ? weekLabel : monthLabel)}</div>
            <button className="cal-nav-btn" onClick={goNext}>›</button>
          </div>
          <div className={"cal-grid-panel" + (calViewMode === "week" ? " cal-grid-panel-week" : "")}>
            <div className="cal-weekdays">
              {WEEKDAY_SHORT.map((w) => <div key={w} className="cal-weekday">{w}</div>)}
            </div>
            {calViewMode === "week" ? (
              <div className="cal-week cal-week-solo">
                {weekDatesArr.map((dateStr) => renderDayCell(dateStr, parseInt(dateStr.slice(8, 10), 10), "week-cell"))}
              </div>
            ) : (
              weeks.map((week, wi) => (
                <div key={wi} className="cal-week">
                  {week.map((dd, di) => {
                    if (!dd) return <div key={di} className="cal-day empty"></div>;
                    const dateStr = y + "-" + pad2(mIdx + 1) + "-" + pad2(dd);
                    return renderDayCell(dateStr, dd, "");
                  })}
                </div>
              ))
            )}
          </div>
        </div>
        {calViewMode !== "week" && (
          <div className="cal-right-col">
            <div className="cal-side-title">{sideTitle}</div>
            {sideContent}
          </div>
        )}
      </div>

      {concertModalId && (() => {
        const c = concerts.find((x) => x.id === concertModalId) || (draftConcert && draftConcert.id === concertModalId ? draftConcert : null);
        if (!c) return null;
        const isNewDraft = !!draftConcert && draftConcert.id === concertModalId;
        const navigableList = calConcerts.slice().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        const navigableIndex = navigableList.findIndex((x) => x.id === c.id);
        function navigateConcert(dir: "prev" | "next") {
          if (navigableIndex === -1) return;
          const target = navigableList[dir === "prev" ? navigableIndex - 1 : navigableIndex + 1];
          if (target) setConcertModalId(target.id);
        }
        return (
          <ConcertModal
            key={c.id}
            mode="edit"
            concert={c}
            bands={bands}
            isDraft={isNewDraft}
            startInEditMode={isNewDraft}
            onDiscardDraft={discardDraftAndClose}
            onClose={() => { setConcertModalId(null); setDraftConcert(null); }}
            onOpenRouteSheetPreview={() => { setConcertModalId(null); setDraftConcert(null); setRsPreviewConcertId(c.id); }}
            onNavigate={navigateConcert}
            hasPrev={navigableIndex > 0}
            hasNext={navigableIndex !== -1 && navigableIndex < navigableList.length - 1}
          />
        );
      })()}
      {rsModalConcertId && (() => {
        const c = concerts.find((x) => x.id === rsModalConcertId);
        if (!c) return null;
        return (
          <RouteSheetModal
            key={c.id}
            concert={c}
            onClose={() => setRsModalConcertId(null)}
            onOpenPreview={() => { setRsModalConcertId(null); setRsPreviewConcertId(c.id); }}
          />
        );
      })()}
      {rsPreviewConcertId && (() => {
        const c = concerts.find((x) => x.id === rsPreviewConcertId);
        if (!c) return null;
        return (
          <RouteSheetPreview
            concert={c}
            onClose={() => setRsPreviewConcertId(null)}
            onEdit={() => { setRsPreviewConcertId(null); setRsModalConcertId(c.id); }}
          />
        );
      })()}
    </div>
  );
}
