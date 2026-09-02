import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe, stripeConfigured, syncWorkspaceFromSubscription, workspaceIdForCustomer } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Webhook de Stripe: manté el pla del workspace al dia (alta, canvis,
// baixes, impagaments). Verifica la signatura i no processa mai dos cops
// el mateix esdeveniment.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) return NextResponse.json({ ok: false, error: "Stripe no configurat" }, { status: 400 });
  const sig = req.headers.get("stripe-signature") || "";
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Signatura no vàlida" }, { status: 400 });
  }

  const fresh = (await db().query(
    "insert into billing_events (id, type) values ($1, $2) on conflict (id) do nothing returning id",
    [event.id, event.type]
  )).rows[0];
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });

  const stripe = getStripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const wsId = session.client_reference_id || session.metadata?.workspaceId || null;
      if (!wsId) break;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
      if (session.mode === "subscription" && session.subscription) {
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncWorkspaceFromSubscription(wsId, sub);
      } else if (session.mode === "payment" && session.metadata?.founder === "1") {
        await db().query("update workspaces set founder=true, stripe_customer_id=coalesce($1, stripe_customer_id) where id=$2", [customerId, wsId]);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const wsId = sub.metadata?.workspaceId || (await workspaceIdForCustomer(customerId));
      if (wsId) await syncWorkspaceFromSubscription(wsId, sub);
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id || null;
      if (customerId) await db().query("update workspaces set plan_status='past_due' where stripe_customer_id=$1 and plan_status in ('active','trialing')", [customerId]);
      break;
    }
    default:
      break;
  }
  return NextResponse.json({ ok: true });
}
