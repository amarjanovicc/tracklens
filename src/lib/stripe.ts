import "server-only";
import Stripe from "stripe";

let client: Stripe | null | undefined;

/** Lazy Stripe client. Returns null when billing is not configured. */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key, { appInfo: { name: "Tracklens" } }) : null;
  return client;
}

export const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

export function priceFor(interval: "month" | "year") {
  return interval === "year" ? process.env.STRIPE_PRICE_PRO_YEARLY : process.env.STRIPE_PRICE_PRO_MONTHLY;
}

/** Pro while the subscription is in a paying (or grace) state. */
export function planForStatus(status: Stripe.Subscription.Status): "pro" | "free" {
  return status === "active" || status === "trialing" || status === "past_due" ? "pro" : "free";
}

/** Since API 2025-03, the billing period lives on subscription items. */
export function periodEnd(sub: Stripe.Subscription): Date | null {
  const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
  return ends.length ? new Date(Math.max(...ends) * 1000) : null;
}

export const billingNotConfigured = () =>
  Response.json({ error: "Billing is not configured on this server." }, { status: 503 });
