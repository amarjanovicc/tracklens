import { getCurrentUser } from "@/lib/session";
import { appUrl, billingNotConfigured, getStripe } from "@/lib/stripe";

export async function POST() {
  const stripe = getStripe();
  if (!stripe) return billingNotConfigured();
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!me.stripeCustomerId) return Response.json({ error: "No billing account yet" }, { status: 400 });
  const portal = await stripe.billingPortal.sessions.create({
    customer: me.stripeCustomerId,
    return_url: `${appUrl()}/app/settings`,
  });
  return Response.json({ url: portal.url });
}
