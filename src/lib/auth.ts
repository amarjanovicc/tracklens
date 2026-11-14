import "server-only";
import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { schema } from "@/db/schema";

/**
 * Primary sign-in is email + password. Spotify is *linked* separately
 * (see /api/spotify/*) because since Feb 2026 the Spotify user object no
 * longer carries an email, and Development-Mode apps are capped at 5 users;
 * the product must work without Spotify OAuth for everyone else.
 */
// On Vercel the production URL is exposed automatically, so no URL env var is needed.
const baseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);

// Prefer an explicit BETTER_AUTH_SECRET. Fallback: derive one from the database
// URL, which already contains a private credential, so first deploys work
// without extra setup. Rotating the DB password rotates the secret (sessions end).
const secret =
  process.env.BETTER_AUTH_SECRET ??
  (process.env.DATABASE_URL
    ? createHash("sha256").update(`tracklens:auth:${process.env.DATABASE_URL}`).digest("hex")
    : undefined);

export const auth = betterAuth({
  baseURL,
  secret,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, defaultValue: "UTC", input: true },
      plan: { type: "string", required: false, defaultValue: "free", input: false },
    },
  },
  session: { cookieCache: { enabled: true, maxAge: 60 * 5 } },
  plugins: [nextCookies()],
});
