import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { appUrl, billingNotConfigured, getStripe, priceFor } from "@/lib/stripe";

const Body = z.object({ interval: z.enum(["month", "year"]).default("month") });

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return billingNotConfigured();
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const price = priceFor(parsed.data.interval);
  if (!price) return Response.json({ error: "Price is not configured" }, { status: 503 });
  if (me.plan === "pro") return Response.json({ error: "You are already on Pro" }, { status: 409 });

  let customerId = me.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: me.email, name: me.name, metadata: { userId: me.id } });
    customerId = customer.id;
    await db.update(user).set({ stripeCustomerId: customerId }).where(eq(user.id, me.id));
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: me.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { userId: me.id } },
    success_url: `${appUrl()}/app/settings?billing=success`,
    cancel_url: `${appUrl()}/app/settings?billing=cancelled`,
  });
  return Response.json({ url: session.url });
}
