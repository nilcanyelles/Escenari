"use server";

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { today, addDays, formatDate, formatCurrency } from "@/lib/format";
import { requireManagerAction } from "@/lib/current-user";
import { syncClientToContacts } from "@/app/(app)/contactes/actions";
import { sendEmail, emailConfigured } from "@/lib/email";
import { computeInvoiceTotals } from "@/lib/invoice-utils";

// Bloqueig d'assessorament (advisory lock) perquè dues generacions simultànies
// no calculin el mateix número de factura. La sèrie és per workspace, així que
// el bloqueig també ho és (clau de dos enters: constant + hash del workspace).
const INVOICE_LOCK_KEY = 982451;

// Cadena de hash estil Verifactu: cada factura encadena amb l'anterior del
// workspace. No és (encara) el format certificat de l'AEAT, però el registre
// ja té l'estructura perquè s'hi pugui afegir sense migració.
function invoiceHash(fields: { workspaceId: string; id: string; issueDate: string; base: number; ivaRate: number; irpfRate: number; total: number; prevHash: string }): string {
  const payload = [fields.workspaceId, fields.id, fields.issueDate, fields.base, fields.ivaRate, fields.irpfRate, fields.total, fields.prevHash].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export async function generateInvoiceAction(concertId: string) {
  const { workspaceId } = await requireManagerAction();
  const pool = db();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1, hashtext($2))", [INVOICE_LOCK_KEY, workspaceId]);

    const c = (await client.query("select * from concerts where id=$1 and workspace_id=$2", [concertId, workspaceId])).rows[0];
    const existing = (await client.query("select id from invoices where concert_id=$1 and workspace_id=$2", [concertId, workspaceId])).rows[0];
    if (!c || existing) {
      await client.query("rollback");
      return;
    }

    const company = (await client.query("select iva_rate, irpf_rate from company_info where workspace_id=$1", [workspaceId])).rows[0];
    const ivaRate = Number(company?.iva_rate) || 21;
    const irpfRate = Number(company?.irpf_rate) || 0;

    const todayStr = today();
    const year = todayStr.slice(0, 4);
    // Següent número = màxim de la sèrie de l'any + 1 (el recompte fallava amb
    // factures esborrades: repetia números).
    const maxRow = await client.query(
      "select coalesce(max(nullif(substring(id from 8), '')::int), 0) as n from invoices where id like $1 and workspace_id=$2",
      ["F-" + year + "-%", workspaceId]
    );
    const num = maxRow.rows[0].n + 1;
    const id = "F-" + year + "-" + String(num).padStart(3, "0");
    const base = c.amount;
    const { total } = computeInvoiceTotals(base, ivaRate, irpfRate);

    const prev = (await client.query(
      "select hash from invoices where workspace_id=$1 order by created_at desc limit 1", [workspaceId]
    )).rows[0];
    const prevHash = prev?.hash || "";
    const hash = invoiceHash({ workspaceId, id, issueDate: todayStr, base, ivaRate, irpfRate, total, prevHash });

    await client.query(
      `insert into invoices (id, concert_id, client, band_name, issue_date, due_date, amount, state, workspace_id,
                             base_amount, iva_rate, irpf_rate, prev_hash, hash)
       values ($1,$2,$3,$4,$5,$6,$7,'pendent',$8,$9,$10,$11,$12,$13)`,
      [id, c.id, c.venue, c.band_name, todayStr, addDays(todayStr, 30), total, workspaceId, base, ivaRate, irpfRate, prevHash, hash]
    );
    await client.query("commit");
    await syncClientToContacts(workspaceId, c.venue);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/facturacio");
  revalidatePath("/concerts");
  revalidatePath("/estadistiques");
  revalidatePath("/contactes");
}

// Edició d'una factura generada: base, tipus, dates, client i bestreta.
// El hash es recalcula (la cadena queda com a registre de l'última versió).
export async function editInvoiceAction(input: {
  id: string;
  client: string;
  issueDate: string;
  dueDate: string;
  baseAmount: number;
  ivaRate: number;
  irpfRate: number;
  depositAmount: number;
  depositPaid: boolean;
}) {
  const { workspaceId } = await requireManagerAction();
  const row = (await db().query("select prev_hash from invoices where id=$1 and workspace_id=$2", [input.id, workspaceId])).rows[0];
  if (!row) throw new Error("Factura no trobada");
  const base = Math.round(input.baseAmount) || 0;
  const { total } = computeInvoiceTotals(base, input.ivaRate, input.irpfRate);
  const hash = invoiceHash({
    workspaceId, id: input.id, issueDate: input.issueDate, base,
    ivaRate: input.ivaRate, irpfRate: input.irpfRate, total, prevHash: row.prev_hash || "",
  });
  await db().query(
    `update invoices set client=$1, issue_date=$2, due_date=$3, base_amount=$4, iva_rate=$5, irpf_rate=$6,
       amount=$7, deposit_amount=$8, deposit_paid=$9, hash=$10
     where id=$11 and workspace_id=$12`,
    [input.client, input.issueDate, input.dueDate, base, input.ivaRate, input.irpfRate, total,
      Math.max(0, Math.round(input.depositAmount) || 0), input.depositPaid, hash, input.id, workspaceId]
  );
  revalidatePath("/facturacio");
  revalidatePath("/concerts");
  revalidatePath("/estadistiques");
}

// Recordatori de cobrament amb el detall de la factura, per correu.
export async function sendInvoiceReminderAction(invoiceId: string, toEmail: string): Promise<{ ok: boolean; error?: string }> {
  const { workspaceId } = await requireManagerAction();
  if (!emailConfigured()) return { ok: false, error: "Configura RESEND_API_KEY per enviar correus" };
  const inv = (await db().query(
    `select i.*, ci.nom as company_nom, ci.iban from invoices i
     left join company_info ci on ci.workspace_id = i.workspace_id
     where i.id=$1 and i.workspace_id=$2`,
    [invoiceId, workspaceId]
  )).rows[0];
  if (!inv) return { ok: false, error: "Factura no trobada" };
  const issue = typeof inv.issue_date === "string" ? inv.issue_date.slice(0, 10) : inv.issue_date.toISOString().slice(0, 10);
  const due = typeof inv.due_date === "string" ? inv.due_date.slice(0, 10) : inv.due_date.toISOString().slice(0, 10);
  const { iva, irpf } = computeInvoiceTotals(inv.base_amount, Number(inv.iva_rate), Number(inv.irpf_rate));
  const rows = [
    ["Base imposable", formatCurrency(inv.base_amount)],
    [`IVA ${Number(inv.iva_rate)}%`, formatCurrency(iva)],
    ...(Number(inv.irpf_rate) > 0 ? [[`Retenció IRPF ${Number(inv.irpf_rate)}%`, "−" + formatCurrency(irpf)]] : []),
    ["<strong>Total</strong>", `<strong>${formatCurrency(inv.amount)}</strong>`],
  ].map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#b9b5cc;">${k}</td><td style="padding:5px 0;text-align:right;">${v}</td></tr>`).join("");

  const result = await sendEmail({
    to: toEmail,
    subject: `Recordatori de pagament — factura ${inv.id} (${inv.band_name})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #12101f; color: #f5f4fa; padding: 32px; border-radius: 16px;">
        <div style="letter-spacing: 4px; font-size: 12px; color: #a99df5; margin-bottom: 20px;">${inv.company_nom || "ESCENARI"}</div>
        <h2 style="margin: 0 0 6px; font-size: 19px;">Factura ${inv.id}</h2>
        <p style="color: #b9b5cc; margin: 0 0 18px;">${inv.client} · emesa el ${formatDate(issue)} · venciment ${formatDate(due)}</p>
        <p style="color: #d9d6e8; line-height: 1.5;">Us recordem que aquesta factura continua pendent de pagament:</p>
        <table style="width:100%;border-collapse:collapse;color:#f5f4fa;font-size:14px;margin:12px 0 18px;">${rows}</table>
        ${inv.iban ? `<p style="color:#b9b5cc;font-size:13px;">Transferència al compte: <strong style="color:#f5f4fa;">${inv.iban}</strong></p>` : ""}
        <p style="font-size: 12px; color: #7a7690;">Enviat des d'Escenari en nom de ${inv.band_name}.</p>
      </div>`,
  });
  return result;
}

export async function saveCompanyInfoAction(data: { nom: string; cif: string; address: string; iban: string; ivaRate?: number; irpfRate?: number }) {
  const { workspaceId } = await requireManagerAction();
  await db().query(
    "update company_info set nom=$1, cif=$2, address=$3, iban=$4, iva_rate=coalesce($5, iva_rate), irpf_rate=coalesce($6, irpf_rate) where workspace_id=$7",
    [data.nom, data.cif, data.address, data.iban, data.ivaRate ?? null, data.irpfRate ?? null, workspaceId]
  );
  revalidatePath("/facturacio");
}
