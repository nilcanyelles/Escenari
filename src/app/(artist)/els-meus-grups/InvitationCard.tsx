"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondInvitationAction } from "../actions";

export default function InvitationCard({
  id,
  bandName,
  managerName,
  logo,
}: {
  id: string;
  bandName: string;
  managerName: string;
  logo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function respond(accept: boolean) {
    if (pending) return;
    startTransition(async () => {
      const result = await respondInvitationAction(id, accept);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="invite-card">
      <img className="artist-band-logo" style={{ border: "none", width: 44, height: 44 }} src={logo} alt="" />
      <div className="invite-card-main">
        <div className="invite-card-title">{bandName}</div>
        <div className="invite-card-sub">
          {managerName ? `${managerName} t'ha convidat a unir-te al grup.` : "T'han convidat a unir-te al grup."}
        </div>
        {error && <div className="invite-card-sub" style={{ color: "var(--red)" }}>{error}</div>}
      </div>
      <div className="attendance-btns">
        <button className="attendance-btn yes active" type="button" disabled={pending} onClick={() => respond(true)}>
          Accepta
        </button>
        <button className="attendance-btn" type="button" disabled={pending} onClick={() => respond(false)}>
          Rebutja
        </button>
      </div>
    </div>
  );
}
