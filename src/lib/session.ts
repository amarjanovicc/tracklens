import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "@/db";
import { user } from "@/db/schema";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  plan: "free" | "pro";
  stripeCustomerId: string | null;
};

/** Data Access Layer: the single place that turns a request into a user. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  // Read plan/timezone fresh from the DB, the cookie cache may be stale.
  const [row] = await db.select().from(user).where(eq(user.id, s.user.id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    timezone: row.timezone,
    plan: row.plan === "pro" ? "pro" : "free",
    stripeCustomerId: row.stripeCustomerId,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/sign-in");
  return u;
}
