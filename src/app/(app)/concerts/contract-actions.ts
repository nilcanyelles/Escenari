"use server";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
import { requireFeature } from "@/lib/billing";
import { appBaseUrl } from "@/lib/social-oauth";
import { sendEmail, emailConfigured } from "@/lib/email";
import { formatDateLong, capitalize } from "@/lib/format";
import type { ContractData } from "@/lib/types";

// Contracte d'actuació d'un concert: es desa al concert, té un enllaç
// públic (/ct/token) i es pot enviar per correu.

async function ownConcert(concertId: string) {
  const p = await requireManagerAction();
  await requireFeature(p.workspaceId, "contracts");
  const c = (await db().query(
    "select id, band_name, date, city, venue, contract_token from concerts where id=$1 and workspace_id=$2",
    [concertId, p.workspaceId]
  )).rows[0];
  if (!c) throw new Error("Concert no trobat");
  return { p, c };
}

export async function saveContractAction(concertId: string, data: ContractData) {
  await ownConcert(concertId);
  const clean: ContractData = {
    clauses: (data.clauses || "").slice(0, 20000),
    extra: (data.extra || "").slice(0, 5000),
    signerName: (data.signerName || "").trim().slice(0, 120),
    signerRole: (data.signerRole || "").trim().slice(0, 120),
    updatedAt: new Date().toISOString(),
  };
  await db().query("update concerts set contract=$1 where id=$2", [JSON.stringify(clean), concertId]);
  revalidatePath(`/concerts/${concertId}`);
}

// Crea (si cal) l'enllaç públic del contracte i el torna.
export async function ensureContractTokenAction(concertId: string): Promise<{ url: string; token: string }> {
  const { c } = await ownConcert(concertId);
  let token = c.contract_token as string | null;
  if (!token) {
    token = "ct_" + randomBytes(10).toString("base64url");
    await db().query("update concerts set contract_token=$1 where id=$2 and contract_token is null", [token, concertId]);
    token = (await db().query("select contract_token from concerts where id=$1", [concertId])).rows[0].contract_token;
  }
  revalidatePath(`/concerts/${concertId}`);
  return { url: `${appBaseUrl()}/ct/${token}`, token: token as string };
}

export async function sendContractEmailAction(concertId: string, email: string): Promise<{ ok: boolean; error?: string }> {
  const { p, c } = await ownConcert(concertId);
  const to = (email || "").trim();
  if (!/.+@.+\..+/.test(to)) return { ok: false, error: "Correu no vàlid" };
  if (!emailConfigured()) return { ok: false, error: "El correu no està configurat (RESEND_API_KEY)" };
  const { url } = await ensureContractTokenAction(concertId);
  const dateStr = typeof c.date === "string" ? c.date.slice(0, 10) : new Date(c.date).toISOString().slice(0, 10);
  return sendEmail({
    to,
    subject: `Contracte d'actuació — ${c.band_name}, ${capitalize(formatDateLong(dateStr))}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #12101f; color: #f5f4fa; padding: 32px; border-radius: 16px;">
        <div style="letter-spacing: 4px; font-size: 13px; color: #a99df5; margin-bottom: 24px;">ESCENARI</div>
        <h2 style="margin: 0 0 8px; font-size: 20px;">Contracte d'actuació · ${c.band_name}</h2>
        <p style="margin: 0 0 20px; color: #b9b5cc;">${capitalize(formatDateLong(dateStr))}${c.city ? " · " + c.city : ""}${c.venue ? " · " + c.venue : ""}</p>
        <p style="color: #d9d6e8; line-height: 1.5;">Hola,<br/><br/>${p.name || "L'agència"} us envia el contracte d'aquesta actuació. El podeu llegir, imprimir o desar en PDF des d'aquest enllaç.</p>
        <a href="${url}" style="display: inline-block; background: #8b7bff; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; margin: 16px 0;">Obre el contracte</a>
      </div>`,
  });
}
