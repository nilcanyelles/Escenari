"use client";

import { useState } from "react";
import type { Band, Concert, Invoice } from "@/lib/types";
import { MONTH_ABBR, formatCurrency } from "@/lib/format";
import { bandColor } from "@/lib/tags";
import {
  computeMonthAgg, computeYearAgg, computeInvoiceMonthAgg, computeProjectedMonthAgg,
  computeInvoiceYearAgg, computeProjectedYearAgg, pieSlicePath, type InvoiceRecord,
} from "@/lib/resum-helpers";
import type { Transaction } from "@/lib/finance";
import FinancePanel from "@/components/FinancePanel";
import MunicipalityMap from "@/components/MunicipalityMap";

const NBSP = " ";

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

function RankList({ title, rows, fmt, titleExtra }: { title: string; rows: { label: string; value: number; color?: string }[]; fmt: (n: number) => string; titleExtra?: React.ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="panel">
      {titleExtra ? (
        <div className="panel-header-row">
          <div className="panel-title">{title}</div>
          {titleExtra}
        </div>
      ) : (
        <div className="panel-title" style={{ marginBottom: 12 }}>{title}</div>
      )}
      {rows.length === 0 ? (
        <div className="t-dim" style={{ fontSize: 13 }}>Sense dades en aquest període.</div>
      ) : (
        <div className="rank-list">
          {rows.map((r) => (
            <div key={r.label} className="rank-row">
              <div className="rank-label" title={r.label}>{r.label}</div>
              <div className="rank-track">
                <div className="rank-fill" style={{ width: (r.value / max) * 100 + "%", background: r.color || "var(--accent)" }}></div>
              </div>
              <div className="rank-value">{fmt(r.value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatsView({ bands, concerts, invoices, transactions = [], today }: { bands: Band[]; concerts: Concert[]; invoices: Invoice[]; transactions?: Transaction[]; today: string }) {
  const currentYear = parseInt(today.slice(0, 4), 10);
  const [tab, setTab] = useState<"concerts" | "diners">("concerts");
  const [range, setRange] = useState<"year" | "all">("year");
  const [year, setYear] = useState(currentYear);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [showMuniMap, setShowMuniMap] = useState(false);

  const yearSet: Record<number, boolean> = { [currentYear]: true };
  concerts.forEach((c) => { yearSet[parseInt(c.date.slice(0, 4), 10)] = true; });
  invoices.forEach((i) => { yearSet[parseInt(i.issueDate.slice(0, 4), 10)] = true; });
  const years = Object.keys(yearSet).map(Number).sort((a, b) => b - a);

  const inPeriod = (date: string) => range === "all" || date.slice(0, 4) === String(year);
  const pool = concerts.filter((c) => inPeriod(c.date) && c.status !== "cancel·lat");
  // Estadístiques de "Concerts": només bolos de veritat — assajos, reunions
  // i altres tipus d'esdeveniment no hi compten (la pestanya "Diners" sí
  // que els inclou, perquè un pagament és un pagament independentment del
  // tipus d'esdeveniment que el va generar).
  const boloConcerts = concerts.filter((c) => c.kind !== "assaig" && c.kind !== "reunio" && c.kind !== "altre");

  const concertsById: Record<string, Concert> = {};
  concerts.forEach((c) => { concertsById[c.id] = c; });
  const invoiceRecords: InvoiceRecord[] = invoices
    .filter((i) => concertsById[i.concertId])
    .map((i) => ({ date: concertsById[i.concertId].date, amount: i.amount, state: i.state }));
  const periodInvoices = invoices.filter((i) => concertsById[i.concertId] && inPeriod(concertsById[i.concertId].date));

  const invoicedIds: Record<string, boolean> = {};
  invoices.forEach((i) => { invoicedIds[i.concertId] = true; });
  const projected = pool
    .filter((c) => (c.status === "confirmat" || c.status === "pendent" || c.status === "reservat") && !invoicedIds[c.id])
    .reduce((s, c) => s + Math.round(c.amount * 1.21), 0);

  const selectorLabel = range === "all" ? "Tots els temps" : String(year);
  const identityFmt = (n: number) => n;

  // ------- Gràfic principal (mesos o anys) -------
  let mainBars: React.ReactNode, chartContainerClass: string, chartTitle: string;
  if (range === "all") {
    chartContainerClass = "hbars";
    const yrs = years.slice().sort((a, b) => a - b);
    if (tab === "concerts") {
      chartTitle = "Concerts anuals";
      const yagg = computeYearAgg(boloConcerts, yrs, today);
      const yMax = Math.max(1, ...yrs.map((yy) => yagg[yy].count));
      mainBars = yrs.map((yy) => {
        const pastPct = Math.round((yagg[yy].pastCount / yMax) * 100);
        const pendingPct = Math.round(((yagg[yy].pastCount + yagg[yy].pendingCount) / yMax) * 100) - pastPct;
        const futurePct = Math.round((yagg[yy].count / yMax) * 100) - pastPct - pendingPct;
        return <HbarSplitRow key={yy} label={yy} valueLabel={yagg[yy].count} pct1={pastPct} pct2={futurePct} cls1="concerts-past" cls2="concerts-future" pct3={pendingPct} cls3="concerts-pending" />;
      });
    } else {
      chartTitle = "Facturació anual";
      const invYagg = computeInvoiceYearAgg(invoiceRecords, yrs);
      const projYagg = computeProjectedYearAgg(concerts, invoicedIds, yrs);
      const yMax = Math.max(1, ...yrs.map((yy) => invYagg[yy].revenue + projYagg[yy]));
      mainBars = yrs.map((yy) => {
        const yearTotal = invYagg[yy].revenue + projYagg[yy];
        const paidPct = Math.round((invYagg[yy].paidRevenue / yMax) * 100);
        const pendingPct = Math.round((invYagg[yy].revenue / yMax) * 100) - paidPct;
        const projectedPct = Math.round((yearTotal / yMax) * 100) - paidPct - pendingPct;
        return <HbarSplitRow key={yy} label={yy} valueLabel={Math.round(yearTotal / 1000) + "k"} pct1={paidPct} pct2={pendingPct} cls1="revenue-paid" cls2="revenue-pending" pct3={projectedPct} cls3="revenue-projected" exactLabel={formatCurrency(yearTotal)} />;
      });
    }
  } else {
    chartContainerClass = "bars-row";
    const months = Array.from({ length: 12 }, (_, m) => m);
    if (tab === "concerts") {
      chartTitle = "Concerts per mes";
      const agg = computeMonthAgg(boloConcerts, year, today);
      const maxCount = Math.max(1, ...months.map((mm) => agg[mm].count));
      mainBars = months.map((mm) => {
        const totalPct = Math.round((agg[mm].count / maxCount) * 100);
        const monthCount = agg[mm].count;
        const ttPast = agg[mm].pastCount > 0 ? <SegTooltip label="Realitzats" amount={agg[mm].pastCount} total={monthCount} valueFmt={identityFmt} /> : undefined;
        const ttFuture = agg[mm].futureCount > 0 ? <SegTooltip label="Confirmats" amount={agg[mm].futureCount} total={monthCount} valueFmt={identityFmt} /> : undefined;
        const ttPending = agg[mm].pendingCount > 0 ? <SegTooltip label={`Pendents de${NBSP}confirmar`} amount={agg[mm].pendingCount} total={monthCount} valueFmt={identityFmt} /> : undefined;
        return <VbarSplitCol key={mm} label={MONTH_ABBR[mm]} valueLabel={agg[mm].count} totalPct={totalPct} share1={agg[mm].pastCount} share2={agg[mm].futureCount} cls1="concerts-past" cls2="concerts-future" share3={agg[mm].pendingCount} cls3="concerts-pending" tt1={ttPast} tt2={ttFuture} tt3={ttPending} />;
      });
    } else {
      chartTitle = "Facturació mensual";
      const invAgg = computeInvoiceMonthAgg(invoiceRecords, year);
      const projAgg = computeProjectedMonthAgg(concerts, invoicedIds, year);
      const maxRev = Math.max(1, ...months.map((mm) => invAgg[mm].revenue + projAgg[mm]));
      mainBars = months.map((mm) => {
        const monthTotal = invAgg[mm].revenue + projAgg[mm];
        const totalPct = Math.round((monthTotal / maxRev) * 100);
        const ttPaid = invAgg[mm].paidRevenue > 0 ? <SegTooltip label={`Facturat i${NBSP}cobrat`} amount={invAgg[mm].paidRevenue} total={monthTotal} valueFmt={formatCurrency} /> : undefined;
        const ttPending = invAgg[mm].pendingRevenue > 0 ? <SegTooltip label={`Facturat, pendent de${NBSP}cobrar`} amount={invAgg[mm].pendingRevenue} total={monthTotal} valueFmt={formatCurrency} /> : undefined;
        const ttProjected = projAgg[mm] > 0 ? <SegTooltip label={`Pactat, pendent de${NBSP}facturar`} amount={projAgg[mm]} total={monthTotal} valueFmt={formatCurrency} /> : undefined;
        return <VbarSplitCol key={mm} label={MONTH_ABBR[mm]} valueLabel={Math.round(monthTotal / 1000) + "k"} totalPct={totalPct} share1={invAgg[mm].paidRevenue} share2={invAgg[mm].pendingRevenue} cls1="revenue-paid" cls2="revenue-pending" share3={projAgg[mm]} cls3="revenue-projected" tt1={ttPaid} tt2={ttPending} tt3={ttProjected} exactLabel={formatCurrency(monthTotal)} />;
      });
    }
  }

  // ------- KPIs + rànquings per subtab -------
  let kpis: React.ReactNode, ranks: React.ReactNode, donut: React.ReactNode;

  if (tab === "concerts") {
    const concertsPool = pool.filter((c) => c.kind !== "assaig" && c.kind !== "reunio" && c.kind !== "altre");
    const done = concertsPool.filter((c) => c.status !== "pendent" && c.date < today).length;
    const pending = concertsPool.filter((c) => c.status === "pendent" || c.status === "reservat").length;
    const future = concertsPool.length - done - pending;
    const cancelled = boloConcerts.filter((c) => inPeriod(c.date) && c.status === "cancel·lat").length;
    const confirmRate = concertsPool.length + cancelled > 0 ? Math.round((concertsPool.length / (concertsPool.length + cancelled)) * 100) : 0;

    const byCity: Record<string, number> = {};
    const byBand: Record<string, number> = {};
    concertsPool.forEach((c) => {
      const city = (c.city || "").split(",")[0].trim();
      if (city) byCity[city] = (byCity[city] || 0) + 1;
      byBand[c.bandId] = (byBand[c.bandId] || 0) + 1;
    });
    const cityEntries = Object.entries(byCity).sort((a, b) => b[1] - a[1]);
    const topCities = cityEntries.slice(0, 6).map(([label, value]) => ({ label, value }));
    const allCities = cityEntries.map(([name, count]) => ({ name, count }));
    const bandRows = Object.entries(byBand).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([id, value]) => ({ label: bands.find((b) => b.id === id)?.name || "—", value, color: bandColor(id).color }));

    donut = (
      <MiniDonut3
        part1={done} part2={future} part3={pending}
        label1="Realitzats" label2="Confirmats" label3={`Pendents de${NBSP}confirmar`}
        color1="var(--accent)" color2="oklch(0.68 0.19 290 / 0.5)" color3="oklch(0.68 0.19 290 / 0.25)"
        valueFmt={identityFmt}
      />
    );
    kpis = (
      <div className="kpi-grid kpi-grid-4">
        <div className="card card-centered"><div className="card-title">Total concerts</div><div className="card-value">{concertsPool.length}</div></div>
        <div className="card card-centered"><div className="card-title">Realitzats</div><div className="card-value">{done}</div></div>
        <div className="card card-centered"><div className="card-title">Pendents de confirmar</div><div className="card-value">{pending}</div></div>
        <div className="card card-centered"><div className="card-title">Taxa de confirmació</div><div className="card-value">{confirmRate}%</div></div>
      </div>
    );
    ranks = (
      <>
        <div className="chart-grid">
          <RankList title="Concerts per grup" rows={bandRows} fmt={(n) => String(n)} />
          <RankList
            title="Poblacions més repetides"
            rows={topCities}
            fmt={(n) => String(n)}
            titleExtra={
              <button type="button" className="panel-icon-btn" title="Veure mapa de municipis" aria-label="Veure mapa de municipis" onClick={() => setShowMuniMap(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <path d="M21 15l-5-5L5 21"></path>
                </svg>
              </button>
            }
          />
        </div>
        {showMuniMap && (
          <div className="modal-overlay" onClick={() => setShowMuniMap(false)}>
            <div className="modal muni-map-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">Mapa de municipis</div>
                <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={() => setShowMuniMap(false)}>✕</button>
              </div>
              <MunicipalityMap cities={allCities} />
            </div>
          </div>
        )}
      </>
    );
  } else {
    let paid = 0, pendingRev = 0, overdue = 0;
    periodInvoices.forEach((i) => {
      if (i.state === "pagada") paid += i.amount;
      else { pendingRev += i.amount; if (i.state === "vençuda") overdue += i.amount; }
    });
    const totalRev = paid + pendingRev + projected;
    const avgPerConcert = pool.length ? Math.round(totalRev / pool.length) : 0;

    const revByBand: Record<string, number> = {};
    periodInvoices.forEach((i) => {
      const c = concertsById[i.concertId];
      if (c) revByBand[c.bandId] = (revByBand[c.bandId] || 0) + i.amount;
    });
    pool.forEach((c) => {
      if ((c.status === "confirmat" || c.status === "pendent" || c.status === "reservat") && !invoicedIds[c.id]) {
        revByBand[c.bandId] = (revByBand[c.bandId] || 0) + Math.round(c.amount * 1.21);
      }
    });
    const bandRows = Object.entries(revByBand).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([id, value]) => ({ label: bands.find((b) => b.id === id)?.name || "—", value, color: bandColor(id).color }));

    const revByCity: Record<string, number> = {};
    pool.forEach((c) => {
      const city = (c.city || "").split(",")[0].trim();
      if (city) revByCity[city] = (revByCity[city] || 0) + Math.round(c.amount * 1.21);
    });
    const cityRows = Object.entries(revByCity).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([label, value]) => ({ label, value }));

    donut = (
      <MiniDonut3
        part1={paid} part2={pendingRev} part3={projected}
        label1={`Facturat i${NBSP}cobrat`} label2={`Facturat, pendent de${NBSP}cobrar`} label3={`Pactat, pendent de${NBSP}facturar`}
        color1="var(--green)" color2="oklch(0.72 0.15 155 / 0.5)" color3="oklch(0.72 0.15 155 / 0.25)"
        valueFmt={formatCurrency}
      />
    );
    kpis = (
      <div className="kpi-grid kpi-grid-4">
        <div className="card card-centered"><div className="card-title">Total (projectat)</div><div className="card-value">{formatCurrency(totalRev)}</div></div>
        <div className="card card-centered"><div className="card-title">Cobrat</div><div className="card-value">{formatCurrency(paid)}</div></div>
        <div className="card card-centered"><div className="card-title">Pendent de cobrar</div><div className="card-value">{formatCurrency(pendingRev)}</div>{overdue > 0 && <div className="t-dim" style={{ fontSize: 11, color: "oklch(0.74 0.18 25)" }}>{formatCurrency(overdue)} vençut</div>}</div>
        <div className="card card-centered"><div className="card-title">Mitjana per bolo</div><div className="card-value">{formatCurrency(avgPerConcert)}</div></div>
      </div>
    );
    ranks = (
      <div className="chart-grid">
        <RankList title="Facturació per grup" rows={bandRows} fmt={formatCurrency} />
        <RankList title="Facturació per població" rows={cityRows} fmt={formatCurrency} />
      </div>
    );
  }

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div className="glow-blooms" aria-hidden="true"></div>

      <div className="range-pills" style={{ justifyContent: "space-between" }}>
        <div className="stats-tabs">
          <button className={"stats-tab" + (tab === "concerts" ? " active" : "")} onClick={() => setTab("concerts")}>Concerts</button>
          <button className={"stats-tab" + (tab === "diners" ? " active" : "")} onClick={() => setTab("diners")}>Diners</button>
        </div>
        <div className="year-select-wrap">
          <button className="pill active" onClick={() => setYearPickerOpen((v) => !v)}>{selectorLabel} ▾</button>
          {yearPickerOpen && (
            <>
              <div className="year-picker-overlay" onClick={() => setYearPickerOpen(false)}></div>
              <div className="year-dropdown" onClick={(e) => e.stopPropagation()}>
                {years.map((yy) => (
                  <button key={yy} className={"year-option" + (range === "year" && year === yy ? " active" : "")}
                    onClick={() => { setRange("year"); setYear(yy); setYearPickerOpen(false); }}>{yy}</button>
                ))}
                <div className="year-option-divider"></div>
                <button className={"year-option" + (range === "all" ? " active" : "")}
                  onClick={() => { setRange("all"); setYearPickerOpen(false); }}>Tots els temps</button>
              </div>
            </>
          )}
        </div>
      </div>

      {kpis}

      <div className="panel">
        <div className="panel-header-row">
          <div className="panel-title">{chartTitle}</div>
          {range !== "all" && donut}
        </div>
        <div className={chartContainerClass}>{mainBars}</div>
      </div>

      {ranks}

      {tab === "diners" && <FinancePanel transactions={transactions} bands={bands} concerts={concerts} invoices={invoices} />}
    </div>
  );
}
