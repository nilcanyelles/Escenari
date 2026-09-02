"use client";

import { useState } from "react";
import { PLANS, AGENCY_TIERS, type BillingInfo, type PlanKey } from "@/lib/plans";
import { createCheckoutSessionAction, createFounderCheckoutAction } from "@/app/(app)/billing-actions";

// Triar pla: Grup o una mida d'Agència, mensual o anual (2 mesos gratis).
// Envia a Stripe Checkout; en tornar, Configuració ho sincronitza.
export default function UpgradeModal({ billing, recommended, reason, onClose }: {
  billing: BillingInfo;
  recommended?: PlanKey;
  reason?: string;
  onClose: () => void;
}) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("yearly");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function go(plan: PlanKey) {
    setBusy(plan);
    setError("");
    const res = await createCheckoutSessionAction(plan, interval);
    if (res.url) { window.location.href = res.url; return; }
    setError(res.error || "No s'ha pogut obrir el pagament.");
    setBusy(null);
  }
  async function founder() {
    setBusy("founder");
    setError("");
    const res = await createFounderCheckoutAction();
    if (res.url) { window.location.href = res.url; return; }
    setError(res.error || "No s'ha pogut obrir el pagament.");
    setBusy(null);
  }

  const current = billing.plan !== "free" && ["active", "trialing", "past_due"].includes(billing.status) ? billing.plan : null;
  const tiers: PlanKey[] = ["grup", ...AGENCY_TIERS];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide up-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Tria el teu pla</div>
          <button className="cf-head-close" onClick={onClose}>✕</button>
        </div>
        {reason && <div className="sx-notice ok" style={{ marginBottom: 12 }}>{reason}</div>}
        {billing.trialActive && billing.trialEndsAt && (
          <div className="t-dim" style={{ fontSize: 12.5, marginBottom: 10 }}>
            Ara mateix ets en període de prova (tot inclòs) fins al {new Date(billing.trialEndsAt).toLocaleDateString("ca-ES")}.
          </div>
        )}
        <div className="up-interval">
          <div className="stats-tabs" style={{ padding: 3 }}>
            <button type="button" className={"stats-tab" + (interval === "monthly" ? " active" : "")} onClick={() => setInterval("monthly")}>Mensual</button>
            <button type="button" className={"stats-tab" + (interval === "yearly" ? " active" : "")} onClick={() => setInterval("yearly")}>Anual · 2 mesos gratis</button>
          </div>
        </div>
        <div className="up-grid">
          {tiers.map((key) => {
            const p = PLANS[key];
            const isCurrent = current === key;
            const isRec = recommended === key;
            const price = interval === "monthly" ? (p.launchMonthly ?? p.monthly) : p.yearly;
            return (
              <div key={key} className={"up-card" + (isRec ? " rec" : "") + (isCurrent ? " current" : "")}>
                <div className="up-name">{p.label}</div>
                <div className="up-price">
                  {price} €<small>{interval === "monthly" ? "/mes" : "/any"}</small>
                </div>
                {interval === "monthly" && p.launchMonthly && p.launchMonthly < p.monthly && (
                  <div className="up-launch"><s>{p.monthly} €</s> preu de llançament</div>
                )}
                <ul className="up-list">
                  <li>{p.groups == null ? "Grups il·limitats" : p.groups === 1 ? "1 grup" : `Fins a ${p.groups} grups`}</li>
                  <li>Contractes, factures i repartiment</li>
                  <li>Enllaços i PDFs sense límit</li>
                  {p.agency && <li>Membres de l&apos;agència i permisos</li>}
                  {p.subsBoard && <li>Borsa de suplents</li>}
                </ul>
                <button type="button" className={isRec ? "btn-save" : "btn-outline"} disabled={busy !== null || isCurrent} onClick={() => go(key)}>
                  {isCurrent ? "El teu pla" : busy === key ? "Obrint…" : "Tria"}
                </button>
              </div>
            );
          })}
        </div>
        {billing.founderAvailable && !billing.founder && (
          <div className="up-founder">
            <div>
              <div className="t-strong" style={{ fontSize: 13.5 }}>Membre fundador · 199 € un sol cop</div>
              <div className="t-dim" style={{ fontSize: 12.5 }}>Pla Grup de per vida, per als primers 50 grups.</div>
            </div>
            <button type="button" className="btn-outline" disabled={busy !== null} onClick={founder}>{busy === "founder" ? "Obrint…" : "Vull ser fundador"}</button>
          </div>
        )}
        {!billing.stripeConfigured && (
          <div className="t-dim" style={{ fontSize: 12.5, marginTop: 10 }}>Els pagaments encara no estan activats en aquest entorn.</div>
        )}
        {error && <div className="fin-neg" style={{ fontSize: 13, marginTop: 10 }}>{error}</div>}
        <div className="t-dim" style={{ fontSize: 11.5, marginTop: 12 }}>Preus sense IVA. Pots canviar de pla o cancel·lar quan vulguis des de Configuració.</div>
      </div>
    </div>
  );
}
