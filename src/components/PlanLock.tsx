"use client";

import { useState } from "react";
import { PLANS, planForFeature, type BillingInfo, type Feature, type PlanKey } from "@/lib/plans";
import UpgradeModal from "@/components/UpgradeModal";

// Bloqueig d'una funció que el pla no inclou: explica què és i obre el
// selector de plans. `compact` és només el botó (per a barres d'acció).
export default function PlanLock({ billing, feature, required, title, description, compact, canUpgrade = true }: {
  billing: BillingInfo;
  feature?: Feature;
  required?: PlanKey;
  title: string;
  description?: string;
  compact?: boolean;
  canUpgrade?: boolean; // només qui mana a l'agència pot contractar
}) {
  const [open, setOpen] = useState(false);
  const plan = required || (feature ? planForFeature(feature) : "grup");
  const label = PLANS[plan].label;
  const button = (
    <button type="button" className="btn-save plan-lock-btn" onClick={() => setOpen(true)} title={canUpgrade ? `Passa al pla ${label}` : "Demana-ho a qui mana a l'agència"}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
      {compact ? `Pla ${label}` : `Passa a ${label}`}
    </button>
  );
  return (
    <>
      {compact ? button : (
        <div className="plan-lock">
          <div className="plan-lock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-strong" style={{ fontSize: 14 }}>{title}</div>
            {description && <div className="t-dim" style={{ fontSize: 12.5, marginTop: 2 }}>{description}</div>}
            {!canUpgrade && <div className="t-dim" style={{ fontSize: 12, marginTop: 4 }}>Només qui mana a l&apos;agència pot contractar el pla.</div>}
          </div>
          {canUpgrade && button}
        </div>
      )}
      {open && <UpgradeModal billing={billing} recommended={plan} reason={title} onClose={() => setOpen(false)} />}
    </>
  );
}
