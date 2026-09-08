"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InstrumentPicker from "@/components/InstrumentPicker";
import { applySubstituteLinkAction } from "@/app/s/actions";

// Formulari del suplent proposat: nom, instruments i un missatge, i
// "Presenta't". Si ja s'hi havia presentat, es mostra l'estat.
export default function SubstituteApplyView({ token, bandName, defaultName, defaultInstruments, hasProfile, existingStatus }: {
  token: string;
  bandName: string;
  defaultName: string;
  defaultInstruments: string[];
  hasProfile: boolean;
  existingStatus: "pendent" | "acceptada" | "rebutjada" | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [instruments, setInstruments] = useState<string[]>(defaultInstruments);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (existingStatus === "acceptada") {
    return <div className="cfm-done yes" style={{ marginTop: 16 }}>El gestor de {bandName} t&apos;ha acceptat com a suplent. 🎉 Ho veuràs a la teva agenda d&apos;Escenari.</div>;
  }
  if (existingStatus === "rebutjada") {
    return <p className="onboarding-sub" style={{ marginTop: 16 }}>Aquest cop el gestor ha triat una altra persona. Gràcies igualment!</p>;
  }
  if (done || existingStatus === "pendent") {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="cfm-done yes">Candidatura enviada ✓</div>
        <p className="onboarding-sub">El gestor de {bandName} la revisarà — quan la confirmi, el bolo t&apos;apareixerà a Escenari.</p>
        <button type="button" className="btn-outline" onClick={() => router.push("/artista")}>Ves a la teva agenda</button>
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    setError("");
    const res = await applySubstituteLinkAction(token, { name, instruments, message });
    setBusy(false);
    if (!res.ok) { setError(res.error || "No s'ha pogut enviar."); return; }
    setDone(true);
    router.refresh();
  }

  return (
    <div className="onboarding-form" style={{ marginTop: 16 }}>
      {!hasProfile && (
        <p className="onboarding-sub" style={{ margin: 0 }}>Un moment i ja està: com et dius i què toques. Amb això et creem el perfil de músic.</p>
      )}
      <div>
        <label className="form-label">Nom</label>
        <input className="field-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="El teu nom" />
      </div>
      <div>
        <label className="form-label">Instruments</label>
        <InstrumentPicker value={instruments} onChange={setInstruments} />
      </div>
      <div>
        <label className="form-label">Missatge per al gestor (opcional)</label>
        <input className="field-input" type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Disponible tot el dia, tinc el material…" />
      </div>
      <div className="onboarding-error">{error}</div>
      <button type="button" className="btn-primary" disabled={busy || !name.trim()} onClick={submit}>{busy ? "Enviant…" : "Presenta't com a suplent"}</button>
    </div>
  );
}
