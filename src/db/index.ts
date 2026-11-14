import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema";

const globalForDb = globalThis as unknown as {
  pgOrm?: ReturnType<typeof postgres>;
  pgRaw?: ReturnType<typeof postgres>;
};

const opts = {
  max: process.env.NODE_ENV === "production" ? 4 : 8,
  prepare: false, // compatible with transaction-mode poolers (Neon, Supabase)
};

// Two clients on purpose: Drizzle rewrites the type parsers of the client it
// wraps (timestamps come back as strings), while the analytics layer wants
// postgres.js defaults (Date objects).
const ormClient = globalForDb.pgOrm ?? postgres(process.env.DATABASE_URL!, opts);
const rawClient = globalForDb.pgRaw ?? postgres(process.env.DATABASE_URL!, opts);
if (process.env.NODE_ENV !== "production") {
  globalForDb.pgOrm = ormClient;
  globalForDb.pgRaw = rawClient;
}

export const db = drizzle(ormClient, { schema });
/** Raw tagged-template client for hand-written analytics SQL. */
export const sql = rawClient;
