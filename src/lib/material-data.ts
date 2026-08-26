import { db } from "./db";
import { normalizeRiderContent, type Rider, type Setlist, type BandEditor, type RiderApproval } from "./material-types";

function iso(v: Date | string): string {
  return typeof v === "string" ? v : v.toISOString();
}

export async function getRiders(bandId: string): Promise<Rider[]> {
  const { rows } = await db().query("select * from riders where band_id=$1 order by created_at", [bandId]);
  return rows.map((r) => ({
    id: r.id,
    bandId: r.band_id,
    name: r.name,
    content: normalizeRiderContent(r.content),
    publicToken: r.public_token,
    updatedAt: iso(r.updated_at),
  }));
}

export async function getSetlists(bandId: string): Promise<Setlist[]> {
  const { rows } = await db().query("select * from setlists where band_id=$1 order by created_at", [bandId]);
  return rows.map((r) => ({
    id: r.id,
    bandId: r.band_id,
    name: r.name,
    songs: r.songs || [],
    publicToken: r.public_token,
    updatedAt: iso(r.updated_at),
  }));
}

export async function getBandEditors(bandId: string): Promise<BandEditor[]> {
  const { rows } = await db().query("select * from band_editors where band_id=$1", [bandId]);
  return rows.map((r) => ({
    clerkUserId: r.clerk_user_id,
    canRiders: !!r.can_riders,
    canSetlists: !!r.can_setlists,
  }));
}

export async function getRiderApprovals(workspaceId: string, concertId: string): Promise<RiderApproval[]> {
  const { rows } = await db().query(
    "select * from rider_approvals where workspace_id=$1 and concert_id=$2 order by created_at desc",
    [workspaceId, concertId]
  );
  return rows.map((r) => ({
    id: r.id,
    concertId: r.concert_id,
    riderId: r.rider_id,
    recipientName: r.recipient_name || "",
    recipientEmail: r.recipient_email || "",
    status: r.status,
    counterNote: r.counter_note || "",
    hasCounter: !!r.counter_content,
    emailSentAt: r.email_sent_at ? iso(r.email_sent_at) : null,
    approvedAt: r.approved_at ? iso(r.approved_at) : null,
    createdAt: iso(r.created_at),
  }));
}

// Grups on un artista té permís d'edició de riders o setlists.
export async function getArtistEditableBands(clerkUserId: string): Promise<Record<string, { canRiders: boolean; canSetlists: boolean }>> {
  const { rows } = await db().query(
    "select band_id, can_riders, can_setlists from band_editors where clerk_user_id=$1",
    [clerkUserId]
  );
  const map: Record<string, { canRiders: boolean; canSetlists: boolean }> = {};
  rows.forEach((r) => { map[r.band_id] = { canRiders: !!r.can_riders, canSetlists: !!r.can_setlists }; });
  return map;
}
