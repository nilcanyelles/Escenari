"use server";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
import { sendEmail, emailConfigured } from "@/lib/email";
import { formatDateLong, capitalize } from "@/lib/format";

function newToken(): string {
  return randomBytes(18).toString("base64url");
}

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3001";
}

export type CreateShareLinkInput = {
  concertId: string;
  scope: "info" | "ruta" | "both";
  recipientEmail: string;
  recipientName: string;
  days: number; // dies de validesa
};

export async function createShareLinkAction(input: CreateShareLinkInput): Promise<{ id: string; url: string }> {
  const { workspaceId } = await requireManagerAction();
  const owns = await db().query("select 1 from concerts where id=$1 and workspace_id=$2", [input.concertId, workspaceId]);
  if (!owns.rows.length) throw new Error("Concert no trobat");
  const id = newToken();
  const days = Math.min(Math.max(input.days || 14, 1), 90);
  await db().query(
    `insert into share_links (id, workspace_id, concert_id, scope, recipient_email, recipient_name, expires_at)
     values ($1,$2,$3,$4,$5,$6, now() + ($7 || ' days')::interval)`,
    [id, workspaceId, input.concertId, input.scope, (input.recipientEmail || "").trim(), (input.recipientName || "").trim(), String(days)]
  );
  revalidatePath(`/concerts/${input.concertId}`);
  return { id, url: `${baseUrl()}/f/${id}` };
}

export async function revokeShareLinkAction(id: string) {
  const { workspaceId } = await requireManagerAction();
  await db().query("update share_links set revoked=true where id=$1 and workspace_id=$2", [id, workspaceId]);
  revalidatePath("/concerts");
}

export async function isEmailConfiguredAction(): Promise<boolean> {
  await requireManagerAction();
  return emailConfigured();
}

// Envia l'enllaç del formulari per correu "des d'Escenari".
export async function sendShareLinkEmailAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const { workspaceId, name } = await requireManagerAction();
  const row = (await db().query(
    `select sl.*, c.date, c.city, c.venue, c.band_name from share_links sl
     join concerts c on c.id = sl.concert_id
     where sl.id=$1 and sl.workspace_id=$2`,
    [id, workspaceId]
  )).rows[0];
  if (!row) return { ok: false, error: "Enllaç no trobat" };
  if (!row.recipient_email) return { ok: false, error: "Aquest enllaç no té cap correu de destinatari" };

  const dateStr = typeof row.date === "string" ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10);
  const url = `${baseUrl()}/f/${row.id}`;
  const scopeLabel = row.scope === "info" ? "la informació del concert" : row.scope === "ruta" ? "el full de ruta" : "la informació i el full de ruta";
  const result = await sendEmail({
    to: row.recipient_email,
    subject: `${row.band_name} — ${capitalize(formatDateLong(dateStr))}: falten dades del concert`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #12101f; color: #f5f4fa; padding: 32px; border-radius: 16px;">
        <div style="letter-spacing: 4px; font-size: 13px; color: #a99df5; margin-bottom: 24px;">ESCENARI</div>
        <h2 style="margin: 0 0 8px; font-size: 20px;">${row.band_name}</h2>
        <p style="margin: 0 0 20px; color: #b9b5cc;">
          ${capitalize(formatDateLong(dateStr))}${row.city ? " · " + row.city : ""}${row.venue ? " · " + row.venue : ""}
        </p>
        <p style="color: #d9d6e8; line-height: 1.5;">
          Hola${row.recipient_name ? " " + row.recipient_name : ""},<br/><br/>
          ${name || "L'equip de gestió"} necessita que ompliu ${scopeLabel} d'aquesta actuació.
          És un formulari ràpid i visual — hi podeu tornar tants cops com calgui mentre l'enllaç sigui vàlid.
        </p>
        <a href="${url}" style="display: inline-block; background: #8b7bff; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; margin: 16px 0;">
          Omple les dades
        </a>
        <p style="font-size: 12px; color: #7a7690;">Aquest enllaç és personal i caduca automàticament.</p>
      </div>`,
  });
  if (result.ok) {
    await db().query("update share_links set email_sent_at=now() where id=$1", [id]);
    revalidatePath(`/concerts/${row.concert_id}`);
  }
  return result;
}
