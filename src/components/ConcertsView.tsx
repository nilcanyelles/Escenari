"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Concert, Invoice, CompanyInfo } from "@/lib/types";
import { formatDate, statusColors } from "@/lib/format";
import { uniqueTags } from "@/lib/tags";
import { rsIsComplete } from "@/lib/route-sheet";
import { deleteConcertAction, saveConcertAction } from "@/app/(app)/concerts/actions";
import { generateInvoiceAction } from "@/app/(app)/facturacio/actions";
import ConcertModal from "@/components/ConcertModal";
import InvoicePreview from "@/components/InvoicePreview";
import RouteSheetModal from "@/components/RouteSheetModal";
import RouteSheetPreview from "@/components/RouteSheetPreview";

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

export default function ConcertsView({ bands, concerts, invoices, companyInfo, today }: { bands: Band[]; concerts: Concert[]; invoices: Invoice[]; companyInfo: CompanyInfo; today: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("tots");
  const [tagFilter, setTagFilter] = useState("tots");
  const [modal, setModal] = useState<{ concertId: string } | null>(null);
  const [draftConcert, setDraftConcert] = useState<Concert | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [rsModalConcertId, setRsModalConcertId] = useState<string | null>(null);
  const [rsPreviewConcertId, setRsPreviewConcertId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (modal?.concertId) {
      const el = rowRefs.current[modal.concertId];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [modal]);

  const searchL = search.toLowerCase();
  const list = concerts.filter((c) =>
    (statusFilter === "tots" || c.status === statusFilter) &&
    (tagFilter === "tots" || (c.tags && c.tags.indexOf(tagFilter) !== -1)) &&
    (!searchL || c.bandName.toLowerCase().includes(searchL) || c.venue.toLowerCase().includes(searchL) || c.city.toLowerCase().includes(searchL))
  );
  const upcomingList = list.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const pastList = list.filter((c) => c.date < today).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const tagOpts = uniqueTags(concerts);

  const invByConcert: Record<string, Invoice> = {};
  invoices.forEach((i) => { invByConcert[i.concertId] = i; });

  function ConcertRow({ c }: { c: Concert }) {
    const sc = statusColors(c.status);
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
    } else if (c.status === "confirmat") {
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
    return (
      <div ref={(el) => { rowRefs.current[c.id] = el; }} className={"t-row concerts-cols clickable" + (isSelected ? " selected" : "")} onClick={() => setModal({ concertId: c.id })}>
        <div className="t-dim">{formatDate(c.date)}</div>
        <div className="t-strong">{c.bandName}</div>
        <div className="t-dim">{c.city}</div>
        <div className="t-dim">{c.venue}</div>
        <div className="t-dim">{c.festaEntitat || "—"}</div>
        <div><span className="badge" style={{ background: sc.bg, color: sc.color }}>{c.status}</span></div>
        <div className="rs-btn-group"><RouteSheetBtns c={c} onEdit={() => setRsModalConcertId(c.id)} onPreview={() => setRsPreviewConcertId(c.id)} /></div>
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
    router.refresh();
    setDraftConcert(created);
    setModal({ concertId: created.id });
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="filter-bar concerts-filterbar">
        <input className="input search" type="text" placeholder="Cercar grup, sala, ciutat…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="tots">Tots els estats</option>
          <option value="confirmat">Confirmat</option>
          <option value="pendent">Pendent</option>
          <option value="cancel·lat">Cancel·lat</option>
        </select>
        <select className="input" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="tots">Totes les etiquetes</option>
          {tagOpts.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn-accent" onClick={handleNewConcert}>+ Nou concert</button>
      </div>

      {upcomingList.length === 0 && pastList.length === 0 ? (
        <div className="empty-state">Cap concert coincideix amb els filtres.</div>
      ) : (
        <div className="table-wrap no-clip">
          <div className="t-row t-head concerts-cols">
            <div>Data</div><div>Grup</div><div>Població</div><div>Ubicació</div><div>Festa/entitat</div><div>Estat</div>
            <div style={{ textAlign: "center" }}>FDR</div><div style={{ textAlign: "center" }}>Factura</div><div></div>
          </div>
          {upcomingList.map((c) => <ConcertRow key={c.id} c={c} />)}
          {pastList.length > 0 && (
            <div className="concerts-section-divider">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>Bolos realitzats ({pastList.length})</span>
            </div>
          )}
          {pastList.map((c) => <ConcertRow key={c.id} c={c} />)}
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
