import "server-only";
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
export const auth = betterAuth({
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
