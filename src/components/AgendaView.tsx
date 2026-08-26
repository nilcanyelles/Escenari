"use client";

import { useState } from "react";
import type { Band, Concert, Invoice } from "@/lib/types";
import { MONTH_FULL, formatCurrency, formatDate, monthWithPrep } from "@/lib/format";
import CalendariView from "@/components/CalendariView";
import ShareMonthModal from "@/components/ShareMonthModal";

// Agenda = resum ràpid + calendari en una sola pàgina (la principal).
export default function AgendaView({ bands, concerts, invoices, icsToken = "", today }: { bands: Band[]; concerts: Concert[]; invoices: Invoice[]; icsToken?: string; today: string }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [icsCopied, setIcsCopied] = useState<string | null>(null);
  const ym = today.slice(0, 7);
  const monthIdx = parseInt(today.slice(5, 7), 10) - 1;

  const active = concerts.filter((c) => c.status !== "cancel·lat");
  const monthConcerts = active.filter((c) => c.date.slice(0, 7) === ym);
  const monthPending = monthConcerts.filter((c) => c.status === "pendent").length;

  const next = active
    .filter((c) => c.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0];

  const concertsById: Record<string, Concert> = {};
  concerts.forEach((c) => { concertsById[c.id] = c; });
  const invoicedIds: Record<string, boolean> = {};
  let monthRevenue = 0;
  invoices.forEach((i) => {
    const c = concertsById[i.concertId];
    if (!c) return;
    invoicedIds[i.concertId] = true;
    if (c.date.slice(0, 7) === ym) monthRevenue += i.amount;
  });
  monthConcerts.forEach((c) => {
    if ((c.status === "confirmat" || c.status === "pendent") && !invoicedIds[c.id]) monthRevenue += Math.round(c.amount * 1.21);
  });

  const monthLabel = monthWithPrep(MONTH_FULL[monthIdx]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="agenda-kpis">
        <div className="agenda-kpi">
          <div className="agenda-kpi-label">Pròxim bolo</div>
          {next ? (
            <>
              <div className="agenda-kpi-value">{formatDate(next.date)}</div>
              <div className="agenda-kpi-sub">{next.bandName}{next.city ? ` · ${next.city}` : ""}</div>
            </>
          ) : (
            <div className="agenda-kpi-value t-dim">—</div>
          )}
        </div>
        <div className="agenda-kpi">
          <div className="agenda-kpi-label">Bolos {monthLabel}</div>
          <div className="agenda-kpi-value">{monthConcerts.length}</div>
          <div className="agenda-kpi-sub">{monthPending ? `${monthPending} pendents de confirmar` : "tots confirmats"}</div>
        </div>
        <div className="agenda-kpi">
          <div className="agenda-kpi-label">Facturació {monthLabel}</div>
          <div className="agenda-kpi-value">{formatCurrency(monthRevenue)}</div>
          <div className="agenda-kpi-sub">projectat, IVA inclòs</div>
        </div>
        <button type="button" className="agenda-kpi agenda-kpi-share" onClick={() => setShareOpen(true)}>
          <div className="agenda-kpi-label">Comparteix</div>
          <div className="agenda-kpi-share-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4"></rect>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"></circle>
              <path d="M21 15l-5-5L5 21"></path>
            </svg>
          </div>
          <div className="agenda-kpi-sub">el mes en imatge</div>
        </button>
      </div>

      <CalendariView bands={bands} concerts={concerts} today={today} />

      {icsToken && (
        <div className="ics-row">
          <button
            type="button" className="link-btn"
            title="Copia l'URL per subscriure't des de Google Calendar o Apple Calendar"
            onClick={async () => {
              await navigator.clipboard.writeText(`${window.location.origin}/api/ics/${icsToken}`);
              setIcsCopied("ics");
              window.setTimeout(() => setIcsCopied(null), 1800);
            }}
          >📅 {icsCopied === "ics" ? "Enllaç copiat ✓" : "Subscriu-te al calendari (iCal)"}</button>
          <span className="t-dim">·</span>
          <button
            type="button" className="link-btn"
            title="Feed JSON públic dels bolos confirmats, per al web del grup"
            onClick={async () => {
              await navigator.clipboard.writeText(`${window.location.origin}/api/public-events/${icsToken}`);
              setIcsCopied("feed");
              window.setTimeout(() => setIcsCopied(null), 1800);
            }}
          >🌐 {icsCopied === "feed" ? "Enllaç copiat ✓" : "Feed públic per al web"}</button>
        </div>
      )}

      {shareOpen && (
        <ShareMonthModal bands={bands} concerts={concerts} today={today} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
