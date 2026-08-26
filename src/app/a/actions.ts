"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { RiderContent } from "@/lib/material-types";
import { sendEmail, emailConfigured } from "@/lib/email";

// Accions públiques del flux d'aprovació de riders (via token, sense sessió).

async function validApproval(token: string) {
  const row = (await db().query("select * from rider_approvals where id=$1", [token])).rows[0];
  return row || null;
}

// La persona externa aprova el rider tal com està.
export async function approveRiderPublicAction(token: string): Promise<{ ok: boolean; error?: string }> {
  const ap = await validApproval(token);
  if (!ap) return { ok: false, error: "Aquest enllaç no és vàlid." };
  await db().query("update rider_approvals set status='aprovat', approved_at=now() where id=$1", [token]);
  revalidatePath(`/concerts/${ap.concert_id}`);
  return { ok: true };
}

// La persona externa proposa canvis: desa la seva versió com a contrarider.
export async function submitCounterPublicAction(token: string, content: RiderContent, note: string): Promise<{ ok: boolean; error?: string }> {
  const ap = await validApproval(token);
  if (!ap) return { ok: false, error: "Aquest enllaç no és vàlid." };
  await db().query(
    "update rider_approvals set status='contrarider', counter_content=$1, counter_note=$2 where id=$3",
    [JSON.stringify(content), (note || "").slice(0, 1000), token]
  );
  revalidatePath(`/concerts/${ap.concert_id}`);
  return { ok: true };
}

// Enviament del correu d'aprovació "des d'Escenari" (el crida el gestor).
export async function sendApprovalEmailAction(token: string): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "Falta RESEND_API_KEY" };
  const row = (await db().query(
    `select ap.*, c.date, c.city, c.venue, c.band_name, r.name as rider_name
     from rider_approvals ap
     join concerts c on c.id = ap.concert_id
     join riders r on r.id = ap.rider_id
     where ap.id=$1`,
    [token]
  )).rows[0];
  if (!row) return { ok: false, error: "Aprovació no trobada" };
  if (!row.recipient_email) return { ok: false, error: "Sense correu de destinatari" };

  const base = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001");
  const url = `${base}/a/${row.id}`;
  const dateStr = typeof row.date === "string" ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10);
  const result = await sendEmail({
    to: row.recipient_email,
    subject: `Rider de ${row.band_name} — concert ${dateStr}${row.city ? " a " + row.city : ""}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #12101f; color: #f5f4fa; padding: 32px; border-radius: 16px;">
        <div style="letter-spacing: 4px; font-size: 13px; color: #a99df5; margin-bottom: 24px;">ESCENARI</div>
        <h2 style="margin: 0 0 8px; font-size: 20px;">${row.band_name} — ${row.rider_name}</h2>
        <p style="margin: 0 0 20px; color: #b9b5cc;">${dateStr}${row.city ? " · " + row.city : ""}${row.venue ? " · " + row.venue : ""}</p>
        <p style="color: #d9d6e8; line-height: 1.5;">
          Hola${row.recipient_name ? " " + row.recipient_name : ""},<br/><br/>
          us fem arribar el rider tècnic d'aquesta actuació perquè el reviseu.
          Podeu aprovar-lo tal com està o proposar-hi canvis directament des de l'enllaç.
        </p>
        <a href="${url}" style="display: inline-block; background: #8b7bff; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; margin: 16px 0;">
          Revisa el rider
        </a>
      </div>`,
  });
  if (result.ok) await db().query("update rider_approvals set email_sent_at=now() where id=$1", [token]);
  return result;
}
