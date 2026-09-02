import { randomBytes } from "node:crypto";
import { db } from "./db";
import { normalize } from "./text";
import { appBaseUrl } from "./social-oauth";
import { sendEmail, emailConfigured } from "./email";

// L'agència = el workspace: els seus membres (gestors), les invitacions
// pendents i els enllaços per entrar-hi.

export type AgencyMember = {
  clerkUserId: string;
  name: string;
  email: string;
  agencyRole: string;
  agencyOwner: boolean;
  canCreateGroups: boolean;
  viewAllGroups: boolean;
  assignedBandIds: string[];
  photoFileId: string | null;
};

export type AgencyInvitation = {
  id: string;
  email: string;
  name: string;
  roleLabel: string;
  canCreateGroups: boolean;
  viewAllGroups: boolean;
  assignedBandIds: string[];
  status: string;
  createdAt: string;
  url: string;
};

export type AgencyInvitePerms = { canCreateGroups?: boolean; viewAllGroups?: boolean; assignedBandIds?: string[] };
export type AgencyInviteInput = { name: string; role: string; email: string } & AgencyInvitePerms;

export function agencyInviteUrl(id: string): string {
  return `${appBaseUrl()}/j/${id}`;
}
export function bandInviteUrl(token: string): string {
  return `${appBaseUrl()}/i/${token}`;
}

function iso(v: Date | string): string {
  return typeof v === "string" ? v : v.toISOString();
}

export async function getAgencyMembers(workspaceId: string): Promise<AgencyMember[]> {
  const pool = db();
  const [{ rows }, { rows: photos }] = await Promise.all([
    pool.query(
      `select clerk_user_id, name, email, agency_role, agency_owner, can_create_groups, view_all_groups, assigned_band_ids
       from profiles where workspace_id=$1 and role='manager' order by agency_owner desc, created_at`,
      [workspaceId]
    ),
    pool.query("select person_name, photo_file_id from person_profiles where workspace_id=$1 and photo_file_id is not null", [workspaceId]),
  ]);
  const photoByName: Record<string, string> = {};
  photos.forEach((p) => { photoByName[normalize(p.person_name)] = p.photo_file_id; });
  return rows.map((r) => ({
    clerkUserId: r.clerk_user_id,
    name: r.name,
    email: r.email,
    agencyRole: r.agency_role || "",
    agencyOwner: !!r.agency_owner,
    canCreateGroups: !!r.agency_owner || r.can_create_groups !== false,
    viewAllGroups: !!r.agency_owner || r.view_all_groups !== false,
    assignedBandIds: r.assigned_band_ids || [],
    photoFileId: photoByName[normalize(r.name)] || null,
  }));
}

export async function getAgencyInvitations(workspaceId: string): Promise<AgencyInvitation[]> {
  const { rows } = await db().query(
    "select * from agency_invitations where workspace_id=$1 and status='pendent' order by created_at desc",
    [workspaceId]
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email || "",
    name: r.name || "",
    roleLabel: r.role_label || "",
    canCreateGroups: r.can_create_groups !== false,
    viewAllGroups: r.view_all_groups !== false,
    assignedBandIds: r.assigned_band_ids || [],
    status: r.status,
    createdAt: iso(r.created_at),
    url: agencyInviteUrl(r.id),
  }));
}

export type AgencyInvitationDetail = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceLogo: string;
  name: string;
  email: string;
  roleLabel: string;
  status: string;
  invitedBy: string;
};

export async function getAgencyInvitation(token: string): Promise<AgencyInvitationDetail | null> {
  const r = (await db().query(
    `select ai.*, w.name as ws_name, w.logo as ws_logo from agency_invitations ai
     join workspaces w on w.id = ai.workspace_id where ai.id=$1`,
    [token]
  )).rows[0];
  if (!r) return null;
  return {
    id: r.id, workspaceId: r.workspace_id, workspaceName: r.ws_name || "", workspaceLogo: r.ws_logo || "",
    name: r.name || "", email: r.email || "", roleLabel: r.role_label || "", status: r.status, invitedBy: r.invited_by || "",
  };
}

// Crea les invitacions a l'agència (una per persona) i, si el correu està
// configurat i la persona té adreça, li envia l'enllaç.
export async function createAgencyInvitations(workspaceId: string, invitedBy: string, list: AgencyInviteInput[]): Promise<{ id: string; name: string; email: string; url: string }[]> {
  const pool = db();
  const ws = (await pool.query("select name from workspaces where id=$1", [workspaceId])).rows[0];
  const out: { id: string; name: string; email: string; url: string }[] = [];
  for (const item of list) {
    const name = (item.name || "").trim();
    const email = (item.email || "").trim().toLowerCase();
    if (!name && !email) continue;
    const id = "ag_" + randomBytes(9).toString("base64url");
    await pool.query(
      `insert into agency_invitations (id, workspace_id, email, name, role_label, can_create_groups, view_all_groups, assigned_band_ids, invited_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, workspaceId, email, name, (item.role || "").trim(), item.canCreateGroups !== false, item.viewAllGroups !== false,
        JSON.stringify(item.assignedBandIds || []), invitedBy]
    );
    const url = agencyInviteUrl(id);
    if (email && email.includes("@") && emailConfigured()) {
      await sendEmail({
        to: email,
        subject: `${ws?.name || "Escenari"}: t'han convidat a l'agència`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #12101f; color: #f5f4fa; padding: 32px; border-radius: 16px;">
            <div style="letter-spacing: 4px; font-size: 13px; color: #a99df5; margin-bottom: 24px;">ESCENARI</div>
            <h2 style="margin: 0 0 8px; font-size: 20px;">${ws?.name || "Agència"}</h2>
            <p style="color: #d9d6e8; line-height: 1.5;">Hola${name ? " " + name : ""},<br/><br/>${invitedBy || "L'agència"} et convida a gestionar-hi els grups des d'Escenari${item.role ? " com a " + item.role : ""}.</p>
            <a href="${url}" style="display: inline-block; background: #8b7bff; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; margin: 16px 0;">Uneix-m'hi</a>
            <p style="font-size: 12px; color: #7a7690;">Aquest enllaç és personal.</p>
          </div>`,
      }).catch(() => { /* el correu és un extra: l'enllaç es pot passar a mà */ });
    }
    out.push({ id, name, email, url });
  }
  return out;
}
