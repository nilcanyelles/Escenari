"use client";

import { useState } from "react";
import type { Band, Concert, Invoice } from "@/lib/types";
import { MONTH_ABBR, formatCurrency } from "@/lib/format";
import {
  computeMonthAgg, computeYearAgg, computeInvoiceMonthAgg, computeProjectedMonthAgg,
  computeInvoiceYearAgg, computeProjectedYearAgg, pieSlicePath, type InvoiceRecord,
} from "@/lib/resum-helpers";

const NBSP = " ";

function HbarSplitRow({ label, valueLabel, pct1, pct2, cls1, cls2, pct3, cls3, exactLabel }: {
  label: string | number; valueLabel: string | number; pct1: number; pct2: number; cls1: string; cls2: string;
  pct3: number; cls3: string; exactLabel?: string;
}) {
  return (
    <div className="hbar-row">
      <div className="hbar-label">{label}</div>
      <div className="hbar-track">
        {pct1 > 0 && <div className={"hbar-fill " + cls1} style={{ width: pct1 + "%" }}></div>}
        {pct2 > 0 && <div className={"hbar-fill " + cls2} style={{ width: pct2 + "%" }}></div>}
        {pct3 > 0 && <div className={"hbar-fill " + cls3} style={{ width: pct3 + "%" }}></div>}
      </div>
      {exactLabel ? (
        <div className="hbar-value-wrap"><span className="hbar-value">{valueLabel}</span><span className="hbar-value-exact">{exactLabel}</span></div>
      ) : (
        <div className="hbar-value">{valueLabel}</div>
      )}
    </div>
  );
}

function VbarSplitCol({ label, valueLabel, totalPct, share1, share2, cls1, cls2, share3, cls3, tt1, tt2, tt3, exactLabel }: {
  label: string; valueLabel: string | number; totalPct: number; share1: number; share2: number; cls1: string; cls2: string;
  share3: number; cls3: string; tt1?: React.ReactNode; tt2?: React.ReactNode; tt3?: React.ReactNode; exactLabel?: string;
}) {
  return (
    <div className="bar-col">
      {exactLabel ? (
        <div className="bar-count-wrap"><span className="bar-count">{valueLabel}</span><span className="bar-count-exact">{exactLabel}</span></div>
      ) : (
        <div className="bar-count">{valueLabel}</div>
      )}
      <div className="bar-fill-wrap" style={{ height: totalPct + "%" }}>
        {share3 > 0 && <div className={"bar-seg " + cls3} style={{ flex: share3 }}>{tt3}</div>}
        {share2 > 0 && <div className={"bar-seg " + cls2} style={{ flex: share2 }}>{tt2}</div>}
        {share1 > 0 && <div className={"bar-seg " + cls1} style={{ flex: share1 }}>{tt1}</div>}
      </div>
      <div className="bar-label">{label}</div>
    </div>
  );
}

function SegTooltip({ label, amount, total, valueFmt }: { label: React.ReactNode; amount: number; total: number; valueFmt: (n: number) => React.ReactNode }) {
  const pct = total ? Math.round((amount / total) * 100) : 0;
  return (
    <div className="seg-tooltip">
      <span className="seg-tooltip-label">{label}</span>
      <span className="seg-tooltip-pct">{pct}%</span>
      {amount !== total && <span className="seg-tooltip-value">{valueFmt(amount)}</span>}
    </div>
  );
}

function DonutSegTooltip({ wrapperCls, label, amount, total, valueFmt }: {
  wrapperCls: string; label: React.ReactNode; amount: number; total: number; valueFmt: (n: number) => React.ReactNode;
}) {
  const pct = total ? Math.round((amount / total) * 100) : 0;
  return (
    <div className={"donut-tooltip " + wrapperCls}>
      <span className="seg-tooltip-label">{label}</span>
      <span className="seg-tooltip-pct">{pct}%</span>
      <span className="seg-tooltip-value">{valueFmt(amount)}</span>
    </div>
  );
}

function MiniDonut3({ part1, part2, part3, label1, label2, label3, color1, color2, color3, valueFmt }: {
  part1: number; part2: number; part3: number; label1: React.ReactNode; label2: React.ReactNode; label3: React.ReactNode;
  color1: string; color2: string; color3: string; valueFmt: (n: number) => React.ReactNode;
}) {
  const total = part1 + part2 + part3;
  const nonZero = (part1 > 0 ? 1 : 0) + (part2 > 0 ? 1 : 0) + (part3 > 0 ? 1 : 0);
  const a1 = total ? (part1 / total) * 360 : 0;
  const rotation = 270 - a1 / 2;

  let slices: React.ReactNode;
  const tips: React.ReactNode[] = [];

  if (total === 0) {
    slices = <circle cx="18" cy="18" r="18" fill={color2}></circle>;
  } else if (nonZero === 1) {
    const soloColor = part1 > 0 ? color1 : part2 > 0 ? color2 : color3;
    const soloCls = part1 > 0 ? "donut-seg-past" : part2 > 0 ? "donut-seg-future" : "donut-seg-projected";
    slices = <circle className={soloCls} cx="18" cy="18" r="18" fill={soloColor}></circle>;
    if (part1 > 0) tips.push(<DonutSegTooltip key="t1" wrapperCls="donut-tooltip-past" label={label1} amount={part1} total={total} valueFmt={valueFmt} />);
    if (part2 > 0) tips.push(<DonutSegTooltip key="t2" wrapperCls="donut-tooltip-future" label={label2} amount={part2} total={total} valueFmt={valueFmt} />);
    if (part3 > 0) tips.push(<DonutSegTooltip key="t3" wrapperCls="donut-tooltip-projected" label={label3} amount={part3} total={total} valueFmt={valueFmt} />);
  } else {
    const a2 = total ? (part2 / total) * 360 : 0;
    let cursor = rotation;
    const paths: React.ReactNode[] = [];
    if (part1 > 0) {
      paths.push(<path key="p1" className="donut-seg-past" d={pieSlicePath(cursor, cursor + a1)} fill={color1}></path>);
      tips.push(<DonutSegTooltip key="t1" wrapperCls="donut-tooltip-past" label={label1} amount={part1} total={total} valueFmt={valueFmt} />);
      cursor += a1;
    }
    if (part2 > 0) {
      paths.push(<path key="p2" className="donut-seg-future" d={pieSlicePath(cursor, cursor + a2)} fill={color2}></path>);
      tips.push(<DonutSegTooltip key="t2" wrapperCls="donut-tooltip-future" label={label2} amount={part2} total={total} valueFmt={valueFmt} />);
      cursor += a2;
    }
    if (part3 > 0) {
      paths.push(<path key="p3" className="donut-seg-projected" d={pieSlicePath(cursor, rotation + 360)} fill={color3}></path>);
      tips.push(<DonutSegTooltip key="t3" wrapperCls="donut-tooltip-projected" label={label3} amount={part3} total={total} valueFmt={valueFmt} />);
    }
    slices = <>{paths}</>;
  }

  return (
    <div className="donut-wrap">
      <svg className="mini-donut" viewBox="0 0 36 36" width="40" height="40">{slices}</svg>
      {tips}
    </div>
  );
}

export default function ResumView({ bands, concerts, invoices, today }: { bands: Band[]; concerts: Concert[]; invoices: Invoice[]; today: string }) {
  const currentYear = parseInt(today.slice(0, 4), 10);
  const [resumRange, setResumRange] = useState<"year" | "all">("year");
  const [resumYear, setResumYear] = useState(currentYear);
  const [resumBandFilter, setResumBandFilter] = useState<string[]>([]);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [bandFilterOpen, setBandFilterOpen] = useState(false);

  // Anys disponibles al selector: els que apareixen a les dades, més l'any actual.
  const yearSet: Record<number, boolean> = { [currentYear]: true };
  concerts.forEach((c) => { yearSet[parseInt(c.date.slice(0, 4), 10)] = true; });
  invoices.forEach((i) => { yearSet[parseInt(i.issueDate.slice(0, 4), 10)] = true; });
  const resumYears = Object.keys(yearSet).map(Number).sort((a, b) => b - a);

  const bandFilterSet: Record<string, boolean> = {};
  resumBandFilter.forEach((id) => { bandFilterSet[id] = true; });
  const srcConcerts = resumBandFilter.length ? concerts.filter((c) => bandFilterSet[c.bandId]) : concerts;
  const donutPool = resumRange === "year"
    ? srcConcerts.filter((c) => c.date.slice(0, 4) === String(resumYear) && c.status !== "cancel·lat")
    : srcConcerts.filter((c) => c.status !== "cancel·lat");

  const concertsById: Record<string, Concert> = {};
  concerts.forEach((c) => { concertsById[c.id] = c; });
  const invoiceRecords: InvoiceRecord[] = invoices
    .filter((i) => { const c = concertsById[i.concertId]; return c && (!resumBandFilter.length || bandFilterSet[c.bandId]); })
    .map((i) => ({ date: concertsById[i.concertId].date, amount: i.amount, state: i.state }));
  const periodInvoiceRecords = resumRange === "year"
    ? invoiceRecords.filter((r) => r.date.slice(0, 4) === String(resumYear))
    : invoiceRecords;

  const invoicedIds: Record<string, boolean> = {};
  invoices.forEach((i) => { const c = concertsById[i.concertId]; if (c && (!resumBandFilter.length || bandFilterSet[c.bandId])) invoicedIds[i.concertId] = true; });
  const periodConcertsForProjection = resumRange === "year" ? srcConcerts.filter((c) => c.date.slice(0, 4) === String(resumYear)) : srcConcerts;
  const periodProjectedRevenue = periodConcertsForProjection
    .filter((c) => (c.status === "confirmat" || c.status === "pendent") && !invoicedIds[c.id])
    .reduce((s, c) => s + Math.round(c.amount * 1.21), 0);

  const selectorLabel = resumRange === "all" ? "Tots els temps" : String(resumYear);
  const bandLabel = resumBandFilter.length === 0
    ? "Tots els grups"
    : resumBandFilter.length === 1
      ? (bands.find((b) => b.id === resumBandFilter[0])?.name || "1 grup")
      : resumBandFilter.length + " grups";

  const identityFmt = (n: number) => n;

  let monthBars: React.ReactNode, revenueBars: React.ReactNode, chartContainerClass: string;
  const chartTitleConcerts = resumRange === "all" ? "Concerts anuals" : "Concerts per mes";
  const chartTitleRevenue = resumRange === "all" ? "Facturació anual" : "Facturació mensual";

  if (resumRange === "all") {
    chartContainerClass = "hbars";
    const years = resumYears.slice().sort((a, b) => a - b);
    const yagg = computeYearAgg(srcConcerts, years, today);
    const invYagg = computeInvoiceYearAgg(invoiceRecords, years);
    const projYagg = computeProjectedYearAgg(srcConcerts, invoicedIds, years);
    const yMaxCount = Math.max(1, ...years.map((y) => yagg[y].count));
    const yMaxRev = Math.max(1, ...years.map((y) => invYagg[y].revenue + projYagg[y]));
    monthBars = years.map((y) => {
      const pastPct = Math.round((yagg[y].pastCount / yMaxCount) * 100);
      const pendingPct = Math.round(((yagg[y].pastCount + yagg[y].pendingCount) / yMaxCount) * 100) - pastPct;
      const futurePct = Math.round((yagg[y].count / yMaxCount) * 100) - pastPct - pendingPct;
      return <HbarSplitRow key={y} label={y} valueLabel={yagg[y].count} pct1={pastPct} pct2={futurePct} cls1="concerts-past" cls2="concerts-future" pct3={pendingPct} cls3="concerts-pending" />;
    });
    revenueBars = years.map((y) => {
      const yearTotal = invYagg[y].revenue + projYagg[y];
      const paidPct = Math.round((invYagg[y].paidRevenue / yMaxRev) * 100);
      const pendingPct = Math.round((invYagg[y].revenue / yMaxRev) * 100) - paidPct;
      const projectedPct = Math.round((yearTotal / yMaxRev) * 100) - paidPct - pendingPct;
      return <HbarSplitRow key={y} label={y} valueLabel={Math.round(yearTotal / 1000) + "k"} pct1={paidPct} pct2={pendingPct} cls1="revenue-paid" cls2="revenue-pending" pct3={projectedPct} cls3="revenue-projected" exactLabel={formatCurrency(yearTotal)} />;
    });
  } else {
    chartContainerClass = "bars-row";
    const agg = computeMonthAgg(srcConcerts, resumYear, today);
    const invAgg = computeInvoiceMonthAgg(invoiceRecords, resumYear);
    const projAgg = computeProjectedMonthAgg(srcConcerts, invoicedIds, resumYear);
    const rangeMonths = Array.from({ length: 12 }, (_, m) => m);
    const maxCount = Math.max(1, ...rangeMonths.map((mm) => agg[mm].count));
    const maxRev = Math.max(1, ...rangeMonths.map((mm) => invAgg[mm].revenue + projAgg[mm]));

    monthBars = rangeMonths.map((mm) => {
      const totalPct = Math.round((agg[mm].count / maxCount) * 100);
      const monthCount = agg[mm].count;
      const ttPast = agg[mm].pastCount > 0 ? <SegTooltip label="Realitzats" amount={agg[mm].pastCount} total={monthCount} valueFmt={identityFmt} /> : undefined;
      const ttFuture = agg[mm].futureCount > 0 ? <SegTooltip label="Confirmats" amount={agg[mm].futureCount} total={monthCount} valueFmt={identityFmt} /> : undefined;
      const ttPending = agg[mm].pendingCount > 0 ? <SegTooltip label={`Pendents de${NBSP}confirmar`} amount={agg[mm].pendingCount} total={monthCount} valueFmt={identityFmt} /> : undefined;
      return <VbarSplitCol key={mm} label={MONTH_ABBR[mm]} valueLabel={agg[mm].count} totalPct={totalPct} share1={agg[mm].pastCount} share2={agg[mm].futureCount} cls1="concerts-past" cls2="concerts-future" share3={agg[mm].pendingCount} cls3="concerts-pending" tt1={ttPast} tt2={ttFuture} tt3={ttPending} />;
    });
    revenueBars = rangeMonths.map((mm) => {
      const monthTotal = invAgg[mm].revenue + projAgg[mm];
      const totalPct = Math.round((monthTotal / maxRev) * 100);
      const ttPaid = invAgg[mm].paidRevenue > 0 ? <SegTooltip label={`Facturat i${NBSP}cobrat`} amount={invAgg[mm].paidRevenue} total={monthTotal} valueFmt={formatCurrency} /> : undefined;
      const ttPending = invAgg[mm].pendingRevenue > 0 ? <SegTooltip label={`Facturat, pendent de${NBSP}cobrar`} amount={invAgg[mm].pendingRevenue} total={monthTotal} valueFmt={formatCurrency} /> : undefined;
      const ttProjected = projAgg[mm] > 0 ? <SegTooltip label={`Pactat, pendent de${NBSP}facturar`} amount={projAgg[mm]} total={monthTotal} valueFmt={formatCurrency} /> : undefined;
      return <VbarSplitCol key={mm} label={MONTH_ABBR[mm]} valueLabel={Math.round(monthTotal / 1000) + "k"} totalPct={totalPct} share1={invAgg[mm].paidRevenue} share2={invAgg[mm].pendingRevenue} cls1="revenue-paid" cls2="revenue-pending" share3={projAgg[mm]} cls3="revenue-projected" tt1={ttPaid} tt2={ttPending} tt3={ttProjected} exactLabel={formatCurrency(monthTotal)} />;
    });
  }

  const periodRevenue = periodInvoiceRecords.reduce((s, r) => s + r.amount, 0) + periodProjectedRevenue;

  const donutPending = donutPool.filter((c) => c.status === "pendent").length;
  const donutDone = donutPool.filter((c) => c.status !== "pendent" && c.date < today).length;
  const donutFuture = donutPool.length - donutDone - donutPending;
  const concertsDonut = (
    <MiniDonut3
      part1={donutDone} part2={donutFuture} part3={donutPending}
      label1="Realitzats" label2="Confirmats" label3={`Pendents de${NBSP}confirmar`}
      color1="var(--accent)" color2="oklch(0.68 0.19 290 / 0.5)" color3="oklch(0.68 0.19 290 / 0.25)"
      valueFmt={identityFmt}
    />
  );

  let revDonutPaid = 0, revDonutPending = 0;
  periodInvoiceRecords.forEach((r) => { if (r.state === "pagada") revDonutPaid += r.amount; else revDonutPending += r.amount; });
  const revenueDonut = (
    <MiniDonut3
      part1={revDonutPaid} part2={revDonutPending} part3={periodProjectedRevenue}
      label1={`Facturat i${NBSP}cobrat`} label2={`Facturat, pendent de${NBSP}cobrar`} label3={`Pactat, pendent de${NBSP}facturar`}
      color1="var(--green)" color2="oklch(0.72 0.15 155 / 0.5)" color3="oklch(0.72 0.15 155 / 0.25)"
      valueFmt={formatCurrency}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div className="range-pills">
        <div className="year-select-wrap">
          <button className="pill active" onClick={() => setYearPickerOpen((v) => !v)}>{selectorLabel} ▾</button>
          {yearPickerOpen && (
            <>
              <div className="year-picker-overlay" onClick={() => setYearPickerOpen(false)}></div>
              <div className="year-dropdown" onClick={(e) => e.stopPropagation()}>
                {resumYears.map((y) => (
                  <button key={y} className={"year-option" + (resumRange === "year" && resumYear === y ? " active" : "")}
                    onClick={() => { setResumRange("year"); setResumYear(y); setYearPickerOpen(false); }}>{y}</button>
                ))}
                <div className="year-option-divider"></div>
                <button className={"year-option" + (resumRange === "all" ? " active" : "")}
                  onClick={() => { setResumRange("all"); setYearPickerOpen(false); }}>Tots els temps</button>
              </div>
            </>
          )}
        </div>
        <div className="year-select-wrap">
          <button className="pill active" onClick={() => setBandFilterOpen((v) => !v)}>{bandLabel} ▾</button>
          {bandFilterOpen && (
            <>
              <div className="year-picker-overlay" onClick={() => setBandFilterOpen(false)}></div>
              <div className="year-dropdown band-dropdown" onClick={(e) => e.stopPropagation()}>
                <button className={"year-option" + (resumBandFilter.length === 0 ? " active" : "")} onClick={() => setResumBandFilter([])}>
                  <span className="band-check">{resumBandFilter.length === 0 ? "✓" : ""}</span>Tots els grups
                </button>
                <div className="year-option-divider"></div>
                {bands.map((b) => {
                  const checked = !!bandFilterSet[b.id];
                  return (
                    <button key={b.id} className={"year-option" + (checked ? " active" : "")}
                      onClick={() => setResumBandFilter((prev) => checked ? prev.filter((id) => id !== b.id) : prev.concat([b.id]))}>
                      <span className="band-check">{checked ? "✓" : ""}</span>{b.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="card card-centered"><div className="card-title">Total concerts</div><div className="card-value">{donutPool.length}</div></div>
        <div className="card card-centered"><div className="card-title">Total facturació (projectat)</div><div className="card-value">{formatCurrency(periodRevenue)}</div></div>
      </div>

      <div className="chart-grid">
        <div className="panel">
          <div className="panel-header-row">
            <div className="panel-title">{chartTitleConcerts}</div>
            {resumRange !== "all" && concertsDonut}
          </div>
          <div className={chartContainerClass}>{monthBars}</div>
        </div>
        <div className="panel">
          <div className="panel-header-row">
            <div className="panel-title">{chartTitleRevenue}</div>
            {resumRange !== "all" && revenueDonut}
          </div>
          <div className={chartContainerClass}>{revenueBars}</div>
        </div>
      </div>
    </div>
  );
}
