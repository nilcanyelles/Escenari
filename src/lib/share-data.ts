import { db } from "./db";
import { ALL_SHARE_SECTIONS } from "./share-sections";

export type ShareLink = {
  id: string;
  concertId: string;
  scope: "info" | "ruta" | "both";
  // Seccions concretes que aquest enllaç deixa veure/omplir — l'origen de
  // veritat des de la introducció d'enllaços amb abast fi; "scope" es
  // manté per compatibilitat amb el que ja hi havia.
  sections: string[];
  // L'enllaç que es crea sol en fer un bolo nou (tot l'abast, permanent) —
  // els altres, creats a mà des de "+ Generar enllaç", no ho són.
  isDefault: boolean;
  recipientEmail: string;
  recipientName: string;
  expiresAt: string;
  revoked: boolean;
  lastOpenedAt: string | null;
  submittedAt: string | null;
  emailSentAt: string | null;
  createdAt: string;
  // Codi d'accés de la pantalla d'avís (/f/[token]) — null = enllaç sense
  // codi, obert amb l'enllaç sol (compatibilitat amb els d'abans).
  accessCode: string | null;
  codeExpiresAt: string | null;
  // Cops que s'ha obert el formulari — mai es reinicia en canviar/eliminar
  // el codi d'accés, és del formulari en si.
  openCount: number;
};

function iso(v: Date | string | null): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.toISOString();
}

function mapRow(r: Record<string, unknown>): ShareLink {
  return {
    id: r.id as string,
    concertId: r.concert_id as string,
    scope: r.scope as ShareLink["scope"],
    sections: Array.isArray(r.sections) ? r.sections as string[] : ALL_SHARE_SECTIONS,
    isDefault: !!r.is_default,
    recipientEmail: (r.recipient_email as string) || "",
    recipientName: (r.recipient_name as string) || "",
    expiresAt: iso(r.expires_at as Date | string)!,
    revoked: !!r.revoked,
    lastOpenedAt: iso(r.last_opened_at as Date | string | null),
    submittedAt: iso(r.submitted_at as Date | string | null),
    emailSentAt: iso(r.email_sent_at as Date | string | null),
    createdAt: iso(r.created_at as Date | string)!,
    accessCode: (r.access_code as string | null) || null,
    codeExpiresAt: iso(r.code_expires_at as Date | string | null),
    openCount: Number(r.open_count) || 0,
  };
}

export async function getShareLinks(workspaceId: string, concertId: string): Promise<ShareLink[]> {
  const { rows } = await db().query(
    "select * from share_links where workspace_id=$1 and concert_id=$2 order by created_at desc",
    [workspaceId, concertId]
  );
  return rows.map(mapRow);
}

export function shareLinkStatus(l: ShareLink): "activa" | "caducada" | "revocada" {
  if (l.revoked) return "revocada";
  if (new Date(l.expiresAt).getTime() < Date.now()) return "caducada";
  return "activa";
}

// Estat del codi d'accés de la pantalla d'avís (independent de l'estat de
// l'enllaç en si): "cap" si l'enllaç encara no en té (compatibilitat amb
// els d'abans, oberts amb l'enllaç sol).
export function shareLinkCodeStatus(l: ShareLink): "cap" | "vigent" | "caducat" {
  if (!l.accessCode) return "cap";
  if (!l.codeExpiresAt || new Date(l.codeExpiresAt).getTime() < Date.now()) return "caducat";
  return "vigent";
}
