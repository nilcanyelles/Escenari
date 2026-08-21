"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Concert, Invoice, ClientDetails } from "@/lib/types";
import { formatDate, formatCurrency, statusColors, pad2, capitalize, MONTH_FULL, WEEKDAY_SHORT, today } from "@/lib/format";
import { tagColors } from "@/lib/tags";
import { deleteConcertAction } from "@/app/(app)/concerts/actions";
import {
  updateConcertFieldAction, cycleConcertStatusAction, updateBandFieldAction, upsertClientDetailsAction, resetSampleDataAction,
} from "@/app/(app)/base-de-dades/actions";

type View = "concerts" | "grups" | "clients";
type SortKey = "id" | "date" | "band" | "status" | "amount";

function MiniDatePicker({ value, onSelect, onClose }: { value: string; onSelect: (date: string) => void; onClose: () => void }) {
  const [ym, setYm] = useState((value || today()).slice(0, 7));
  const y = parseInt(ym.slice(0, 4), 10), mIdx = parseInt(ym.slice(5, 7), 10) - 1;
  const monthLabel = capitalize(MONTH_FULL[mIdx]) + " " + y;
  const base = new Date(y, mIdx, 1);
  const startOffset = (base.getDay() + 6) % 7;
  const daysInMonth = new Date(y, mIdx + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const d = new Date(y, mIdx + delta, 1);
    setYm(d.getFullYear() + "-" + pad2(d.getMonth() + 1));
  }

  return (
    <>
      <div className="year-picker-overlay" onClick={onClose}></div>
      <div className="year-dropdown cf-datepicker" onClick={(e) => e.stopPropagation()}>
        <div className="cf-dp-header">
          <button type="button" className="cal-nav-btn" onClick={() => shift(-1)}>‹</button>
          <div className="cf-dp-month-label">{monthLabel}</div>
          <button type="button" className="cal-nav-btn" onClick={() => shift(1)}>›</button>
        </div>
        <div className="cf-dp-grid">{WEEKDAY_SHORT.map((w) => <div key={w} className="cf-dp-weekday">{w}</div>)}</div>
        <div className="cf-dp-grid">
          {cells.map((dd, i) => {
            if (!dd) return <button key={i} type="button" className="cf-dp-day empty" disabled></button>;
            const dateStr = y + "-" + pad2(mIdx + 1) + "-" + pad2(dd);
            return (
              <button key={i} type="button" className={"cf-dp-day" + (value === dateStr ? " selected" : "") + (dateStr === today() ? " today" : "")}
                onClick={() => onSelect(dateStr)}>{dd}</button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function BaseDeDadesView({
  bands, concerts, invoices, clientDetails,
}: { bands: Band[]; concerts: Concert[]; invoices: Invoice[]; clientDetails: Record<string, ClientDetails> }) {
  const router = useRouter();
  const [view, setView] = useState<View>("concerts");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);
  const PAGE_SIZE = 50;
  const [rowsVisible, setRowsVisible] = useState(PAGE_SIZE);

  useEffect(() => { setRowsVisible(PAGE_SIZE); }, [search, view, sortKey, sortDir]);

  const searchL = search.toLowerCase();

  function refresh() { router.refresh(); }

  // ---- Concerts tab ----
  const keyFns: Record<SortKey, (c: Concert) => string | number> = {
    id: (c) => c.id, date: (c) => c.date, band: (c) => c.bandName, status: (c) => c.status, amount: (c) => c.amount,
  };
  const dir = sortDir === "asc" ? 1 : -1;
  const rows = concerts
    .filter((c) => !searchL || c.bandName.toLowerCase().includes(searchL) || c.venue.toLowerCase().includes(searchL) || c.city.toLowerCase().includes(searchL))
    .slice()
    .sort((a, b) => {
      const ka = keyFns[sortKey](a), kb = keyFns[sortKey](b);
      if (ka > kb) return dir; if (ka < kb) return -dir; return 0;
    });
  const invByConcert: Record<string, string> = {};
  invoices.forEach((i) => { invByConcert[i.concertId] = i.state; });

  function sortArrow(key: SortKey) { return sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""; }
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // ---- Grups tab ----
  const bandRows = bands.filter((b) => !searchL || b.name.toLowerCase().includes(searchL));

  // ---- Clients tab ----
  type ClientRow = { name: string; invoiceCount: number; billed: number; pending: number };
  const clientsMap: Record<string, ClientRow> = {};
  concerts.forEach((c) => { if (c.venue && !clientsMap[c.venue]) clientsMap[c.venue] = { name: c.venue, invoiceCount: 0, billed: 0, pending: 0 }; });
  invoices.forEach((i) => {
    if (!clientsMap[i.client]) clientsMap[i.client] = { name: i.client, invoiceCount: 0, billed: 0, pending: 0 };
    clientsMap[i.client].invoiceCount++;
    clientsMap[i.client].billed += i.amount;
    if (i.state === "pendent") clientsMap[i.client].pending += i.amount;
  });
  const clientRows = Object.values(clientsMap)
    .filter((cl) => !searchL || cl.name.toLowerCase().includes(searchL))
    .sort((a, b) => a.name.localeCompare(b.name));

  const countLabel = view === "concerts" ? rows.length + " registres" : view === "grups" ? bandRows.length + " grups" : clientRows.length + " clients";

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="glow-blooms" aria-hidden="true"></div>
      <div className="filter-bar db-filterbar">
        <div className="db-view-toggle">
          <button type="button" className={"db-view-btn" + (view === "grups" ? " active" : "")} onClick={() => { setView("grups"); setSearch(""); }}>Grups</button>
          <button type="button" className={"db-view-btn" + (view === "concerts" ? " active" : "")} onClick={() => { setView("concerts"); setSearch(""); }}>Concerts</button>
          <button type="button" className={"db-view-btn" + (view === "clients" ? " active" : "")} onClick={() => { setView("clients"); setSearch(""); }}>Clients</button>
        </div>
        <input className="input search" style={{ maxWidth: 340 }} type="text" placeholder="Cercar en tots els registres…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="spacer"></div>
        <button className="link-btn" onClick={async () => {
          if (!confirm("Restaurar totes les dades d'exemple? Es perdran els canvis fets.")) return;
          await resetSampleDataAction();
          refresh();
        }}>Restaurar dades d&apos;exemple</button>
        <div className="page-label">{countLabel}</div>
      </div>

      {view === "concerts" && (
        rows.length ? (
          <div className="table-wrap no-clip">
            <div className="t-row t-head db-cols">
              <button onClick={() => toggleSort("id")}>ID{sortArrow("id")}</button>
              <button onClick={() => toggleSort("date")}>Data{sortArrow("date")}</button>
              <button onClick={() => toggleSort("band")}>Grup{sortArrow("band")}</button>
              <div>Població</div>
              <div>Recinte</div>
              <button onClick={() => toggleSort("status")}>Estat{sortArrow("status")}</button>
              <button onClick={() => toggleSort("amount")}>Catxet{sortArrow("amount")}</button>
              <div>Factura</div>
              <div></div>
            </div>
            {rows.slice(0, rowsVisible).map((r) => {
              const sc = statusColors(r.status);
              return (
                <div key={r.id} className="t-row db-cols">
                  <div className="t-dim">{r.id}</div>
                  <div className="db-date-wrap" style={{ position: "relative" }}>
                    <button type="button" className="field-input db-cell-input db-date-btn" onClick={() => setDatePickerFor(datePickerFor === r.id ? null : r.id)}>{formatDate(r.date)}</button>
                    {datePickerFor === r.id && (
                      <MiniDatePicker value={r.date} onClose={() => setDatePickerFor(null)}
                        onSelect={async (date) => { setDatePickerFor(null); await updateConcertFieldAction(r.id, "date", date); refresh(); }} />
                    )}
                  </div>
                  <input className="field-input db-cell-input" type="text" list="db-band-names" defaultValue={r.bandName}
                    onBlur={async (e) => { if (e.target.value !== r.bandName) { await updateConcertFieldAction(r.id, "bandName", e.target.value); refresh(); } }} />
                  <input className="field-input db-cell-input" type="text" defaultValue={r.city}
                    onBlur={async (e) => { if (e.target.value !== r.city) { await updateConcertFieldAction(r.id, "city", e.target.value); refresh(); } }} />
                  <input className="field-input db-cell-input" type="text" defaultValue={r.venue}
                    onBlur={async (e) => { if (e.target.value !== r.venue) { await updateConcertFieldAction(r.id, "venue", e.target.value); refresh(); } }} />
                  <button type="button" className="status-cycle-btn" style={{ background: sc.bg, color: sc.color }}
                    onClick={async () => { await cycleConcertStatusAction(r.id); refresh(); }}>{r.status}</button>
                  <div className="db-amount-wrap">
                    <input className="field-input db-cell-input db-amount-input" type="number" defaultValue={r.amount}
                      onBlur={async (e) => { const v = parseFloat(e.target.value) || 0; if (v !== r.amount) { await updateConcertFieldAction(r.id, "amount", v); refresh(); } }} />
                    <span className="db-amount-suffix">€</span>
                  </div>
                  <div className="t-dim">{invByConcert[r.id] || "—"}</div>
                  <div className="row-actions">
                    <button className="row-delete-btn" title="Eliminar concert" aria-label="Eliminar concert"
                      onClick={async () => { if (!confirm("Segur que vols eliminar aquest concert?")) return; await deleteConcertAction(r.id); refresh(); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {rowsVisible < rows.length && (
              <button type="button" className="load-more-btn" onClick={() => setRowsVisible((v) => v + PAGE_SIZE)}>
                Mostra {Math.min(PAGE_SIZE, rows.length - rowsVisible)} més ({rows.length - rowsVisible} restants)
              </button>
            )}
          </div>
        ) : <div className="empty-state">Cap registre coincideix amb la cerca.</div>
      )}

      {view === "grups" && (
        bandRows.length ? (
          <div className="table-wrap no-clip">
            <div className="t-row t-head bands-cols"><div>Nom del grup</div><div>Etiquetes</div><div>Catxet</div><div>Músics</div><div>Crew</div></div>
            {bandRows.map((b) => (
              <div key={b.id} className="t-row bands-cols">
                <input className="field-input db-cell-input" type="text" defaultValue={b.name}
                  onBlur={async (e) => { if (e.target.value !== b.name) { await updateBandFieldAction(b.id, "name", e.target.value); refresh(); } }} />
                <div className="db-tags-cell">
                  {(b.tags || []).length ? (b.tags || []).map((t) => {
                    const tc = tagColors(t);
                    return <span key={t} className="badge sm" style={{ background: tc.bg, color: tc.color }}>{t}</span>;
                  }) : <span className="t-dim">—</span>}
                </div>
                <div className="db-amount-wrap">
                  <input className="field-input db-cell-input db-amount-input" type="number" defaultValue={b.rate}
                    onBlur={async (e) => { const v = parseFloat(e.target.value) || 0; if (v !== b.rate) { await updateBandFieldAction(b.id, "rate", v); refresh(); } }} />
                  <span className="db-amount-suffix">€</span>
                </div>
                <div className="t-dim">{(b.members || []).length}</div>
                <div className="t-dim">{(b.crew || []).length}</div>
              </div>
            ))}
          </div>
        ) : <div className="empty-state">Cap grup coincideix amb la cerca.</div>
      )}

      {view === "clients" && (
        clientRows.length ? (
          <div className="table-wrap no-clip">
            <div className="t-row t-head clients-cols"><div>Client</div><div>CIF</div><div>Nom</div><div>Adreça</div><div>Factures emeses</div><div>Facturat</div><div>Pendent</div></div>
            {clientRows.map((cl) => {
              const cd = clientDetails[cl.name] || { cif: "", nom: "", address: "" };
              return (
                <div key={cl.name} className="t-row clients-cols">
                  <div className="t-strong">{cl.name}</div>
                  <input className="field-input db-cell-input" type="text" placeholder="—" defaultValue={cd.cif}
                    onBlur={async (e) => { if (e.target.value !== cd.cif) { await upsertClientDetailsAction(cl.name, "cif", e.target.value); refresh(); } }} />
                  <input className="field-input db-cell-input" type="text" placeholder="—" defaultValue={cd.nom}
                    onBlur={async (e) => { if (e.target.value !== cd.nom) { await upsertClientDetailsAction(cl.name, "nom", e.target.value); refresh(); } }} />
                  <input className="field-input db-cell-input" type="text" placeholder="—" defaultValue={cd.address}
                    onBlur={async (e) => { if (e.target.value !== cd.address) { await upsertClientDetailsAction(cl.name, "address", e.target.value); refresh(); } }} />
                  <div className="t-dim">{cl.invoiceCount}</div>
                  <div>{formatCurrency(cl.billed)}</div>
                  <div style={cl.pending > 0 ? { color: "var(--amber)" } : undefined}>{formatCurrency(cl.pending)}</div>
                </div>
              );
            })}
          </div>
        ) : <div className="empty-state">Cap client coincideix amb la cerca.</div>
      )}

      <datalist id="db-band-names">
        {bands.map((b) => <option key={b.id} value={b.name}></option>)}
      </datalist>
    </div>
  );
}
