import { db } from "./db";

export type ShareLink = {
  id: string;
  concertId: string;
  scope: "info" | "ruta" | "both";
  recipientEmail: string;
  recipientName: string;
  expiresAt: string;
  revoked: boolean;
  lastOpenedAt: string | null;
  submittedAt: string | null;
  emailSentAt: string | null;
  createdAt: string;
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
    recipientEmail: (r.recipient_email as string) || "",
    recipientName: (r.recipient_name as string) || "",
    expiresAt: iso(r.expires_at as Date | string)!,
    revoked: !!r.revoked,
    lastOpenedAt: iso(r.last_opened_at as Date | string | null),
    submittedAt: iso(r.submitted_at as Date | string | null),
    emailSentAt: iso(r.email_sent_at as Date | string | null),
    createdAt: iso(r.created_at as Date | string)!,
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
