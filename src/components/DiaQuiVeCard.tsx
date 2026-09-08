"use client";

import { useRef, useState } from "react";
import type { Concert, Band } from "@/lib/types";
import { setConvocatoriaAction } from "@/app/(app)/concerts/actions";
import { normalize } from "@/lib/text";
import VerifiedTick from "@/components/VerifiedTick";

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
  );
}

// "Qui ve" de la vista del dia de bolo. De sèrie només mostra qui hi va
// (bombolles de lectura, com sempre); amb "editable" (només el gestor —
// mai a la pàgina pública /conf/[token]) hi apareix un llapis al costat
// del títol que obre una edició ràpida d'assistència i substituts, sense
// haver d'anar a la pestanya "Convocatòria" de la fitxa completa.
// "linkedNames": qui té compte d'Escenari vinculat (tick lila al costat del nom).
export default function DiaQuiVeCard({ concert, band, editable = false, linkedNames = [] }: { concert: Concert; band: Band | null; editable?: boolean; linkedNames?: string[] }) {
  const linkedSet = new Set(linkedNames.map(normalize));
  const [editing, setEditing] = useState(false);
  const [attendance, setAttendanceState] = useState<Record<string, string>>({ ...(concert.attendance || {}) });
  const [substitutes, setSubstitutesState] = useState<Record<string, string>>({ ...(concert.substitutes || {}) });
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const people = [...(band?.members || []), ...(band?.crew || [])];
  const backups = band?.backups || [];

  function persist(att: Record<string, string>, subs: Record<string, string>, debounce: boolean) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const run = async () => {
      setSaving(true);
      await setConvocatoriaAction(concert.id, att as Record<string, "yes" | "no">, subs);
      setSaving(false);
    };
    if (debounce) saveTimer.current = window.setTimeout(run, 600);
    else run();
  }

  function setAtt(name: string, val: "yes" | "no" | null) {
    const nextAtt = { ...attendance };
    if (val) nextAtt[name] = val; else delete nextAtt[name];
    // Si deixa de ser "no", el substitut que hi hagués ja no pinta res.
    const nextSubs = val === "no" ? substitutes : (() => { const s = { ...substitutes }; delete s[name]; return s; })();
    setAttendanceState(nextAtt);
    if (nextSubs !== substitutes) setSubstitutesState(nextSubs);
    persist(nextAtt, nextSubs, false);
  }
  function setSub(name: string, val: string) {
    const next = { ...substitutes };
    if (val) next[name] = val; else delete next[name];
    setSubstitutesState(next);
    persist(attendance, next, true);
  }

  return (
    <div className="dia-card">
      <div className="dia-card-title-row">
        <div className="dia-card-title">Qui ve</div>
        {editable && (
          <button type="button" className="dia-edit-btn" title={editing ? "Tanca l'edició" : "Edita l'assistència"} onClick={() => setEditing((v) => !v)}>
            <EditIcon />
          </button>
        )}
      </div>
      {editing ? (
        <div className="dia-quive-edit">
          <datalist id="dia-backups-list">
            {backups.map((b) => <option key={b.name} value={b.name} />)}
          </datalist>
          {people.length === 0 && <span className="t-dim" style={{ fontSize: 13 }}>Sense formació assignada.</span>}
          {people.map((p) => {
            const a = attendance[p.name];
            return (
              <div key={p.name} className="dia-quive-edit-row">
                <span className="dia-quive-edit-name">{p.name}{linkedSet.has(normalize(p.name)) && <VerifiedTick size={11} />}</span>
                <div className="cd-att-controls">
                  <button type="button" className={"cd-att-btn yes" + (a === "yes" ? " active" : "")} onClick={() => setAtt(p.name, a === "yes" ? null : "yes")}>Sí</button>
                  <button type="button" className={"cd-att-btn no" + (a === "no" ? " active" : "")} onClick={() => setAtt(p.name, a === "no" ? null : "no")}>No</button>
                </div>
                {a === "no" && (
                  <input className="field-input compact-field" type="text" list="dia-backups-list" placeholder="Nom del suplent…"
                    value={substitutes[p.name] || ""} onChange={(e) => setSub(p.name, e.target.value)} />
                )}
              </div>
            );
          })}
          {saving && <span className="t-dim" style={{ fontSize: 11 }}>Desant…</span>}
        </div>
      ) : (
        <div className="dia-members">
          {people.map((p) => {
            const a = attendance[p.name];
            const sub = substitutes[p.name];
            return a === "no" && sub ? (
              <span key={p.name} className="dia-member-group">
                <span className="dia-member no" style={{ textDecoration: "line-through" }}>✕ {p.name}{linkedSet.has(normalize(p.name)) && <VerifiedTick size={11} />}</span>
                <span className="dia-member sub">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 16-4 4-4-4"></path><path d="M17 20V4"></path><path d="m3 8 4-4 4 4"></path><path d="M7 4v16"></path></svg>
                  {sub}
                </span>
              </span>
            ) : (
              <span key={p.name} className={"dia-member" + (a === "yes" ? " yes" : a === "no" ? " no" : "")}>
                {a === "yes" ? "✓ " : a === "no" ? "✕ " : "? "}{p.name}{linkedSet.has(normalize(p.name)) && <VerifiedTick size={11} />}
              </span>
            );
          })}
          {people.length === 0 && <span className="t-dim" style={{ fontSize: 13 }}>Sense formació assignada.</span>}
        </div>
      )}
    </div>
  );
}
