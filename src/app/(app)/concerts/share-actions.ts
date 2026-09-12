"use server";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
import { activeLinksForConcert } from "@/lib/billing";
import { sendEmail, emailConfigured } from "@/lib/email";
import { formatDateLong, capitalize } from "@/lib/format";
import { assemblePublicShareData, type PublicShareFormData } from "@/lib/public-share-data";
import { ALL_SHARE_SECTIONS, shareSectionsLabel } from "@/lib/share-sections";

function newToken(): string {
  return randomBytes(18).toString("base64url");
}

// "scope" es manté a la taula per compatibilitat (constraint NOT NULL) —
// és només una aproximació de "sections", que és l'origen de veritat.
function legacyScopeFor(sections: string[]): "info" | "ruta" | "both" {
  if (ALL_SHARE_SECTIONS.every((s) => sections.includes(s))) return "both";
  if (sections.every((s) => s === "info")) return "info";
  if (!sections.includes("info")) return "ruta";
  return "both";
}

// Codi de la pantalla d'avís (/f/[token]) — mateix alfabet que els codis
// d'unió a un grup (group-create.ts): sense 0/O/1/I/L per no confondre'ls.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3001";
}

export type CreateShareLinkInput = {
  concertId: string;
  sections: string[];
  recipientEmail: string;
  recipientName: string;
  days: number; // dies de validesa de l'enllaç en si
  // Si es dona, l'enllaç neix ja amb un codi d'accés d'aquesta validesa —
  // des del mateix menú de "+ Generar enllaç" es pot generar tot alhora.
  codeValidity?: CodeValidity;
};

export async function createShareLinkAction(input: CreateShareLinkInput): Promise<{ id: string; url: string; code?: string; codeExpiresAt?: string }> {
  const { workspaceId } = await requireManagerAction();
  const concert = (await db().query("select date from concerts where id=$1 and workspace_id=$2", [input.concertId, workspaceId])).rows[0];
  if (!concert) throw new Error("Concert no trobat");
  // Límit d'enllaços actius per grup del pla gratuït.
  const cap = await activeLinksForConcert(workspaceId, input.concertId);
  if (cap.reached) throw new Error(`Has arribat al límit de ${cap.cap} enllaços actius del pla gratuït`);
  const sections = input.sections.length ? input.sections : ALL_SHARE_SECTIONS;
  const id = newToken();
  const days = Math.min(Math.max(input.days || 14, 1), 90);
  let code: string | null = null;
  let codeDays: string | null = null;
  if (input.codeValidity) {
    const concertDate = typeof concert.date === "string" ? concert.date.slice(0, 10) : concert.date.toISOString().slice(0, 10);
    code = generateAccessCode();
    codeDays = String(codeDaysFor(input.codeValidity, concertDate));
  }
  const row = (await db().query(
    `insert into share_links (id, workspace_id, concert_id, scope, sections, recipient_email, recipient_name, expires_at, access_code, code_expires_at)
     values ($1,$2,$3,$4,$5,$6,$7, now() + ($8 || ' days')::interval, $9, case when $10::text is null then null else now() + ($10 || ' days')::interval end)
     returning code_expires_at`,
    [id, workspaceId, input.concertId, legacyScopeFor(sections), JSON.stringify(sections), (input.recipientEmail || "").trim(), (input.recipientName || "").trim(), String(days), code, codeDays]
  )).rows[0];
  revalidatePath(`/concerts/${input.concertId}`);
  return { id, url: `${baseUrl()}/f/${id}`, code: code || undefined, codeExpiresAt: code ? row.code_expires_at : undefined };
}

// Crida des de saveConcertAction en crear un bolo nou: l'enllaç de regidor
// ja hi és, amb un codi d'accés vàlid fins al dia de l'actuació (el gestor
// el pot canviar des de Comparteix) — mai per als altres tipus d'esdeveniment,
// que no es comparteixen amb ningú extern.
export async function autoCreateShareLinkForConcert(opts: {
  concertId: string;
  workspaceId: string;
  date: string;
  recipientName?: string;
  recipientEmail?: string;
}): Promise<void> {
  const id = newToken();
  const code = generateAccessCode();
  const codeDays = Math.max(1, Math.ceil((new Date(opts.date + "T23:59:59").getTime() - Date.now()) / 86400000));
  // L'enllaç en si es queda obert una setmana més enllà del bolo, per si cal
  // retocar-hi alguna dada després — el codi és qui de veres el tanca abans.
  const linkDays = codeDays + 7;
  await db().query(
    `insert into share_links (id, workspace_id, concert_id, scope, sections, is_default, recipient_email, recipient_name, expires_at, access_code, code_expires_at)
     values ($1,$2,$3,'both',$4,true,$5,$6, now() + ($7 || ' days')::interval, $8, now() + ($9 || ' days')::interval)`,
    [id, opts.workspaceId, opts.concertId, JSON.stringify(ALL_SHARE_SECTIONS), (opts.recipientEmail || "").trim(), (opts.recipientName || "").trim(), String(linkDays), code, String(codeDays)]
  );
}

// Backfill per a concerts que encara no tenen enllaç (creats abans
// d'aquesta funcionalitat, o per qualsevol camí que no passi per
// saveConcertAction) — es crida en carregar la fitxa del concert. Mira si
// l'enllaç per defecte ha existit MAI (encara que ara estigui revocat o
// caducat), no només si n'hi ha un actiu ara — si no, eliminar-lo en
// tornaria a crear un altre a l'instant a la següent càrrega de la pàgina.
export async function ensureShareLinkForConcert(concertId: string, workspaceId: string): Promise<void> {
  const c = (await db().query("select date, kind, contact from concerts where id=$1 and workspace_id=$2", [concertId, workspaceId])).rows[0];
  if (!c || (c.kind || "bolo") !== "bolo") return;
  const existing = (await db().query(
    "select 1 from share_links where concert_id=$1 and is_default limit 1",
    [concertId]
  )).rows[0];
  if (existing) return;
  const contact = c.contact || {};
  const dateStr = typeof c.date === "string" ? c.date.slice(0, 10) : c.date.toISOString().slice(0, 10);
  await autoCreateShareLinkForConcert({ concertId, workspaceId, date: dateStr, recipientName: contact.name, recipientEmail: contact.email });
}

// Validesa del codi d'accés triada pel gestor des de Comparteix: dies fixos,
// o els dies que falten fins al dia de l'actuació.
export type CodeValidity = "7" | "14" | "30" | "90" | "event";
function codeDaysFor(validity: CodeValidity, concertDate: string): number {
  if (validity === "event") return Math.max(1, Math.ceil((new Date(concertDate + "T23:59:59").getTime() - Date.now()) / 86400000));
  return Math.min(Math.max(parseInt(validity, 10), 1), 365);
}

// Regenera el codi d'un enllaç existent (o li en crea un si encara no en
// tenia — "Genera un codi d'accés" als enllaços d'abans d'aquesta funció).
export async function setShareLinkCodeAction(linkId: string, validity: CodeValidity): Promise<{ code: string; codeExpiresAt: string }> {
  const { workspaceId } = await requireManagerAction();
  const link = (await db().query(
    `select sl.concert_id, c.date from share_links sl join concerts c on c.id = sl.concert_id
     where sl.id=$1 and sl.workspace_id=$2`,
    [linkId, workspaceId]
  )).rows[0];
  if (!link) throw new Error("Enllaç no trobat");
  const concertDate = link.date ? (typeof link.date === "string" ? link.date.slice(0, 10) : link.date.toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
  const days = codeDaysFor(validity, concertDate);
  const code = generateAccessCode();
  const row = (await db().query(
    `update share_links set access_code=$1, code_expires_at = now() + ($2 || ' days')::interval
     where id=$3 and workspace_id=$4 returning code_expires_at`,
    [code, String(days), linkId, workspaceId]
  )).rows[0];
  revalidatePath(`/concerts/${link.concert_id}`);
  return { code, codeExpiresAt: row.code_expires_at };
}

// Creu de la fila "Codi d'accés": elimina el codi (torna a "sense codi"),
// mai l'enllaç en si — l'enllaç és permanent, només el codi es gestiona.
export async function clearShareLinkCodeAction(linkId: string): Promise<void> {
  const { workspaceId } = await requireManagerAction();
  const link = (await db().query(
    `update share_links set access_code=null, code_expires_at=null where id=$1 and workspace_id=$2 returning concert_id`,
    [linkId, workspaceId]
  )).rows[0];
  if (!link) throw new Error("Enllaç no trobat");
  revalidatePath(`/concerts/${link.concert_id}`);
}

// "Envia-ho a un altre contacte": canvia el destinatari de l'enllaç ja
// existent, en lloc de crear-ne un altre.
export async function updateShareLinkRecipientAction(linkId: string, name: string, email: string): Promise<void> {
  const { workspaceId } = await requireManagerAction();
  const link = (await db().query(
    `update share_links set recipient_name=$1, recipient_email=$2 where id=$3 and workspace_id=$4 returning concert_id`,
    [name.trim(), email.trim(), linkId, workspaceId]
  )).rows[0];
  if (!link) throw new Error("Enllaç no trobat");
  revalidatePath(`/concerts/${link.concert_id}`);
}

// Pública (sense sessió): valida el codi introduït a la pantalla d'avís i,
// si és correcte, retorna les dades del formulari — sense això, ShareLinkGate
// no munta mai PublicShareForm.
export async function verifyShareLinkAccessCodeAction(token: string, code: string): Promise<
  | { ok: true; data: PublicShareFormData }
  | { ok: false; error: string }
> {
  const link = (await db().query("select * from share_links where id=$1", [token])).rows[0];
  if (!link || link.revoked || new Date(link.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Aquest enllaç ja no és actiu." };
  }
  if (link.access_code) {
    if (!link.code_expires_at || new Date(link.code_expires_at).getTime() < Date.now()) {
      return { ok: false, error: "El codi ha caducat. Demana'n un de nou a qui t'ha compartit l'enllaç." };
    }
    if (String(code || "").trim().toUpperCase() !== link.access_code) {
      return { ok: false, error: "Codi incorrecte." };
    }
  }
  const data = await assemblePublicShareData(link);
  if (!data) return { ok: false, error: "Aquest concert ja no existeix." };
  return { ok: true, data };
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
  const rowSections: string[] = Array.isArray(row.sections) ? row.sections : ALL_SHARE_SECTIONS;
  const scopeLabel = shareSectionsLabel(rowSections) === "Tot" ? "la informació i el full de ruta" : shareSectionsLabel(rowSections);
  const hasCode = !!row.access_code && row.code_expires_at && new Date(row.code_expires_at).getTime() > Date.now();
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
        ${hasCode ? `<p style="color: #d9d6e8;">El codi d'accés és: <strong style="letter-spacing: 2px;">${row.access_code}</strong></p>` : ""}
        <p style="font-size: 12px; color: #7a7690;">Aquest enllaç és personal i caduca automàticament.</p>
      </div>`,
  });
  if (result.ok) {
    await db().query("update share_links set email_sent_at=now() where id=$1", [id]);
    revalidatePath(`/concerts/${row.concert_id}`);
  }
  return result;
}
