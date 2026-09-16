"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinByCodeAction, previewBandByCodeAction, type PreviewPerson } from "../actions";
import InstrumentPicker from "@/components/InstrumentPicker";
import CrewRolePicker from "@/components/CrewRolePicker";
import { personPhotoDataUri, splitInstruments } from "@/lib/tags";

// Unir-se a un grup amb el codi: en clicar "Uneix-m'hi" s'obre una pestanya
// emergent on es tria músic o crew, qui ets (si el gestor ja t'havia creat
// a mà en aquest grup, reclamant aquell perfil en comptes de crear-ne un de
// nou) i què hi tocaràs — o quina funció hi faràs, si és com a crew.
export default function JoinByCode({ defaultInstruments = [] }: { defaultInstruments?: string[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const [modal, setModal] = useState<{ bandName: string; people: PreviewPerson[] } | null>(null);
  const [asCrew, setAsCrew] = useState(false);
  const [instruments, setInstruments] = useState<string[]>(defaultInstruments);
  const [role, setRole] = useState("");
  const [claimName, setClaimName] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Clicar "Uneix-m'hi": es mira si el codi és vàlid i, si ho és, s'obre la
  // pestanya emergent perquè s'hi triï qui ets abans d'unir-s'hi de veritat.
  function handleJoinClick() {
    if (pending || !code.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const cleaned = code.trim().toUpperCase();
      const preview = await previewBandByCodeAction(cleaned);
      if (!preview) {
        setMessage({ text: "No hi ha cap grup amb aquest codi.", ok: false });
        return;
      }
      setClaimName(null);
      setModal(preview);
    });
  }

  function doJoin() {
    if (joining) return;
    setJoining(true);
    startTransition(async () => {
      const result = await joinByCodeAction(code, asCrew, asCrew ? { role } : { instruments }, claimName || undefined);
      setJoining(false);
      if (!result.ok) {
        setMessage({ text: result.error, ok: false });
        return;
      }
      setMessage({ text: `Ja formes part de ${result.bandName}!`, ok: true });
      setCode("");
      setModal(null);
      router.refresh();
    });
  }

  function pickPerson(p: PreviewPerson) {
    if (p.claimed) return;
    // Clicar el que ja estava triat el destria (torna als propis instruments
    // o funció, com "Cap d'aquests, sóc nou").
    if (claimName === p.name) {
      setClaimName(null);
      setInstruments(defaultInstruments);
      setRole("");
      return;
    }
    setClaimName(p.name);
    if (p.kind === "member") setInstruments(p.instruments);
    else setRole(p.role);
  }

  const roster = modal?.people.filter((p) => p.kind === (asCrew ? "crew" : "member")) || [];

  return (
    <div className="join-form">
      <div className="join-code-form">
        <input
          className="field-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") handleJoinClick(); }}
          placeholder="ABC123"
          maxLength={6}
        />
        <button className="btn-primary" style={{ whiteSpace: "nowrap" }} type="button" disabled={pending} onClick={handleJoinClick}>
          {pending ? "..." : "Uneix-m'hi"}
        </button>
      </div>
      {message && (
        <div style={{ marginTop: 8, fontSize: 13, color: message.ok ? "oklch(0.78 0.15 155)" : "var(--red)" }}>
          {message.text}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => { if (!joining) setModal(null); }}>
          <div className="modal join-claim-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Uneix-te a {modal.bandName}</div>
              <button className="cf-head-close" onClick={() => setModal(null)} disabled={joining}>✕</button>
            </div>
            <div className="modal-form" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="stats-tabs" style={{ alignSelf: "flex-start" }}>
                <button type="button" className={"stats-tab" + (!asCrew ? " active" : "")} onClick={() => { setAsCrew(false); setClaimName(null); }}>Músic</button>
                <button type="button" className={"stats-tab" + (asCrew ? " active" : "")} onClick={() => { setAsCrew(true); setClaimName(null); }}>Crew</button>
              </div>

              {roster.length > 0 && (
                <div>
                  <label className="form-label">Ets algun d&apos;aquests?</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                    {roster.map((p) => {
                      const sub = p.kind === "member" ? p.instruments.join(", ") : p.role;
                      return (
                        <button key={p.name} type="button" className={"join-claim-row" + (claimName === p.name ? " active" : "")}
                          disabled={p.claimed} onClick={() => pickPerson(p)}
                          title={p.claimed ? undefined : claimName === p.name ? "Clica per destriar" : `Sóc ${p.name}`}>
                          <img src={personPhotoDataUri(p.name)} alt="" className="join-claim-photo" />
                          <span className="join-claim-names">
                            <span className="join-claim-name">{p.name}</span>
                            {sub && <span className="join-claim-sub">{sub}</span>}
                          </span>
                          <span className="join-claim-status">{p.claimed ? "Ja vinculat" : claimName === p.name ? "✓ Sóc jo" : "Sóc jo"}</span>
                        </button>
                      );
                    })}
                  </div>
                  {claimName !== null && (
                    <button type="button" className="join-claim-clear" onClick={() => { setClaimName(null); setInstruments(defaultInstruments); setRole(""); }}>Cap d&apos;aquests, sóc nou</button>
                  )}
                </div>
              )}

              <div>
                {asCrew ? (
                  <>
                    <label className="form-label">Quina funció hi faràs?</label>
                    <CrewRolePicker value={splitInstruments(role)} onChange={(next) => setRole(next.join(", "))} />
                  </>
                ) : (
                  <>
                    <label className="form-label">Què hi toques, en aquest grup?</label>
                    <InstrumentPicker value={instruments} onChange={setInstruments} />
                  </>
                )}
              </div>

              <button type="button" className="btn-primary" style={{ width: "100%", boxSizing: "border-box" }} disabled={joining} onClick={doJoin}>
                {joining ? "Unint-te…" : "Uneix-m'hi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
