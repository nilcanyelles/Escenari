"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Contact } from "@/lib/types";
import type { ContactInteraction } from "@/lib/contacts-data";
import { formatDate, today } from "@/lib/format";
import { addInteractionAction, markInteractionDoneAction, deleteInteractionAction } from "@/app/(app)/contactes/actions";

// Historial d'interaccions amb contactes + seguiments programats: no perdis
// mai un "truca'ls d'aquí a dues setmanes".
export default function ContactFollowups({ contacts, interactions }: { contacts: Contact[]; interactions: ContactInteraction[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<string>("");
  const [form, setForm] = useState({ contactId: "", date: today(), note: "", nextDate: "", nextNote: "" });
  const [saving, setSaving] = useState(false);

  const byId: Record<string, Contact> = {};
  contacts.forEach((c) => { byId[c.id] = c; });

  const todayStr = today();
  const pending = interactions
    .filter((i) => i.nextDate && !i.done)
    .sort((a, b) => (a.nextDate! < b.nextDate! ? -1 : 1));
  const due = pending.filter((i) => i.nextDate! <= todayStr);
  const upcoming = pending.filter((i) => i.nextDate! > todayStr).slice(0, 5);

  const history = historyFor ? interactions.filter((i) => i.contactId === historyFor) : [];

  return (
    <div className="panel">
      <div className="panel-header-row" style={{ marginBottom: 10 }}>
        <div className="panel-title">Seguiments</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select className="field-input compact-field" value={historyFor} onChange={(e) => setHistoryFor(e.target.value)}>
            <option value="">Historial d&apos;un contacte…</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {!formOpen && <button type="button" className="btn-outline" onClick={() => setFormOpen(true)}>+ Registra interacció</button>}
        </div>
      </div>

      {formOpen && (
        <div className="fin-form" style={{ marginBottom: 14 }}>
          <div className="fin-form-grid">
            <select className="field-input compact-field" value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
              <option value="">Amb qui?</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="field-input compact-field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="field-input compact-field" placeholder="Què heu parlat? (trucada, correu…)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ gridColumn: "span 2" }} />
            <input className="field-input compact-field" type="date" title="Data del proper seguiment" value={form.nextDate} onChange={(e) => setForm({ ...form, nextDate: e.target.value })} />
            <input className="field-input compact-field" placeholder="Proper pas (tornar a trucar…)" value={form.nextNote} onChange={(e) => setForm({ ...form, nextNote: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-outline" onClick={() => setFormOpen(false)}>Cancel·la</button>
            <button type="button" className="btn-save" disabled={saving || !form.contactId}
              onClick={async () => {
                setSaving(true);
                await addInteractionAction({ contactId: form.contactId, date: form.date, note: form.note, nextDate: form.nextDate || null, nextNote: form.nextNote });
                setForm({ contactId: "", date: today(), note: "", nextDate: "", nextNote: "" });
                setFormOpen(false);
                router.refresh();
                setSaving(false);
              }}>{saving ? "Desant…" : "Desa"}</button>
          </div>
        </div>
      )}

      {due.length === 0 && upcoming.length === 0 && !historyFor ? (
        <div className="t-dim" style={{ fontSize: 12.5 }}>
          Cap seguiment pendent. Registra les trucades i correus amb sales i promotors, i programa quan els has de tornar a contactar.
        </div>
      ) : (
        <div className="followup-list">
          {due.map((i) => (
            <div key={i.id} className="followup-row due">
              <span className="followup-date">⚠ {formatDate(i.nextDate!)}</span>
              <span className="t-strong" style={{ fontSize: 13 }}>{byId[i.contactId]?.name || "—"}</span>
              <span className="t-dim" style={{ fontSize: 12.5, flex: 1 }}>{i.nextNote || i.note}</span>
              <button type="button" className="btn-outline" onClick={async () => { await markInteractionDoneAction(i.id, true); router.refresh(); }}>Fet ✓</button>
            </div>
          ))}
          {upcoming.map((i) => (
            <div key={i.id} className="followup-row">
              <span className="followup-date">{formatDate(i.nextDate!)}</span>
              <span className="t-strong" style={{ fontSize: 13 }}>{byId[i.contactId]?.name || "—"}</span>
              <span className="t-dim" style={{ fontSize: 12.5, flex: 1 }}>{i.nextNote || i.note}</span>
              <button type="button" className="btn-outline" onClick={async () => { await markInteractionDoneAction(i.id, true); router.refresh(); }}>Fet ✓</button>
            </div>
          ))}
        </div>
      )}

      {historyFor && (
        <div className="followup-history">
          <div className="cd-subtitle" style={{ marginTop: 14 }}>Historial — {byId[historyFor]?.name}</div>
          {history.length === 0 ? (
            <div className="t-dim" style={{ fontSize: 12.5 }}>Cap interacció registrada amb aquest contacte.</div>
          ) : (
            history.map((i) => (
              <div key={i.id} className="followup-row">
                <span className="followup-date">{formatDate(i.date)}</span>
                <span className="t-dim" style={{ fontSize: 12.5, flex: 1 }}>{i.note || "—"}{i.nextDate ? ` → seguiment ${formatDate(i.nextDate)}${i.done ? " (fet)" : ""}` : ""}</span>
                <button type="button" className="row-delete-btn" onClick={async () => { await deleteInteractionAction(i.id); router.refresh(); }}>✕</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
