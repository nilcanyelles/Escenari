"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Concert } from "@/lib/types";
import { formatCurrency, formatDate, today } from "@/lib/format";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, type Transaction } from "@/lib/finance";
import { saveTransactionAction, deleteTransactionAction } from "@/app/(app)/estadistiques/finance-actions";

// Moviments econòmics + repartiment pendent per músic + fons d'estalvi.
export default function FinancePanel({ transactions, bands, concerts }: { transactions: Transaction[]; bands: Band[]; concerts: Concert[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    kind: "despesa" as "ingres" | "despesa",
    category: EXPENSE_CATEGORIES[0],
    amount: "",
    date: today(),
    concertId: "",
    member: "",
    fund: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(15);

  const memberNames = useMemo(() => {
    const seen: Record<string, boolean> = {};
    const out: string[] = [];
    bands.forEach((b) => b.members.forEach((m) => { if (!seen[m.name]) { seen[m.name] = true; out.push(m.name); } }));
    return out.sort();
  }, [bands]);

  const income = transactions.filter((t) => t.kind === "ingres").reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter((t) => t.kind === "despesa").reduce((s, t) => s + t.amount, 0);

  // "Comptes clars": per músic, l'assignat als repartiments dels concerts
  // menys el que ja se li ha pagat (moviments "Pagament a músic").
  const settle = useMemo(() => {
    const owed: Record<string, number> = {};
    concerts.forEach((c) => {
      Object.entries(c.payouts || {}).forEach(([nom, imp]) => { owed[nom] = (owed[nom] || 0) + (imp || 0); });
    });
    const paid: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.kind === "despesa" && t.category === "Pagament a músic" && t.member) {
        paid[t.member] = (paid[t.member] || 0) + t.amount;
      }
    });
    return Object.keys({ ...owed, ...paid })
      .map((nom) => ({ nom, owed: owed[nom] || 0, paid: paid[nom] || 0, pending: (owed[nom] || 0) - (paid[nom] || 0) }))
      .filter((r) => r.owed || r.paid)
      .sort((a, b) => b.pending - a.pending);
  }, [concerts, transactions]);

  // Fons: moviments etiquetats amb un fons (p. ex. "Disc nou").
  const funds = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((t) => {
      if (!t.fund) return;
      map[t.fund] = (map[t.fund] || 0) + (t.kind === "ingres" ? t.amount : -t.amount);
    });
    return Object.entries(map).map(([nom, saldo]) => ({ nom, saldo }));
  }, [transactions]);

  async function handleSave() {
    setSaving(true);
    await saveTransactionAction({
      id: null,
      kind: form.kind,
      category: form.category,
      amount: parseInt(form.amount, 10) || 0,
      date: form.date,
      concertId: form.concertId || null,
      member: form.member,
      fund: form.fund,
      notes: form.notes,
    });
    setForm((p) => ({ ...p, amount: "", notes: "" }));
    setFormOpen(false);
    router.refresh();
    setSaving(false);
  }

  const cats = form.kind === "ingres" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const concertsById: Record<string, Concert> = {};
  concerts.forEach((c) => { concertsById[c.id] = c; });

  return (
    <>
      {/* Moviments */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 12 }}>
          <div className="panel-title">Moviments (ingressos i despeses)</div>
          {!formOpen && <button type="button" className="glow-cta" onClick={() => setFormOpen(true)}>+ Nou moviment</button>}
        </div>

        <div className="fin-summary">
          <span>Ingressos: <strong className="fin-pos">{formatCurrency(income)}</strong></span>
          <span>Despeses: <strong className="fin-neg">{formatCurrency(expenses)}</strong></span>
          <span>Balanç: <strong className={income - expenses >= 0 ? "fin-pos" : "fin-neg"}>{formatCurrency(income - expenses)}</strong></span>
        </div>

        {formOpen && (
          <div className="fin-form">
            <div className="stats-tabs">
              <button className={"stats-tab" + (form.kind === "ingres" ? " active" : "")} onClick={() => setForm({ ...form, kind: "ingres", category: INCOME_CATEGORIES[0] })}>Ingrés</button>
              <button className={"stats-tab" + (form.kind === "despesa" ? " active" : "")} onClick={() => setForm({ ...form, kind: "despesa", category: EXPENSE_CATEGORIES[0] })}>Despesa</button>
            </div>
            <div className="fin-form-grid">
              <select className="field-input compact-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {cats.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input className="field-input compact-field" type="number" placeholder="Import €" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <input className="field-input compact-field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <select className="field-input compact-field" value={form.concertId} onChange={(e) => setForm({ ...form, concertId: e.target.value })}>
                <option value="">Sense concert</option>
                {concerts.slice(0, 60).map((c) => <option key={c.id} value={c.id}>{formatDate(c.date)} · {c.city || c.venue}</option>)}
              </select>
              {form.kind === "despesa" && form.category === "Pagament a músic" && (
                <select className="field-input compact-field" value={form.member} onChange={(e) => setForm({ ...form, member: e.target.value })}>
                  <option value="">A quin músic?</option>
                  {memberNames.map((n) => <option key={n}>{n}</option>)}
                </select>
              )}
              <input className="field-input compact-field" placeholder="Fons (opcional): Disc nou…" value={form.fund} onChange={(e) => setForm({ ...form, fund: e.target.value })} />
              <input className="field-input compact-field" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-outline" onClick={() => setFormOpen(false)}>Cancel·la</button>
              <button type="button" className="btn-save" disabled={saving || !form.amount} onClick={handleSave}>{saving ? "Desant…" : "Desa"}</button>
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="empty-state">Cap moviment registrat. Les factures cobrades ja compten a les gràfiques — aquí hi van la resta d&apos;ingressos i totes les despeses.</div>
        ) : (
          <>
            <div className="fin-list">
              {transactions.slice(0, visible).map((t) => {
                const c = t.concertId ? concertsById[t.concertId] : null;
                return (
                  <div key={t.id} className="fin-row">
                    <span className={"fin-amount " + (t.kind === "ingres" ? "fin-pos" : "fin-neg")}>
                      {t.kind === "ingres" ? "+" : "−"}{formatCurrency(t.amount)}
                    </span>
                    <div className="fin-row-main">
                      <span className="t-strong" style={{ fontSize: 13 }}>{t.category}{t.member ? ` → ${t.member}` : ""}</span>
                      <span className="t-dim" style={{ fontSize: 11.5 }}>
                        {formatDate(t.date)}{c ? ` · ${c.city || c.venue}` : ""}{t.fund ? ` · fons: ${t.fund}` : ""}{t.notes ? ` · ${t.notes}` : ""}
                      </span>
                    </div>
                    <button type="button" className="row-delete-btn" onClick={async () => { await deleteTransactionAction(t.id); router.refresh(); }}>✕</button>
                  </div>
                );
              })}
            </div>
            {visible < transactions.length && (
              <button type="button" className="load-more-btn" onClick={() => setVisible((v) => v + 20)}>Mostra&apos;n més</button>
            )}
          </>
        )}
      </div>

      {/* Comptes clars */}
      {settle.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}>Comptes clars — què es deu a cada músic</div>
          <div className="t-dim" style={{ fontSize: 12, marginBottom: 12 }}>
            Assignat als repartiments dels concerts menys els moviments &ldquo;Pagament a músic&rdquo;.
          </div>
          <div className="settle-list">
            {settle.map((r) => (
              <div key={r.nom} className="settle-row">
                <span className="t-strong" style={{ fontSize: 13 }}>{r.nom}</span>
                <span className="t-dim" style={{ fontSize: 12 }}>assignat {formatCurrency(r.owed)} · pagat {formatCurrency(r.paid)}</span>
                <span className={"settle-pending " + (r.pending > 0 ? "fin-neg" : "fin-pos")}>
                  {r.pending > 0 ? `pendent ${formatCurrency(r.pending)}` : "al dia ✓"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fons */}
      {funds.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}>Fons d&apos;estalvi</div>
          <div className="fin-summary">
            {funds.map((f) => (
              <span key={f.nom}>{f.nom}: <strong className={f.saldo >= 0 ? "fin-pos" : "fin-neg"}>{formatCurrency(f.saldo)}</strong></span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
