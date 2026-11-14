import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { billingNotConfigured, getStripe, periodEnd, planForStatus } from "@/lib/stripe";

async function applySubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const plan = planForStatus(sub.status);
  const values = {
    plan,
    stripeSubscriptionId: plan === "pro" ? sub.id : null,
    planRenewsAt: plan === "pro" ? periodEnd(sub) : null,
    stripeCustomerId: customerId,
  };
  const userId = sub.metadata?.userId;
  if (userId) await db.update(user).set(values).where(eq(user.id, userId));
  else await db.update(user).set(values).where(eq(user.stripeCustomerId, customerId));
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return billingNotConfigured();

  const signature = req.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.mode === "subscription" && s.subscription) {
        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        if (!sub.metadata?.userId && s.client_reference_id) {
          sub.metadata = { ...sub.metadata, userId: s.client_reference_id };
        }
        await applySubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(event.data.object);
      break;
  }
  return Response.json({ received: true });
}
