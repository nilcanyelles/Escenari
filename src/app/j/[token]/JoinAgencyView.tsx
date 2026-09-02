"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptAgencyInvitationAction } from "../actions";

// Últim pas per entrar a l'agència: confirmar nom i càrrec.
export default function JoinAgencyView({ token, workspaceName, workspaceLogo, invitedBy, defaultName, defaultRole }: {
  token: string;
  workspaceName: string;
  workspaceLogo: string;
  invitedBy: string;
  defaultName: string;
  defaultRole: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState(defaultRole || "Mànager");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    setBusy(true);
    setError("");
    const res = await acceptAgencyInvitationAction(token, { name, roleLabel: role });
    setBusy(false);
    if (!res.ok) { setError(res.error || "No s'ha pogut entrar a l'agència."); return; }
    router.push("/resum");
    router.refresh();
  }

  return (
    <div className="onboarding-form">
      <div className="join-head">
        {workspaceLogo && <img className="join-logo" src={workspaceLogo} alt="" />}
        <div>
          <div className="pf-brand" style={{ margin: 0 }}>ESCENARI</div>
          <h1 className="onboarding-title" style={{ marginTop: 6 }}>Uneix-te a {workspaceName || "l'agència"}</h1>
        </div>
      </div>
      <p className="onboarding-sub">{invitedBy ? `${invitedBy} t'hi ha convidat.` : "T'hi han convidat."} Confirma com vols aparèixer-hi.</p>
      <div className="field-group">
        <label className="field-label">El teu nom</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom i cognoms" autoFocus />
      </div>
      <div className="field-group">
        <label className="field-label">El teu càrrec</label>
        <input className="field-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Mànager, booking, producció…" />
      </div>
      <div className="onboarding-error">{error}</div>
      <button className="btn-primary" disabled={busy || !name.trim()} onClick={join}>{busy ? "Entrant…" : `Entra a ${workspaceName || "l'agència"}`}</button>
    </div>
  );
}
