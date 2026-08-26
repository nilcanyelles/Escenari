"use client";

import { useState } from "react";
import type { RiderContent } from "@/lib/material-types";
import { formatDateFull, capitalize } from "@/lib/format";
import { approveRiderPublicAction, submitCounterPublicAction } from "../actions";
import RiderStudio from "@/components/RiderStudio";
import SpecularButton from "@/components/SpecularButton";

export default function ApprovalView({ token, status, recipientName, counterNote, bandId, bandName, riderName, publicToken, concert, content }: {
  token: string;
  status: "pendent" | "contrarider" | "aprovat";
  recipientName: string;
  counterNote: string;
  bandId: string;
  bandName: string;
  riderName: string;
  publicToken: string;
  concert: { date: string; city: string; venue: string };
  content: RiderContent;
}) {
  const [mode, setMode] = useState<"landing" | "counter">("landing");
  const [currentStatus, setCurrentStatus] = useState(status);
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    setBusy(true);
    const res = await approveRiderPublicAction(token);
    if (res.ok) setCurrentStatus("aprovat");
    setBusy(false);
  }

  if (mode === "counter") {
    return (
      <RiderStudio
        bandId={bandId}
        bandName={bandName}
        riderId={null}
        initialName={riderName + " (contraproposta)"}
        initialContent={content}
        mode="counter"
        backHref={`/a/${token}`}
        counterNoteInit={counterNote}
        onSubmitCounter={async (c, note) => {
          await submitCounterPublicAction(token, c, note);
          setCurrentStatus("contrarider");
        }}
      />
    );
  }

  return (
    <div className="pf-screen">
      <div className="pf-container" style={{ maxWidth: 560 }}>
        <div className="pf-brand">ESCENARI</div>
        <div className="pf-hero">
          <div className="pf-hero-band">{bandName} · {riderName}</div>
          <div className="pf-hero-date">{capitalize(formatDateFull(concert.date))}</div>
          <p className="pf-hero-text">
            {concert.city ? concert.city + (concert.venue ? " · " + concert.venue : "") : concert.venue}
          </p>
        </div>

        {currentStatus === "aprovat" ? (
          <div className="pf-done">
            <div className="pf-done-icon">✓</div>
            <h2>Rider aprovat</h2>
            <p>Gràcies{recipientName ? `, ${recipientName}` : ""}! El grup ja veu la teva aprovació.</p>
            <a className="pf-btn-secondary" style={{ alignSelf: "center", textDecoration: "none" }} href={`/m/${publicToken}`} target="_blank" rel="noreferrer">
              Torna a veure el rider (PDF)
            </a>
          </div>
        ) : currentStatus === "contrarider" ? (
          <div className="pf-done">
            <div className="pf-done-icon" style={{ background: "oklch(0.78 0.15 80 / 0.18)", color: "oklch(0.82 0.15 80)" }}>✎</div>
            <h2>Contraproposta enviada</h2>
            <p>El grup revisarà els teus canvis. Pots seguir editant-la mentre no la responguin.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="pf-btn-secondary" onClick={() => setMode("counter")}>Segueix editant</button>
              <SpecularButton size="md" radius={12} tint="#5aa869" tintOpacity={0.3} baseColor="#4a8a58" lineColor="#c9f2d3" disabled={busy} onClick={handleApprove}>
                De fet, aprova l&apos;original
              </SpecularButton>
            </div>
          </div>
        ) : (
          <>
            <p className="pf-hero-text" style={{ textAlign: "center" }}>
              Hola{recipientName ? ` ${recipientName}` : ""}! 👋 El grup us envia el seu rider tècnic perquè el reviseu.
              Podeu aprovar-lo tal com està o proposar-hi canvis — el grup veurà la vostra versió i la podrà acceptar.
            </p>
            <a className="approval-doc-link" href={`/m/${publicToken}`} target="_blank" rel="noreferrer">
              📄 Obre el rider complet (PDF)
            </a>
            <div className="approval-actions">
              <SpecularButton size="lg" radius={14} tint="#5aa869" tintOpacity={0.35} baseColor="#4a8a58" lineColor="#c9f2d3" disabled={busy} onClick={handleApprove}>
                {busy ? "Un moment…" : "✓ Aprova el rider"}
              </SpecularButton>
              <SpecularButton size="lg" radius={14} tint="#e0913f" tintOpacity={0.3} baseColor="#c07a2e" lineColor="#ffe2bd" onClick={() => setMode("counter")}>
                ✎ Proposa canvis
              </SpecularButton>
            </div>
            <div className="pf-footer">Revisió de rider generada amb Escenari</div>
          </>
        )}
      </div>
    </div>
  );
}
