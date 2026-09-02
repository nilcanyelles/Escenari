"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimBandInvitationAction } from "@/app/(artist)/actions";

// Botó per reclamar el perfil del grup des de l'enllaç d'invitació.
export default function ClaimBandView({ token, bandName, logo, memberName, asCrew, roleLabel, used }: {
  token: string;
  bandName: string;
  logo: string;
  memberName: string;
  asCrew: boolean;
  roleLabel: string;
  used: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function claim() {
    setBusy(true);
    setError("");
    const res = await claimBandInvitationAction(token);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    router.push("/els-meus-grups");
    router.refresh();
  }

  return (
    <div className="onboarding-form">
      <div className="join-head">
        <img className="join-logo" src={logo} alt="" />
        <div>
          <div className="pf-brand" style={{ margin: 0 }}>ESCENARI</div>
          <h1 className="onboarding-title" style={{ marginTop: 6 }}>{bandName}</h1>
        </div>
      </div>
      {used ? (
        <>
          <p className="onboarding-sub">Aquesta invitació ja s&apos;ha fet servir.</p>
          <button className="btn-outline" onClick={() => router.push("/els-meus-grups")}>Els meus grups</button>
        </>
      ) : (
        <>
          <p className="onboarding-sub">
            {memberName ? `Reclama el perfil de "${memberName}"` : "Uneix-te al grup"}{asCrew ? ` a l'equip tècnic${roleLabel ? ` (${roleLabel})` : ""}` : ""}:
            quedaràs vinculat/da al grup amb el mateix historial de bolos i assistència.
          </p>
          <div className="onboarding-error">{error}</div>
          <button className="btn-primary" disabled={busy} onClick={claim}>{busy ? "Un moment…" : memberName ? `Soc ${memberName}: reclama el perfil` : `Uneix-te a ${bandName}`}</button>
        </>
      )}
    </div>
  );
}
