"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PracticeGoal, PracticeEntry } from "@/lib/practice";
import { addDays, formatDate } from "@/lib/format";
import { addPracticeGoalAction, deletePracticeGoalAction, logPracticeAction, deletePracticeEntryAction } from "../practice-actions";

function fmtMin(min: number): string {
  if (min >= 60) return Math.floor(min / 60) + "h " + String(min % 60).padStart(2, "0") + "'";
  return min + "'";
}

// Registre de pràctica personal: objectius, temps dedicat i progrés setmanal.
export default function PracticeView({ goals, entries, today }: { goals: PracticeGoal[]; entries: PracticeEntry[]; today: string }) {
  const router = useRouter();
  const [newGoal, setNewGoal] = useState("");
  const [log, setLog] = useState({ goalId: "", date: today, minutes: "30", notes: "" });
  const [saving, setSaving] = useState(false);

  const goalById: Record<string, string> = {};
  goals.forEach((g) => { goalById[g.id] = g.name; });

  const weekStart = addDays(today, -6);
  const monthStart = today.slice(0, 7) + "-01";
  const weekMin = entries.filter((e) => e.date >= weekStart).reduce((s, e) => s + e.minutes, 0);
  const monthMin = entries.filter((e) => e.date >= monthStart).reduce((s, e) => s + e.minutes, 0);

  const byGoal = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => { const k = e.goalId || "_"; map[k] = (map[k] || 0) + e.minutes; });
    return map;
  }, [entries]);
  const maxGoal = Math.max(1, ...Object.values(byGoal));

  // Últims 7 dies per a la mini-gràfica.
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const byDay: Record<string, number> = {};
  entries.forEach((e) => { byDay[e.date] = (byDay[e.date] || 0) + e.minutes; });
  const maxDay = Math.max(30, ...days.map((d) => byDay[d] || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="artist-section-title">La meva pràctica</div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
        <div className="card card-centered"><div className="card-title">Aquesta setmana</div><div className="card-value">{fmtMin(weekMin)}</div></div>
        <div className="card card-centered"><div className="card-title">Aquest mes</div><div className="card-value">{fmtMin(monthMin)}</div></div>
      </div>

      {/* Registre ràpid */}
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 12 }}>Registra una sessió</div>
        <div className="fin-form-grid">
          <select className="field-input compact-field" value={log.goalId} onChange={(e) => setLog({ ...log, goalId: e.target.value })}>
            <option value="">Sense objectiu concret</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input className="field-input compact-field" type="date" value={log.date} onChange={(e) => setLog({ ...log, date: e.target.value })} />
          <input className="field-input compact-field" type="number" placeholder="Minuts" value={log.minutes} onChange={(e) => setLog({ ...log, minutes: e.target.value })} />
          <input className="field-input compact-field" placeholder="Notes" value={log.notes} onChange={(e) => setLog({ ...log, notes: e.target.value })} />
        </div>
        <button type="button" className="btn-save" style={{ marginTop: 10 }} disabled={saving || !parseInt(log.minutes, 10)}
          onClick={async () => {
            setSaving(true);
            await logPracticeAction({ goalId: log.goalId || null, date: log.date, minutes: parseInt(log.minutes, 10) || 0, notes: log.notes });
            setLog((p) => ({ ...p, notes: "" }));
            router.refresh();
            setSaving(false);
          }}>{saving ? "Desant…" : "Registra"}</button>
      </div>

      {/* Gràfica setmanal */}
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 14 }}>Últims 7 dies</div>
        <div className="practice-days">
          {days.map((d) => (
            <div key={d} className="practice-day">
              <div className="practice-day-bar-wrap">
                <div className="practice-day-bar" style={{ height: ((byDay[d] || 0) / maxDay) * 100 + "%" }} title={fmtMin(byDay[d] || 0)}></div>
              </div>
              <span className="practice-day-label">{d.slice(8, 10)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Objectius */}
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 12 }}>Objectius</div>
        <div className="rank-list" style={{ marginBottom: 14 }}>
          {goals.map((g) => (
            <div key={g.id} className="rank-row" style={{ gridTemplateColumns: "150px 1fr 90px 26px" }}>
              <div className="rank-label">{g.name}</div>
              <div className="rank-track"><div className="rank-fill" style={{ width: ((byGoal[g.id] || 0) / maxGoal) * 100 + "%" }}></div></div>
              <div className="rank-value">{fmtMin(byGoal[g.id] || 0)}</div>
              <button type="button" className="row-delete-btn" onClick={async () => { await deletePracticeGoalAction(g.id); router.refresh(); }}>✕</button>
            </div>
          ))}
        </div>
        <form style={{ display: "flex", gap: 8 }} onSubmit={async (e) => {
          e.preventDefault();
          if (!newGoal.trim()) return;
          await addPracticeGoalAction(newGoal);
          setNewGoal("");
          router.refresh();
        }}>
          <input className="field-input compact-field" placeholder="Nou objectiu: escales, repertori nou…" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} style={{ maxWidth: 320 }} />
          <button type="submit" className="btn-outline">Afegeix</button>
        </form>
      </div>

      {/* Historial */}
      {entries.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}>Sessions recents</div>
          <div className="fin-list">
            {entries.slice(0, 15).map((e) => (
              <div key={e.id} className="fin-row">
                <span className="fin-amount fin-pos">{fmtMin(e.minutes)}</span>
                <div className="fin-row-main">
                  <span className="t-strong" style={{ fontSize: 13 }}>{e.goalId ? goalById[e.goalId] || "Objectiu esborrat" : "Pràctica lliure"}</span>
                  <span className="t-dim" style={{ fontSize: 11.5 }}>{formatDate(e.date)}{e.notes ? ` · ${e.notes}` : ""}</span>
                </div>
                <button type="button" className="row-delete-btn" onClick={async () => { await deletePracticeEntryAction(e.id); router.refresh(); }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
