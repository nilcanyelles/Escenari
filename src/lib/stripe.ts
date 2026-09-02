import Stripe from "stripe";
import { db } from "./db";
import { PAID_PLANS, isPlanKey, type PlanKey } from "./plans";

// Stripe: un client per procés, els identificadors de preu des de l'entorn
// (un per pla i periodicitat) i la sincronització subscripció → workspace.

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let client: Stripe | null = null;
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe no està configurat (STRIPE_SECRET_KEY)");
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export type Interval = "monthly" | "yearly";

const PRICE_ENV: Record<Exclude<PlanKey, "free">, Record<Interval, string>> = {
  grup: { monthly: "STRIPE_PRICE_GRUP_MONTHLY", yearly: "STRIPE_PRICE_GRUP_YEARLY" },
  agencia_s: { monthly: "STRIPE_PRICE_AGENCIA_S_MONTHLY", yearly: "STRIPE_PRICE_AGENCIA_S_YEARLY" },
  agencia_m: { monthly: "STRIPE_PRICE_AGENCIA_M_MONTHLY", yearly: "STRIPE_PRICE_AGENCIA_M_YEARLY" },
  agencia_l: { monthly: "STRIPE_PRICE_AGENCIA_L_MONTHLY", yearly: "STRIPE_PRICE_AGENCIA_L_YEARLY" },
  agencia_xl: { monthly: "STRIPE_PRICE_AGENCIA_XL_MONTHLY", yearly: "STRIPE_PRICE_AGENCIA_XL_YEARLY" },
};

export function priceIdFor(plan: PlanKey, interval: Interval): string | null {
  if (plan === "free") return null;
  return process.env[PRICE_ENV[plan][interval]] || null;
}

export function founderPriceId(): string | null {
  return process.env.STRIPE_PRICE_FOUNDER || null;
}

// Preu de Stripe → pla (per llegir la subscripció que arriba pel webhook).
export function planForPriceId(priceId: string): { plan: PlanKey; interval: Interval } | null {
  for (const plan of PAID_PLANS) {
    if (plan === "free") continue;
    for (const interval of ["monthly", "yearly"] as Interval[]) {
      if (priceIdFor(plan, interval) === priceId) return { plan, interval };
    }
  }
  return null;
}

// Desa al workspace l'estat d'una subscripció de Stripe.
export async function syncWorkspaceFromSubscription(workspaceId: string, sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price?.id || "";
  const mapped = planForPriceId(priceId);
  const plan: PlanKey = mapped?.plan || (isPlanKey(sub.metadata?.plan) ? (sub.metadata.plan as PlanKey) : "free");
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  await db().query(
    `update workspaces set plan=$1, plan_status=$2, stripe_customer_id=coalesce($3, stripe_customer_id),
       stripe_subscription_id=$4, current_period_end=$5
     where id=$6`,
    [plan, sub.status, customerId, sub.id, periodEnd, workspaceId]
  );
}

export async function workspaceIdForCustomer(customerId: string): Promise<string | null> {
  const row = (await db().query("select id from workspaces where stripe_customer_id=$1", [customerId])).rows[0];
  return row?.id || null;
}

// Després de tornar del Checkout (abans que arribi el webhook): llegeix la
// sessió i aplica el que s'hi ha comprat.
export async function syncCheckoutSession(workspaceId: string, sessionId: string): Promise<boolean> {
  if (!stripeConfigured()) return false;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== workspaceId) return false;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
  if (session.mode === "subscription" && session.subscription) {
    const sub = typeof session.subscription === "string" ? await stripe.subscriptions.retrieve(session.subscription) : session.subscription;
    await syncWorkspaceFromSubscription(workspaceId, sub);
    return true;
  }
  if (session.mode === "payment" && session.payment_status === "paid" && session.metadata?.founder === "1") {
    await db().query("update workspaces set founder=true, stripe_customer_id=coalesce($1, stripe_customer_id) where id=$2", [customerId, workspaceId]);
    return true;
  }
  return false;
}
