"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Concert, Invoice, CompanyInfo } from "@/lib/types";
import { formatDate, statusColors } from "@/lib/format";
import { KIND_META } from "@/components/CalendariView";
import { uniqueTags } from "@/lib/tags";
import { normalize } from "@/lib/text";
import { rsCompletionPercent } from "@/lib/route-sheet";
import NewEventButton from "@/components/NewEventButton";
import { importConcertsAction } from "@/app/(app)/concerts/actions";
import { rsIsComplete } from "@/lib/route-sheet";
import { deleteConcertAction, saveConcertAction, setConcertStatusAction } from "@/app/(app)/concerts/actions";
import { generateInvoiceAction } from "@/app/(app)/facturacio/actions";
import ConcertModal from "@/components/ConcertModal";
import InvoicePreview from "@/components/InvoicePreview";
import RouteSheetModal from "@/components/RouteSheetModal";
import RouteSheetPreview from "@/components/RouteSheetPreview";

const STATUS_CYCLE = ["cancel·lat", "pendent", "reservat", "confirmat"];
function nextStatus(status: string): string {
  const i = STATUS_CYCLE.indexOf(status);
  return STATUS_CYCLE[(i === -1 ? 0 : i + 1) % STATUS_CYCLE.length];
}

export function DeleteConcertBtn({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="row-delete-btn"
      title="Eliminar concert"
      aria-label="Eliminar concert"
      onClick={async (e) => {
        e.stopPropagation();
        if (!confirm("Segur que vols eliminar aquest concert?")) return;
        await deleteConcertAction(id);
        router.refresh();
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  );
}

function RouteSheetBtns({ c, onEdit, onPreview }: { c: Concert; onEdit: () => void; onPreview: () => void }) {
  return (
    <>
      <button className="row-rs-btn" title="Edita el full de ruta" aria-label="Edita el full de ruta" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
      </button>
      <button className={"row-rs-btn" + (rsIsComplete(c) ? " rs-complete" : "")} title="Previsualitza el full de ruta" aria-label="Previsualitza el full de ruta" onClick={(e) => { e.stopPropagation(); onPreview(); }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
    </>
  );
}

export default function ConcertsView({ bands, concerts, invoices, companyInfo, selectedBandId = "", today }: { bands: Band[]; concerts: Concert[]; invoices: Invoice[]; companyInfo: CompanyInfo; selectedBandId?: string; today: string }) {
  const inBand = !!selectedBandId; // dins d'un grup, la columna Grup s'amaga
  const colsClass = "ccols" + (inBand ? " ccols-noband" : "");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("tots");
  const [tagFilter, setTagFilter] = useState("tots");
  const [modal, setModal] = useState<{ concertId: string } | null>(null);
  const [draftConcert, setDraftConcert] = useState<Concert | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const PAGE_SIZE = 50;
  const [upcomingVisible, setUpcomingVisible] = useState(PAGE_SIZE);
  const [pastVisible, setPastVisible] = useState(PAGE_SIZE);
  const [rsModalConcertId, setRsModalConcertId] = useState<string | null>(null);
  const [rsPreviewConcertId, setRsPreviewConcertId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const statusSaveTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    if (modal?.concertId) {
      const el = rowRefs.current[modal.concertId];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [modal]);

  useEffect(() => {
    setUpcomingVisible(PAGE_SIZE);
    setPastVisible(PAGE_SIZE);
  }, [search, statusFilter, tagFilter]);

  // Reconcile optimistic status overrides against the server-confirmed prop: only
  // drop an override once `concerts` (refreshed by router.refresh() after the write)
  // actually agrees with it. Clearing on a timer/guess instead of this causes a
  // visible flicker back to the stale value while the refresh is still in flight.
  useEffect(() => {
    setStatusOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        const serverConcert = concerts.find((c) => c.id === id);
        if (serverConcert && serverConcert.status === next[id]) { delete next[id]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [concerts]);

  // Cerca sense distingir accents ni majúscules (Sant Adrià = sant adria).
  const searchL = normalize(search);
  const list = concerts.filter((c) =>
    (statusFilter === "tots" || c.status === statusFilter) &&
    (tagFilter === "tots" || (c.tags && c.tags.indexOf(tagFilter) !== -1)) &&
    (!searchL || normalize(c.bandName).includes(searchL) || normalize(c.venue).includes(searchL) || normalize(c.city).includes(searchL) || normalize(c.festaEntitat || "").includes(searchL))
  );
  const upcomingList = list.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const pastList = list.filter((c) => c.date < today).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const tagOpts = uniqueTags(concerts);

  const invByConcert: Record<string, Invoice> = {};
  invoices.forEach((i) => { invByConcert[i.concertId] = i; });

  function ConcertRow({ c }: { c: Concert }) {
    const displayStatus = statusOverrides[c.id] ?? c.status;
    const sc = statusColors(displayStatus);
    const inv = invByConcert[c.id];
    let invoiceCell: React.ReactNode;
    if (inv) {
      const ic = statusColors(inv.state);
      invoiceCell = (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button type="button" className="row-rs-btn" style={{ color: ic.color }} title={"Visualitza la factura (" + inv.id + ")"} aria-label="Visualitza la factura"
            onClick={(e) => { e.stopPropagation(); setPreviewInvoiceId(inv.id); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
        </div>
      );
    } else if (displayStatus === "confirmat") {
      invoiceCell = (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button type="button" className="row-rs-btn" title="Genera factura" aria-label="Genera factura" disabled={generatingFor === c.id}
            onClick={async (e) => {
              e.stopPropagation();
              if (!confirm("Generar factura per aquest concert?")) return;
              setGeneratingFor(c.id);
              await generateInvoiceAction(c.id);
              router.refresh();
              setGeneratingFor(null);
            }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="13" x2="12" y2="17"></line><line x1="10" y1="15" x2="14" y2="15"></line></svg>
          </button>
        </div>
      );
    } else {
      invoiceCell = <span className="t-dim">—</span>;
    }

    const isSelected = modal?.concertId === c.id;
    // Recompte d'assistència dels membres del grup.
    const rowBand = bands.find((b) => b.id === c.bandId);
    const attTotal = rowBand?.members.length || 0;
    const attYes = rowBand ? rowBand.members.filter((m) => (c.attendance || {})[m.name] === "yes").length : 0;
    const rsPct = rsCompletionPercent(c);
    return (
      <div ref={(el) => { rowRefs.current[c.id] = el; }} className={"t-row " + colsClass + " clickable" + (isSelected ? " selected" : "")} onClick={() => router.push(`/concerts/${c.id}`)}>
        <div className="t-dim">{formatDate(c.date)}{c.time ? <span className="cc-time"> · {c.time}</span> : ""}</div>
        <div>
          {(() => {
            const k = c.kind && KIND_META[c.kind] ? c.kind : "bolo";
            return <span className="cc-kind" style={{ background: KIND_META[k].bg, color: KIND_META[k].color }}>{KIND_META[k].label}</span>;
          })()}
        </div>
        {!inBand && <div className="t-strong">{c.bandName}</div>}
        <div className="cc-bold">{c.city ? c.city.split(",")[0] : "—"}</div>
        <div className="cc-bold">{c.venue || "—"}</div>
        <div className="cc-bold">{c.festaEntitat || "—"}</div>
        <div style={{ textAlign: "center" }}>
          {attTotal > 0 ? (
            <span className={"att-badge" + (attYes === attTotal ? " full" : "")}
              title={`${attYes} de ${attTotal} membres han confirmat assistència`}>{attYes}/{attTotal}</span>
          ) : <span className="t-dim">—</span>}
        </div>
        <div>
          <button type="button" className="badge-btn" style={{ background: sc.bg, color: sc.color }}
            title="Canvia l'estat" aria-label="Canvia l'estat"
            onClick={(e) => {
              e.stopPropagation();
              const next = nextStatus(displayStatus);
              setStatusOverrides((prev) => ({ ...prev, [c.id]: next }));
              if (statusSaveTimers.current[c.id]) window.clearTimeout(statusSaveTimers.current[c.id]);
              statusSaveTimers.current[c.id] = window.setTimeout(async () => {
                await setConcertStatusAction(c.id, next);
                router.refresh();
              }, 400);
            }}>{displayStatus}</button>
        </div>
        <div className="cc-fdr">
          <span className="cc-fdr-pct" style={{ color: rsPct >= 100 ? "oklch(0.75 0.15 155)" : rsPct >= 50 ? "oklch(0.82 0.15 80)" : "var(--text-faint)" }}>{rsPct}%</span>
          <button className="row-rs-btn" title="Previsualitza el full de ruta" aria-label="Previsualitza el full de ruta" onClick={(e) => { e.stopPropagation(); setRsPreviewConcertId(c.id); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
        <div style={{ textAlign: "center" }}>{invoiceCell}</div>
        <div onClick={(e) => e.stopPropagation()}><DeleteConcertBtn id={c.id} /></div>
      </div>
    );
  }

  const editingConcert = modal
    ? concerts.find((c) => c.id === modal.concertId) || (draftConcert && draftConcert.id === modal.concertId ? draftConcert : null)
    : null;
  const isNewDraft = !!draftConcert && modal?.concertId === draftConcert.id;
  const previewInvoice = previewInvoiceId ? invoices.find((i) => i.id === previewInvoiceId) || null : null;
  const previewConcert = previewInvoice ? concerts.find((c) => c.id === previewInvoice.concertId) || null : null;
  const rsModalConcert = rsModalConcertId ? concerts.find((c) => c.id === rsModalConcertId) || null : null;
  const rsPreviewConcert = rsPreviewConcertId ? concerts.find((c) => c.id === rsPreviewConcertId) || null : null;

  const navigableList = [...upcomingList, ...pastList];
  const navigableIndex = editingConcert ? navigableList.findIndex((c) => c.id === editingConcert.id) : -1;
  function navigateConcert(dir: "prev" | "next") {
    if (navigableIndex === -1) return;
    const nextIndex = dir === "prev" ? navigableIndex - 1 : navigableIndex + 1;
    const target = navigableList[nextIndex];
    if (target) setModal({ concertId: target.id });
  }

  async function handleNewConcert() {
    const created = await saveConcertAction({
      id: null,
      bandName: "",
      date: today,
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
    router.push(`/concerts/${created.id}`);
  }

  async function discardDraftAndClose() {
    if (draftConcert) {
      await deleteConcertAction(draftConcert.id);
      router.refresh();
    }
    setModal(null);
    setDraftConcert(null);
  }

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glow-blooms" aria-hidden="true"></div>
      <div className="filter-bar concerts-filterbar">
        <input className="input search" type="text" placeholder="Cercar grup, sala, ciutat…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="tots">Tots els estats</option>
          <option value="confirmat">Confirmat</option>
          <option value="reservat">Reservat</option>
          <option value="pendent">Pendent</option>
          <option value="cancel·lat">Cancel·lat</option>
        </select>
        <select className="input" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="tots">Totes les etiquetes</option>
          {tagOpts.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn-outline" onClick={() => setImportOpen((v) => !v)}>Importa</button>
        <NewEventButton bands={bands} concerts={concerts} selectedBandId={selectedBandId} defaultDate={today} />
      </div>

      {importOpen && (
        <div className="import-box">
          <div className="t-dim" style={{ fontSize: 12 }}>
            Un concert per línia: <code>data; grup; població; ubicació; festa; import; estat</code> — data com a <code>2025-07-12</code> o <code>12/07/2025</code>; els grups que no existeixin es crearan.
          </div>
          <textarea className="field-input rider-textarea" rows={5} value={importText} onChange={(e) => setImportText(e.target.value)}
            placeholder={"12/07/2025; Arrels de Bosc; Reus; Plaça Mercadal; Festa Major; 1800; confirmat\n2025-08-02; Trencadansa; Olot; ; ; 1500"} />
          <button type="button" className="btn-save" style={{ alignSelf: "flex-start" }} disabled={importing}
            onClick={async () => {
              setImporting(true);
              const { imported, errors } = await importConcertsAction(importText);
              setImporting(false);
              setImportText("");
              setImportOpen(false);
              router.refresh();
              alert(`${imported} concerts importats${errors ? ` (${errors} línies amb error)` : ""}.`);
            }}>{importing ? "Important…" : "Importa"}</button>
        </div>
      )}

      {upcomingList.length === 0 && pastList.length === 0 ? (
        <div className="empty-state">Cap concert coincideix amb els filtres.</div>
      ) : (
        <div className="concerts-list">
          <div className={"t-row t-head " + colsClass}>
            <div>Data</div><div>Tipus</div>{!inBand && <div>Grup</div>}<div>Població</div><div>Ubicació</div><div>Festa/entitat</div>
            <div style={{ textAlign: "center" }}>Membres</div><div>Estat</div>
            <div style={{ textAlign: "center" }}>FDR</div><div style={{ textAlign: "center" }}>Factura</div><div></div>
          </div>
          <div className="table-wrap no-clip">
            {upcomingList.slice(0, upcomingVisible).map((c) => <ConcertRow key={c.id} c={c} />)}
          </div>
          {upcomingVisible < upcomingList.length && (
            <button type="button" className="load-more-btn" onClick={() => setUpcomingVisible((v) => v + PAGE_SIZE)}>
              Mostra {Math.min(PAGE_SIZE, upcomingList.length - upcomingVisible)} més ({upcomingList.length - upcomingVisible} restants)
            </button>
          )}
          {pastList.length > 0 && (
            <>
              <div className="concerts-section-divider">
                <span>Bolos realitzats</span>
                <span className="concerts-section-divider-count">{pastList.length}</span>
              </div>
              <div className="table-wrap no-clip">
                {pastList.slice(0, pastVisible).map((c) => <ConcertRow key={c.id} c={c} />)}
              </div>
            </>
          )}
          {pastVisible < pastList.length && (
            <button type="button" className="load-more-btn" onClick={() => setPastVisible((v) => v + PAGE_SIZE)}>
              Mostra {Math.min(PAGE_SIZE, pastList.length - pastVisible)} més ({pastList.length - pastVisible} restants)
            </button>
          )}
        </div>
      )}

      {modal && (
        <ConcertModal
          key={"edit:" + modal.concertId}
          mode="edit"
          concert={editingConcert}
          bands={bands}
          isDraft={isNewDraft}
          startInEditMode={isNewDraft}
          onDiscardDraft={discardDraftAndClose}
          onClose={() => { setModal(null); setDraftConcert(null); }}
          onOpenRouteSheetPreview={editingConcert ? () => { setModal(null); setDraftConcert(null); setRsPreviewConcertId(editingConcert.id); } : undefined}
          onNavigate={navigateConcert}
          hasPrev={navigableIndex > 0}
          hasNext={navigableIndex !== -1 && navigableIndex < navigableList.length - 1}
        />
      )}

      {previewInvoice && (
        <InvoicePreview invoice={previewInvoice} concert={previewConcert} companyInfo={companyInfo} onClose={() => setPreviewInvoiceId(null)} />
      )}

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
