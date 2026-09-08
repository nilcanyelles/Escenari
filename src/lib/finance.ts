import { db } from "./db";

// Qui es fa càrrec d'una despesa de concert: l'agència (surt de la seva
// comissió), el grup (del repartiment de músics i crew), tots dos (del
// caixet abans de calcular res) o altres (promotor, sala... — no és cap
// cost del bolo).
export type ExpensePayer = "agencia" | "grup" | "ambdos" | "altre";
export const EXPENSE_PAYER_LABELS: Record<ExpensePayer, string> = {
  agencia: "Agència", grup: "Grup", ambdos: "Agència i grup", altre: "Altres",
};

export type Transaction = {
  id: string;
  kind: "ingres" | "despesa";
  category: string;
  amount: number;
  date: string;
  concertId: string | null;
  member: string;
  fund: string;
  notes: string;
  receiptFileId: string | null;
  // Buit a les despeses d'abans d'existir el camp (vegeu ConcertDetailView).
  paidBy?: ExpensePayer | "";
};

export const INCOME_CATEGORIES = ["Caixet", "Propines", "Marxandatge", "Subvenció", "Altres ingressos"];
export const EXPENSE_CATEGORIES = ["Transport", "Equip", "Dietes", "Assaig / local", "Pagament a músic", "Promoció", "Altres despeses"];

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  // Un Date d'una columna "date" de Postgres representa mitjanit LOCAL
  // d'aquell dia — amb toISOString() (que sempre passa a UTC) es podia
  // desplaçar un dia enrere segons la zona horària del servidor.
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export async function getTransactions(workspaceId: string): Promise<Transaction[]> {
  const { rows } = await db().query(
    "select * from transactions where workspace_id=$1 order by tdate desc, created_at desc",
    [workspaceId]
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    category: r.category,
    amount: r.amount,
    date: toDateStr(r.tdate),
    concertId: r.concert_id,
    member: r.member,
    fund: r.fund,
    notes: r.notes,
    receiptFileId: r.receipt_file_id || null,
    paidBy: (r.paid_by as ExpensePayer | "") || "",
  }));
}
