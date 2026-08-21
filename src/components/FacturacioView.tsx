"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Concert, Invoice, CompanyInfo } from "@/lib/types";
import { formatCurrency, formatDate, statusColors } from "@/lib/format";
import { generateInvoiceAction, saveCompanyInfoAction } from "@/app/(app)/facturacio/actions";
import InvoicePreview from "@/components/InvoicePreview";

export default function FacturacioView({ concerts, invoices, companyInfo }: { concerts: Concert[]; invoices: Invoice[]; companyInfo: CompanyInfo }) {
  const router = useRouter();
  const [stateFilter, setStateFilter] = useState("tots");
  const [company, setCompany] = useState(companyInfo);
  const [companySaving, setCompanySaving] = useState(false);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genConcertId, setGenConcertId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);

  const list = invoices.filter((i) => stateFilter === "tots" || i.state === stateFilter)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const billedConcertIds: Record<string, boolean> = {};
  invoices.forEach((i) => { billedConcertIds[i.concertId] = true; });
  const unbilled = concerts.filter((c) => c.status === "confirmat" && !billedConcertIds[c.id]);
  const currentGenId = genConcertId || (unbilled[0] && unbilled[0].id) || "";
  const genConcert = concerts.find((c) => c.id === currentGenId) || null;

  async function saveCompany() {
    setCompanySaving(true);
    await saveCompanyInfoAction(company);
    router.refresh();
    setCompanySaving(false);
  }

  async function handleGenerate() {
    if (!currentGenId) return;
    setGenerating(true);
    await generateInvoiceAction(currentGenId);
    router.refresh();
    setGenerating(false);
    setGenModalOpen(false);
    setGenConcertId(null);
  }

  const previewInvoice = previewInvoiceId ? invoices.find((i) => i.id === previewInvoiceId) || null : null;
  const previewConcert = previewInvoice ? concerts.find((c) => c.id === previewInvoice.concertId) || null : null;

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="glow-blooms" aria-hidden="true"></div>
      <div className="card" style={{ padding: "12px 16px" }}>
        <div className="card-title">Dades de l&apos;empresa emissora</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 210 }}>
            <label className="form-label">Nom</label>
            <input className="field-input form-field compact-field" type="text" value={company.nom} onChange={(e) => setCompany((p) => ({ ...p, nom: e.target.value }))} onBlur={saveCompany} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: 150 }}>
            <label className="form-label">CIF</label>
            <input className="field-input form-field compact-field" type="text" value={company.cif} onChange={(e) => setCompany((p) => ({ ...p, cif: e.target.value }))} onBlur={saveCompany} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: 220 }}>
            <label className="form-label">Adreça</label>
            <input className="field-input form-field compact-field" type="text" value={company.address} onChange={(e) => setCompany((p) => ({ ...p, address: e.target.value }))} onBlur={saveCompany} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: 220 }}>
            <label className="form-label">Número de compte</label>
            <input className="field-input form-field compact-field" type="text" placeholder="ES00 0000 0000 0000 0000 0000" value={company.iban} onChange={(e) => setCompany((p) => ({ ...p, iban: e.target.value }))} onBlur={saveCompany} />
          </div>
        </div>
        {companySaving && <div className="t-dim" style={{ fontSize: 11, marginTop: 6 }}>Desant…</div>}
      </div>

      <div className="filter-bar">
        <select className="input" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="tots">Tots els estats</option>
          <option value="pagada">Pagada</option>
          <option value="pendent">Pendent</option>
          <option value="vençuda">Vençuda</option>
        </select>
        <div className="spacer"></div>
        <button className="glow-cta" onClick={() => setGenModalOpen(true)}>+ Generar factura</button>
      </div>

      {list.length ? (
        <div className="table-wrap scrollx">
          <div className="t-row t-head fact-cols"><div>Factura</div><div>Client / Sala</div><div>Data</div><div>Import</div><div>Estat</div><div></div></div>
          {list.map((inv) => {
            const sc = statusColors(inv.state);
            return (
              <div key={inv.id} className="t-row fact-cols">
                <div><button type="button" className="link-btn t-dim" style={{ fontSize: "inherit" }} title="Visualitza la factura" onClick={() => setPreviewInvoiceId(inv.id)}>{inv.id}</button></div>
                <div className="t-strong">{inv.client}</div>
                <div className="t-dim">{formatDate(inv.issueDate)}</div>
                <div>{formatCurrency(inv.amount)}</div>
                <div><span className="badge" style={{ background: sc.bg, color: sc.color }}>{inv.state}</span></div>
                <div style={{ textAlign: "center" }}>
                  <button type="button" className="row-rs-btn" title="Visualitza la factura" onClick={() => setPreviewInvoiceId(inv.id)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">Cap factura coincideix amb el filtre.</div>
      )}

      {genModalOpen && (
        <div className="modal-overlay" onClick={() => setGenModalOpen(false)}>
          <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Generar factura</div>
              <button className="modal-close" onClick={() => setGenModalOpen(false)}>✕</button>
            </div>
            {unbilled.length ? (
              <div className="modal-form">
                <div>
                  <label className="form-label">Concert sense facturar</label>
                  <select className="field-input form-field" value={currentGenId} onChange={(e) => setGenConcertId(e.target.value)}>
                    {unbilled.map((c) => (
                      <option key={c.id} value={c.id}>{c.bandName} — {formatDate(c.date)} ({c.venue})</option>
                    ))}
                  </select>
                </div>
                <div className="invoice-preview">
                  <span style={{ color: "var(--text-faint)" }}>Import (amb IVA)</span>
                  <span className="t-strong">{genConcert ? formatCurrency(Math.round(genConcert.amount * 1.21)) : "—"}</span>
                </div>
                <div className="modal-actions">
                  <div className="spacer"></div>
                  <button className="btn-outline" onClick={() => setGenModalOpen(false)}>Cancel·lar</button>
                  <button className="btn-save" disabled={generating} onClick={handleGenerate}>Generar</button>
                </div>
              </div>
            ) : (
              <div className="cal-empty" style={{ padding: "20px 0" }}>Tots els concerts confirmats ja tenen factura.</div>
            )}
          </div>
        </div>
      )}

      {previewInvoice && (
        <InvoicePreview invoice={previewInvoice} concert={previewConcert} companyInfo={company} onClose={() => setPreviewInvoiceId(null)} />
      )}
    </div>
  );
}
