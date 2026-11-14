import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { importJob, play, user } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

const Body = z.object({ scope: z.enum(["plays", "account"]) });

export async function DELETE(req: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  if (parsed.data.scope === "plays") {
    await db.delete(play).where(eq(play.userId, me.id));
    await db.delete(importJob).where(eq(importJob.userId, me.id));
    return Response.json({ ok: true });
  }

  // Account: cancel any subscription first so nobody keeps getting billed.
  const [row] = await db.select({ sub: user.stripeSubscriptionId }).from(user).where(eq(user.id, me.id));
  const stripe = getStripe();
  if (stripe && row?.sub) {
    try {
      await stripe.subscriptions.cancel(row.sub);
    } catch {
      return Response.json(
        { error: "Could not cancel your subscription. Please try again or contact support." },
        { status: 502 },
      );
    }
  }
  // Cascades to sessions, accounts, plays, playlists tracked, share links, Spotify tokens.
  await db.delete(user).where(eq(user.id, me.id));
  return Response.json({ ok: true });
}
