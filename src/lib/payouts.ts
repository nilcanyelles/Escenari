import type { Band, Concert } from "./types";
import type { Transaction, ExpensePayer } from "./finance";
import { normalize } from "./text";

// Aritmètica del repartiment d'un concert, la mateixa que la fitxa del
// gestor (ConcertDetailView) — perquè un músic vegi el que li toca encara
// que el gestor no hagi tocat mai el panell de repartiment (aleshores es
// mostra el repartiment predeterminat que veuria el gestor en obrir-lo).

export const AGENCY_PAYOUT_NAME = "Agència";
export const AGENCY_DEFAULT_PCT = 20;

function round2(x: number): number { return Math.round(x * 100) / 100; }
function toCents(x: number): number { return Math.round(x * 100); }

// Qui paga cada despesa — les d'abans d'existir el camp segueixen el
// criteri antic del concert: "tots dos" si l'agència assumia despeses,
// "grup" si no.
export function expensePayer(t: Transaction, legacyAgencyAssumes: boolean): ExpensePayer {
  const p = t.paidBy;
  if (p === "agencia" || p === "grup" || p === "ambdos" || p === "altre") return p;
  return legacyAgencyAssumes ? "ambdos" : "grup";
}
export function splitExpenses(list: Transaction[], legacyAgencyAssumes: boolean): Record<ExpensePayer, number> {
  const out: Record<ExpensePayer, number> = { agencia: 0, grup: 0, ambdos: 0, altre: 0 };
  list.forEach((t) => { out[expensePayer(t, legacyAgencyAssumes)] += t.amount; });
  return out;
}

export type PayoutSummary = {
  amount: number;
  expenses: Record<ExpensePayer, number>;
  expenseList: { id: string; label: string; amount: number; payer: ExpensePayer }[];
  totalExpenses: number;
  sharedNet: number;
  agencyPct: number;
  agencyAmt: number;
  agencyNet: number;
  bandPool: number;
  // Nom → import (inclou "Agència").
  payouts: Record<string, number>;
  // true si el gestor ja té un repartiment desat; false si és el predeterminat.
  saved: boolean;
};

export function computePayouts(
  concert: Pick<Concert, "attendance" | "substitutes"> & { amount: number; payouts?: Record<string, number>; agencyPct?: number; agencyAssumesExpenses?: boolean },
  band: Band | null,
  expenseTxs: Transaction[],
): PayoutSummary {
  const legacy = concert.agencyAssumesExpenses !== false;
  const expenses = splitExpenses(expenseTxs, legacy);
  const amount = concert.amount || 0;
  const totalExpenses = expenses.agencia + expenses.grup + expenses.ambdos;
  const sharedNet = Math.max(0, amount - expenses.ambdos);
  const agencyPct = concert.agencyPct ?? AGENCY_DEFAULT_PCT;
  const agencyAmt = round2((agencyPct / 100) * sharedNet);
  const agencyNet = round2(agencyAmt - expenses.agencia);
  const bandPool = Math.max(0, sharedNet - agencyAmt - expenses.grup);

  const payouts: Record<string, number> = { ...(concert.payouts || {}) };
  const saved = Object.keys(payouts).some((k) => k !== AGENCY_PAYOUT_NAME);
  if (!saved) {
    // Qui hi va (o el seu substitut) + la crew: parts iguals, o els % predeterminats del grup.
    const attending: string[] = [];
    (band?.members || []).forEach((m) => {
      if (concert.attendance?.[m.name] === "no") {
        const sub = concert.substitutes?.[m.name];
        if (sub) attending.push(sub);
      } else {
        attending.push(m.name);
      }
    });
    const names = [...attending, ...(band?.crew || []).map((m) => m.name)];
    const split = band?.defaultPayoutSplit;
    if (split && Object.keys(split).length) {
      Object.entries(split).forEach(([n, pct]) => { if (n !== AGENCY_PAYOUT_NAME) payouts[n] = round2((pct / 100) * bandPool); });
    } else if (names.length) {
      const total = toCents(bandPool);
      const per = Math.floor(total / names.length);
      names.forEach((n, i) => { payouts[n] = (per + (i === 0 ? total - per * names.length : 0)) / 100; });
    }
  }
  payouts[AGENCY_PAYOUT_NAME] = agencyAmt;

  return {
    amount, expenses, totalExpenses, sharedNet, agencyPct, agencyAmt, agencyNet, bandPool, payouts, saved,
    expenseList: expenseTxs.map((t) => ({ id: t.id, label: t.category + (t.notes ? " — " + t.notes : ""), amount: t.amount, payer: expensePayer(t, legacy) })),
  };
}

// El que li toca a una persona (pel nom, sense distingir accents), o null
// si no forma part del repartiment.
export function myPayout(payouts: Record<string, number>, name: string): number | null {
  const key = Object.keys(payouts).find((k) => k !== AGENCY_PAYOUT_NAME && normalize(k) === normalize(name));
  return key !== undefined ? payouts[key] || 0 : null;
}
