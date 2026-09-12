"use client";

import { useState } from "react";
import { verifyShareLinkAccessCodeAction } from "@/app/(app)/concerts/share-actions";
import PublicShareForm from "@/components/PublicShareForm";
import type { PublicShareFormData } from "@/lib/public-share-data";

// Pantalla d'avís abans del formulari públic de regidor: cal el codi
// d'accés (generat des de Comparteix a la fitxa del concert) per veure'l —
// no es recorda entre visites, es torna a demanar cada cop que s'obre
// l'enllaç.
export default function ShareLinkGate({ token, codeExpired, agency }: { token: string; codeExpired: boolean; agency?: { name: string; logo: string } | null }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<PublicShareFormData | null>(null);

  async function submit() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError("");
    const res = await verifyShareLinkAccessCodeAction(token, code.trim());
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setData(res.data);
  }

  if (data) return <PublicShareForm token={token} {...data} />;

  return (
    <div className="pf-screen">
      <div className="pf-dead pf-gate">
        <div className="pf-gate-brand-row">
          <img className="brand-mark pf-gate-mark" src="/logo-mark.png" alt="" />
          <span className="brand-name pf-gate-name">ESCENARI</span>
          {agency?.logo && (
            <>
              <span className="page-header-sep">/</span>
              <img className="pf-gate-agency-logo" src={agency.logo} alt={agency.name} />
            </>
          )}
        </div>
        <div className="pf-dead-icon">🔒</div>
        <h1>Formulari privat</h1>
        <p>
          Aquest formulari és privat i queda prohibit reenviar-lo a gent de fora de l&apos;organització de l&apos;esdeveniment.
        </p>
        {codeExpired && (
          <p className="pf-gate-warn">El codi d&apos;accés ha caducat — demana&apos;n un de nou a qui t&apos;ha compartit l&apos;enllaç.</p>
        )}
        <form className="join-code-form pf-gate-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input
            className="field-input form-field" placeholder="Codi d'accés" value={code} maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus
          />
          <button type="submit" className="btn-save" disabled={busy || !code.trim()}>{busy ? "Comprovant…" : "Entra-hi"}</button>
        </form>
        {error && <p className="fin-neg pf-gate-error">{error}</p>}
      </div>
    </div>
  );
}
