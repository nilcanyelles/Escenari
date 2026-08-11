import type { Concert } from "./types";

export type MonthAggEntry = { count: number; pastCount: number; futureCount: number; pendingCount: number };
export type InvoiceRecord = { date: string; amount: number; state: string };

export function computeMonthAgg(concerts: Concert[], yearFilter: number, today: string): Record<number, MonthAggEntry> {
  const agg: Record<number, MonthAggEntry> = {};
  for (let m = 0; m < 12; m++) agg[m] = { count: 0, pastCount: 0, futureCount: 0, pendingCount: 0 };
  concerts.forEach((c) => {
    if (yearFilter && c.date.slice(0, 4) !== String(yearFilter)) return;
    if (c.status === "cancel·lat") return;
    const m2 = parseInt(c.date.slice(5, 7), 10) - 1;
    agg[m2].count += 1;
    if (c.status === "pendent") agg[m2].pendingCount += 1;
    else if (c.date < today) agg[m2].pastCount += 1;
    else agg[m2].futureCount += 1;
  });
  return agg;
}

export function computeYearAgg(concerts: Concert[], years: number[], today: string): Record<number, MonthAggEntry> {
  const agg: Record<number, MonthAggEntry> = {};
  years.forEach((y) => { agg[y] = { count: 0, pastCount: 0, futureCount: 0, pendingCount: 0 }; });
  concerts.forEach((c) => {
    const y = Number(c.date.slice(0, 4));
    if (!(y in agg) || c.status === "cancel·lat") return;
    agg[y].count += 1;
    if (c.status === "pendent") agg[y].pendingCount += 1;
    else if (c.date < today) agg[y].pastCount += 1;
    else agg[y].futureCount += 1;
  });
  return agg;
}

export function computeInvoiceMonthAgg(invoiceRecords: InvoiceRecord[], yearFilter: number) {
  const agg: Record<number, { revenue: number; paidRevenue: number; pendingRevenue: number }> = {};
  for (let m = 0; m < 12; m++) agg[m] = { revenue: 0, paidRevenue: 0, pendingRevenue: 0 };
  invoiceRecords.forEach((r) => {
    if (yearFilter && r.date.slice(0, 4) !== String(yearFilter)) return;
    const m2 = parseInt(r.date.slice(5, 7), 10) - 1;
    agg[m2].revenue += r.amount;
    if (r.state === "pagada") agg[m2].paidRevenue += r.amount; else agg[m2].pendingRevenue += r.amount;
  });
  return agg;
}

export function computeProjectedMonthAgg(concerts: Concert[], invoicedIds: Record<string, boolean>, yearFilter: number) {
  const agg: Record<number, number> = {};
  for (let m = 0; m < 12; m++) agg[m] = 0;
  concerts.forEach((c) => {
    if (yearFilter && c.date.slice(0, 4) !== String(yearFilter)) return;
    if (c.status !== "confirmat" && c.status !== "pendent") return;
    if (invoicedIds[c.id]) return;
    const m2 = parseInt(c.date.slice(5, 7), 10) - 1;
    agg[m2] += Math.round(c.amount * 1.21);
  });
  return agg;
}

export function computeInvoiceYearAgg(invoiceRecords: InvoiceRecord[], years: number[]) {
  const agg: Record<number, { revenue: number; paidRevenue: number; pendingRevenue: number }> = {};
  years.forEach((y) => { agg[y] = { revenue: 0, paidRevenue: 0, pendingRevenue: 0 }; });
  invoiceRecords.forEach((r) => {
    const y = Number(r.date.slice(0, 4));
    if (!(y in agg)) return;
    agg[y].revenue += r.amount;
    if (r.state === "pagada") agg[y].paidRevenue += r.amount; else agg[y].pendingRevenue += r.amount;
  });
  return agg;
}

export function computeProjectedYearAgg(concerts: Concert[], invoicedIds: Record<string, boolean>, years: number[]) {
  const agg: Record<number, number> = {};
  years.forEach((y) => { agg[y] = 0; });
  concerts.forEach((c) => {
    const y = Number(c.date.slice(0, 4));
    if (!(y in agg)) return;
    if (c.status !== "confirmat" && c.status !== "pendent") return;
    if (invoicedIds[c.id]) return;
    agg[y] += Math.round(c.amount * 1.21);
  });
  return agg;
}

export function pieSlicePath(angleStart: number, angleEnd: number): string {
  function pt(angleDeg: number) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: 18 + 18 * Math.cos(rad), y: 18 + 18 * Math.sin(rad) };
  }
  const p1 = pt(angleStart), p2 = pt(angleEnd);
  const largeArc = angleEnd - angleStart > 180 ? 1 : 0;
  return `M18 18 L${p1.x} ${p1.y} A18 18 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}
