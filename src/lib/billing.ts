import { db } from "./db";
import { PLANS, isPlanKey, planForFeature, type PlanKey, type Feature, type BillingInfo } from "./plans";

// Estat de facturació d'un workspace i els límits que se'n deriven. Les
// accions del servidor hi comproven el pla abans de fer res (la interfície
// ja ho mostra bloquejat, això és la segona barrera).

type WorkspaceBillingRow = {
  plan: string;
  plan_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: Date | string | null;
  trial_ends_at: Date | string | null;
  founder: boolean;
};

function iso(v: Date | string | null): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.toISOString();
}

// Pla que s'aplica de veres: contractat i vigent > prova (Agència S, sense
// targeta) > fundador (Grup de per vida) > gratuït.
export function computeEffective(row: WorkspaceBillingRow, now = Date.now()): PlanKey {
  const plan: PlanKey = isPlanKey(row.plan) ? row.plan : "free";
  if (row.plan_status === "comped") return plan === "free" ? "agencia_xl" : plan;
  if (plan !== "free" && ["active", "trialing", "past_due"].includes(row.plan_status)) return plan;
  if (row.trial_ends_at && new Date(row.trial_ends_at).getTime() > now) return "agencia_s";
  return row.founder ? "grup" : "free";
}

export async function getWorkspaceBilling(workspaceId: string): Promise<BillingInfo> {
  const row = (await db().query(
    "select plan, plan_status, stripe_customer_id, stripe_subscription_id, current_period_end, trial_ends_at, founder from workspaces where id=$1",
    [workspaceId]
  )).rows[0] as WorkspaceBillingRow | undefined;
  const r: WorkspaceBillingRow = row || { plan: "free", plan_status: "none", stripe_customer_id: null, stripe_subscription_id: null, current_period_end: null, trial_ends_at: null, founder: false };
  const effective = computeEffective(r);
  const trialActive = !!r.trial_ends_at && new Date(r.trial_ends_at).getTime() > Date.now() && !(isPlanKey(r.plan) && r.plan !== "free" && ["active", "trialing", "past_due", "comped"].includes(r.plan_status));
  return {
    plan: isPlanKey(r.plan) ? r.plan : "free",
    effective,
    status: r.plan_status,
    trialActive,
    trialEndsAt: iso(r.trial_ends_at),
    currentPeriodEnd: iso(r.current_period_end),
    founder: !!r.founder,
    hasSubscription: !!r.stripe_subscription_id,
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    founderAvailable: !!process.env.STRIPE_PRICE_FOUNDER,
    caps: PLANS[effective],
  };
}

export async function checkPlan(workspaceId: string, feature: Feature): Promise<{ allowed: boolean; required: PlanKey; effective: PlanKey }> {
  const b = await getWorkspaceBilling(workspaceId);
  return { allowed: !!b.caps[feature], required: planForFeature(feature), effective: b.effective };
}

// Llança si el pla no inclou la funció (les accions del servidor ho fan
// servir com a barrera; la interfície ja ho ha mostrat bloquejat abans).
export async function requireFeature(workspaceId: string, feature: Feature) {
  const r = await checkPlan(workspaceId, feature);
  if (!r.allowed) throw new Error(`Aquesta funció necessita el pla ${PLANS[r.required].label}`);
}

export async function groupCap(workspaceId: string): Promise<{ count: number; cap: number | null; reached: boolean }> {
  const [b, { rows }] = await Promise.all([
    getWorkspaceBilling(workspaceId),
    db().query("select count(*)::int as n from bands where workspace_id=$1", [workspaceId]),
  ]);
  const count = rows[0].n as number;
  const cap = b.caps.groups;
  return { count, cap, reached: cap != null && count >= cap };
}

// Enllaços de formulari actius (no revocats ni caducats) del grup d'un concert.
export async function activeLinksForConcert(workspaceId: string, concertId: string): Promise<{ count: number; cap: number | null; reached: boolean }> {
  const [b, { rows }] = await Promise.all([
    getWorkspaceBilling(workspaceId),
    db().query(
      `select count(*)::int as n from share_links sl
       join concerts c on c.id = sl.concert_id
       where sl.workspace_id=$1 and not sl.revoked and sl.expires_at > now()
         and c.band_id = (select band_id from concerts where id=$2)`,
      [workspaceId, concertId]
    ),
  ]);
  const count = rows[0].n as number;
  const cap = b.caps.activeLinks;
  return { count, cap, reached: cap != null && count >= cap };
}

// Pistes d'àudio per cançó segons el pla del workspace del grup — o, per a
// les cançons pròpies d'un músic, del seu workspace (si en té).
export async function tracksPerSongCap(bandId: string | null, ownerClerkUserId?: string | null): Promise<number> {
  let workspaceId: string | null = null;
  if (bandId) {
    workspaceId = (await db().query("select workspace_id from bands where id=$1", [bandId])).rows[0]?.workspace_id || null;
  } else if (ownerClerkUserId) {
    workspaceId = (await db().query("select workspace_id from profiles where clerk_user_id=$1", [ownerClerkUserId])).rows[0]?.workspace_id || null;
  }
  if (!workspaceId) return PLANS.free.tracksPerSong;
  const b = await getWorkspaceBilling(workspaceId);
  return b.caps.tracksPerSong;
}
