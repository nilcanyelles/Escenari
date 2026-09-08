"use client";

import { useState } from "react";
import type { Concert } from "@/lib/types";
import { formatDate, formatDateFull, capitalize } from "@/lib/format";
import { KIND_META } from "@/components/CalendariView";
import { createAttendanceLinkAction, type AttendanceLinkConcert } from "@/app/conf/actions";

export type AttendanceLinkIntent = "wa" | "copy" | "open";
const INTENT_LABEL: Record<AttendanceLinkIntent, string> = { wa: "Envia per WhatsApp", copy: "Copia l'enllaç", open: "Obre l'enllaç" };

function concertSub(c: { kind: string; festaEntitat: string; city: string; venue: string }): string {
  const kind = c.kind && c.kind !== "bolo" ? KIND_META[c.kind]?.label : "";
  return [kind, c.festaEntitat, c.city ? c.city.split(",")[0] : c.venue].filter(Boolean).join(" · ");
}

// Pregunta prèvia a generar l'enllaç de confirmació d'assistència: només
// aquest concert, o aquest i altres de propers del grup (fins i tot "tots
// els propers", que inclou els que s'afegeixin després). Només surt quan el
// grup té més concerts propers a part d'aquest — si no, l'enllaç es crea
// directament (vegeu startAtt a ConcertDetailView).
export default function AttendanceLinkModal({ concert, others, intent, onClose, onDone }: {
  concert: Concert;
  // Altres concerts propers del grup (sense aquest), ordenats per data.
  others: AttendanceLinkConcert[];
  intent: AttendanceLinkIntent;
  onClose: () => void;
  onDone: (token: string, multi: boolean) => void;
}) {
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [allFuture, setAllFuture] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const multi = mode === "multi" && (allFuture || picked.size > 0);

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { token } = await createAttendanceLinkAction(concert.id, multi ? { concertIds: Array.from(picked), allFuture } : undefined);
      onDone(token, multi);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No s'ha pogut crear l'enllaç.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Comparteix per confirmar</div>
          <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <div className="t-dim" style={{ fontSize: 13 }}>Per a quins concerts vols demanar confirmació d&apos;assistència?</div>
          <div className="atl-options">
            <button type="button" className={"cd-scope-card" + (mode === "single" ? " active" : "")} onClick={() => setMode("single")}>
              <div className="cd-scope-title">Només aquest</div>
              <div className="cd-scope-desc">{capitalize(formatDateFull(concert.date))}</div>
            </button>
            <button type="button" className={"cd-scope-card" + (mode === "multi" ? " active" : "")} onClick={() => setMode("multi")}>
              <div className="cd-scope-title">Aquest i més</div>
              <div className="cd-scope-desc">{others.length} {others.length === 1 ? "altre concert proper" : "altres concerts propers"} del grup</div>
            </button>
          </div>

          {mode === "multi" && (
            <>
              <label className="atl-all">
                <input type="checkbox" checked={allFuture} onChange={(e) => setAllFuture(e.target.checked)} />
                <span>
                  <strong>Tots els propers concerts</strong>
                  <span className="atl-all-sub">També els que s&apos;afegeixin més endavant — un sol enllaç per al grup.</span>
                </span>
              </label>
              <div className="atl-list">
                <div className="atl-item disabled">
                  <input type="checkbox" checked disabled readOnly />
                  <span className="atl-item-date">{formatDate(concert.date)}</span>
                  <span className="atl-item-sub">{concertSub({ kind: concert.kind || "bolo", festaEntitat: concert.festaEntitat, city: concert.city, venue: concert.venue })} · aquest</span>
                </div>
                {others.map((o) => (
                  <label key={o.id} className={"atl-item" + (allFuture ? " disabled" : "")}>
                    <input type="checkbox" checked={allFuture || picked.has(o.id)} disabled={allFuture} onChange={() => togglePick(o.id)} />
                    <span className="atl-item-date">{formatDate(o.date)}</span>
                    <span className="atl-item-sub">{concertSub(o)}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {error && <div className="pf-error">{error}</div>}
          <div className="atl-actions">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel·la</button>
            <button type="button" className="btn-save" disabled={busy || (mode === "multi" && !multi)} onClick={create}>
              {busy ? "Creant…" : INTENT_LABEL[intent]}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
