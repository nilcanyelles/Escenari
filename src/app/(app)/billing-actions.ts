"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
import { appBaseUrl } from "@/lib/social-oauth";
import { getStripe, stripeConfigured, priceIdFor, founderPriceId, type Interval } from "@/lib/stripe";
import { PLANS, type PlanKey } from "@/lib/plans";

// Pagaments: Checkout de Stripe per contractar un pla, portal del client per
// gestionar-lo. Només qui mana a l'agència.

async function requireOwner() {
  const p = await requireManagerAction();
  if (!p.agencyOwner) throw new Error("Només qui mana a l'agència pot canviar el pla");
  return p;
}

async function ensureCustomer(workspaceId: string, email: string, name: string): Promise<string> {
  const ws = (await db().query("select stripe_customer_id, name from workspaces where id=$1", [workspaceId])).rows[0];
  if (ws?.stripe_customer_id) return ws.stripe_customer_id;
  const customer = await getStripe().customers.create({
    email: email || undefined,
    name: ws?.name || name || undefined,
    metadata: { workspaceId },
  });
  await db().query("update workspaces set stripe_customer_id=$1 where id=$2 and stripe_customer_id is null", [customer.id, workspaceId]);
  return customer.id;
}

export async function createCheckoutSessionAction(plan: PlanKey, interval: Interval): Promise<{ url?: string; error?: string }> {
  const p = await requireOwner();
  if (!stripeConfigured()) return { error: "Els pagaments encara no estan activats." };
  const priceId = priceIdFor(plan, interval);
  if (!priceId) return { error: `El pla ${PLANS[plan].label} encara no té preu configurat.` };
  const customer = await ensureCustomer(p.workspaceId, p.email, p.name);
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: p.workspaceId,
    subscription_data: { metadata: { workspaceId: p.workspaceId, plan } },
    allow_promotion_codes: true,
    success_url: `${appBaseUrl()}/configuracio?billing=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl()}/configuracio?billing=cancel`,
    locale: "es",
  });
  return { url: session.url || undefined };
}

// "Membre fundador": pagament únic, Grup de per vida.
export async function createFounderCheckoutAction(): Promise<{ url?: string; error?: string }> {
  const p = await requireOwner();
  if (!stripeConfigured()) return { error: "Els pagaments encara no estan activats." };
  const priceId = founderPriceId();
  if (!priceId) return { error: "L'oferta de fundador no està disponible." };
  const customer = await ensureCustomer(p.workspaceId, p.email, p.name);
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: p.workspaceId,
    metadata: { workspaceId: p.workspaceId, founder: "1" },
    allow_promotion_codes: true,
    success_url: `${appBaseUrl()}/configuracio?billing=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl()}/configuracio?billing=cancel`,
    locale: "es",
  });
  return { url: session.url || undefined };
}

export async function createPortalSessionAction(): Promise<{ url?: string; error?: string }> {
  const p = await requireOwner();
  if (!stripeConfigured()) return { error: "Els pagaments encara no estan activats." };
  const ws = (await db().query("select stripe_customer_id from workspaces where id=$1", [p.workspaceId])).rows[0];
  if (!ws?.stripe_customer_id) return { error: "Encara no hi ha cap subscripció." };
  const session = await getStripe().billingPortal.sessions.create({
    customer: ws.stripe_customer_id,
    return_url: `${appBaseUrl()}/configuracio`,
  });
  revalidatePath("/configuracio");
  return { url: session.url };
}
