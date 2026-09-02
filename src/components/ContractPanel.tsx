"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Concert, CompanyInfo, ContractData } from "@/lib/types";
import { emptyContract, defaultContractClauses, type ContractClient } from "@/lib/contract";
import { today } from "@/lib/format";
import ContractDoc from "@/components/ContractDoc";
import { saveContractAction, ensureContractTokenAction, sendContractEmailAction } from "@/app/(app)/concerts/contract-actions";

// Contracte del concert dins la pestanya de facturació: text editable (amb
// les dades del concert ja posades), vista prèvia/PDF i enviament per
// enllaç, WhatsApp o correu.
export default function ContractPanel({ concert, companyInfo, client, emailReady }: {
  concert: Concert;
  companyInfo: CompanyInfo;
  client: ContractClient;
  emailReady: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<ContractData>(() => concert.contract || emptyContract(concert, companyInfo));
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [url, setUrl] = useState<string>(concert.contractToken && typeof window !== "undefined" ? `${window.location.origin}/ct/${concert.contractToken}` : "");
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const first = useRef(true);
  const timer = useRef<number | null>(null);

  // Desat automàtic amb un petit marge.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaving(true);
      await saveContractAction(concert.id, data);
      setSaving(false);
    }, 800);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function getUrl(): Promise<string> {
    if (url) return url;
    if (timer.current) { window.clearTimeout(timer.current); await saveContractAction(concert.id, data); }
    const res = await ensureContractTokenAction(concert.id);
    setUrl(res.url);
    router.refresh();
    return res.url;
  }

  const missing: string[] = [];
  if (!client.nom && !client.name) missing.push("raó social del client");
  if (!client.cif) missing.push("CIF del client");
  if (!companyInfo.nom) missing.push("nom de l'agència (Facturació → dades de l'empresa)");
  if (!concert.venue || !concert.city) missing.push("lloc del concert");
  if (!concert.amount) missing.push("import");

  return (
    <div className="ct-panel">
      <div className="t-dim" style={{ fontSize: 13, lineHeight: 1.5 }}>
        El contracte agafa sol les dades del concert (grup, data, lloc, caixet i IVA) i del client. Retoca el text si cal; cada paràgraf és una clàusula.
        {missing.length > 0 && <span style={{ color: "var(--amber)" }}> Falta: {missing.join(", ")}.</span>}
      </div>

      <div className="ct-grid">
        <div>
          <label className="form-label">Qui signa per l&apos;artista</label>
          <input className="field-input form-field" value={data.signerName} placeholder="Nom i cognoms" onChange={(e) => setData({ ...data, signerName: e.target.value })} />
        </div>
        <div>
          <label className="form-label">En qualitat de</label>
          <input className="field-input form-field" value={data.signerRole} placeholder="Representant de l'artista" onChange={(e) => setData({ ...data, signerRole: e.target.value })} />
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <label className="form-label">Clàusules</label>
          <button type="button" className="link-btn" onClick={() => setData({ ...data, clauses: defaultContractClauses(concert, companyInfo) })}>Torna al text de sèrie (amb les dades d&apos;ara)</button>
          <span className="t-dim" style={{ fontSize: 11.5, marginLeft: "auto" }}>{saving ? "Desant…" : "Desat ✓"}</span>
        </div>
        <textarea className="field-input rider-textarea ct-textarea" rows={12} value={data.clauses} onChange={(e) => setData({ ...data, clauses: e.target.value })} />
      </div>
      <div>
        <label className="form-label">Condicions particulars (opcional)</label>
        <textarea className="field-input rider-textarea" rows={3} placeholder="Bestreta, horaris especials, transport, allotjament…" value={data.extra} onChange={(e) => setData({ ...data, extra: e.target.value })} />
      </div>

      <div className="ct-actions">
        <button type="button" className="btn-save" onClick={() => setPreviewOpen(true)}>Previsualitza / PDF</button>
        <button type="button" className="btn-outline" onClick={async () => { const u = await getUrl(); await navigator.clipboard.writeText(u); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }}>
          {copied ? "Enllaç copiat ✓" : "Copia l'enllaç"}
        </button>
        <button type="button" className="btn-outline cd-wa-btn" onClick={async () => { const u = await getUrl(); window.open(`https://wa.me/?text=${encodeURIComponent(`Contracte d'actuació de ${concert.bandName} (${concert.date}): ${u}`)}`, "_blank"); }}>WhatsApp</button>
        <div className="ct-email">
          <input className="field-input compact-field" type="email" placeholder="correu del client…" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="button" className="btn-outline" disabled={!emailReady || !email || emailStatus === "enviant…"}
            title={emailReady ? "Envia l'enllaç del contracte per correu" : "Configura RESEND_API_KEY per enviar correus"}
            onClick={async () => {
              setEmailStatus("enviant…");
              const res = await sendContractEmailAction(concert.id, email);
              setEmailStatus(res.ok ? "enviat ✓" : res.error || "error");
            }}>{emailStatus || "Envia per correu"}</button>
        </div>
      </div>

      {previewOpen && (
        <div className="modal-overlay" onClick={() => setPreviewOpen(false)}>
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
              <button type="button" className="rs-doc-icon-btn" title="Tanca" onClick={() => setPreviewOpen(false)}>✕</button>
            </div>
            <div className="rs-doc-scroll">
              <ContractDoc concert={concert} contract={data} companyInfo={companyInfo} client={client} generatedOn={today()} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
