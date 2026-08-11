"use client";

import type { Concert, Invoice, CompanyInfo } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";

export default function InvoicePreview({
  invoice, concert, companyInfo, onClose,
}: {
  invoice: Invoice;
  concert: Concert | null;
  companyInfo: CompanyInfo;
  onClose: () => void;
}) {
  const subtotal = concert ? concert.amount : Math.round(invoice.amount / 1.21);
  const vat = invoice.amount - subtotal;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide rs-doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rs-doc-top-toolbar">
          <div className="spacer"></div>
          <button type="button" className="rs-doc-icon-btn" title="Descarrega en PDF" onClick={() => window.print()}>
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></polyline>
              <text x="12" y="17.5" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="currentColor" stroke="none" fontFamily="Arial,sans-serif">PDF</text>
            </svg>
          </button>
          <button type="button" className="rs-doc-icon-btn" title="Tanca" onClick={onClose}>✕</button>
        </div>
        <div className="rs-doc-scroll">
          <div id="invoice-doc-print" className="rs-doc" style={{ fontFamily: "Inter,system-ui,sans-serif", color: "oklch(0.2 0.01 258)", background: "oklch(0.995 0.002 258)", padding: "0.75in 0.7in", display: "flex", flexDirection: "column" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 22, borderBottom: "2px solid oklch(0.2 0.01 258)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "oklch(0.55 0.19 290)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: "oklch(0.99 0.002 258)", flex: "none" }}>LB</div>
                <div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: "0.01em" }}>{(companyInfo.nom || "La Bona Party").toUpperCase()}</div>
                  {companyInfo.cif ? (
                    <div style={{ fontSize: 11, color: "oklch(0.45 0.01 258)", marginTop: 2 }}>CIF: {companyInfo.cif}</div>
                  ) : (
                    <div style={{ fontSize: 11, color: "oklch(0.45 0.01 258)", marginTop: 2 }}>Gestió d&apos;actuacions musicals</div>
                  )}
                  {companyInfo.address && <div style={{ fontSize: 11, color: "oklch(0.45 0.01 258)", marginTop: 2 }}>{companyInfo.address}</div>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: "0.04em", color: "oklch(0.55 0.19 290)" }}>FACTURA</div>
                <div style={{ fontSize: 12.5, marginTop: 6, fontWeight: 600 }}>{invoice.id}</div>
                <div style={{ fontSize: 11, color: "oklch(0.45 0.01 258)", marginTop: 2 }}>Emissió: {formatDate(invoice.issueDate)} · Venciment: {formatDate(invoice.dueDate)}</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 40, padding: "26px 0" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "oklch(0.5 0.01 258)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Facturar a</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{invoice.client}</div>
                {concert && <div style={{ fontSize: 12, color: "oklch(0.4 0.01 258)", marginTop: 3, lineHeight: 1.5 }}>{concert.city}</div>}
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid oklch(0.2 0.01 258)" }}>
                  <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 600, color: "oklch(0.5 0.01 258)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 0 10px" }}>Concepte</th>
                  <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 600, color: "oklch(0.5 0.01 258)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 0 10px" }}>Data</th>
                  <th style={{ textAlign: "right", fontSize: 10.5, fontWeight: 600, color: "oklch(0.5 0.01 258)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 0 10px" }}>Import</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "14px 0", fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>Actuació en directe</div>
                    {concert && <div style={{ fontSize: 11.5, color: "oklch(0.45 0.01 258)", marginTop: 2 }}>{invoice.bandName || concert.bandName} — {concert.venue}, {concert.time}h</div>}
                  </td>
                  <td style={{ padding: "14px 0", fontSize: 13, color: "oklch(0.4 0.01 258)", verticalAlign: "top" }}>{concert ? formatDate(concert.date) : formatDate(invoice.issueDate)}</td>
                  <td style={{ padding: "14px 0", fontSize: 13, textAlign: "right", verticalAlign: "top", fontWeight: 600 }}>{formatCurrency(subtotal)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "oklch(0.4 0.01 258)" }}><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "oklch(0.4 0.01 258)" }}><span>IVA (21%)</span><span>{formatCurrency(vat)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 700, borderTop: "1.5px solid oklch(0.2 0.01 258)", paddingTop: 10, marginTop: 2 }}><span>Total</span><span>{formatCurrency(invoice.amount)}</span></div>
              </div>
            </div>

            <div style={{ flex: 1 }}></div>

            <div style={{ borderTop: "1px solid oklch(0.88 0.005 258)", paddingTop: 16, display: "flex", justifyContent: "space-between", gap: 30 }}>
              <div style={{ fontSize: 11, color: "oklch(0.5 0.01 258)", lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, color: "oklch(0.3 0.01 258)", marginBottom: 3 }}>Dades de pagament</div>
                Referència: {invoice.id}
                {companyInfo.iban && <><br />Compte: {companyInfo.iban}</>}
              </div>
              <div style={{ fontSize: 11, color: "oklch(0.5 0.01 258)", textAlign: "right", lineHeight: 1.6 }}>
                Estat: {invoice.state}.<br />Gràcies per confiar en La Bona Party.
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
