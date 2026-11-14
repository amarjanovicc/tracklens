import "server-only";
import { eq } from "drizzle-orm";
import { db, sql } from "@/db";
import { spotifyConnection, user as userTable } from "@/db/schema";
import { limitsFor } from "@/lib/plans";
import { getUserToken, spotifyGet, SpotifyError, type RecentlyPlayed } from "./client";

/**
 * Pulls /me/player/recently-played (max 50 items, Spotify keeps no more) and
 * stores new plays. Run often enough (≤ hourly) that 50 plays never overflow.
 * ms_played is the track duration: the endpoint does not report partial plays,
 * so skip analysis relies on imported data.
 */
export async function syncRecent(userId: string) {
  const [conn] = await db.select().from(spotifyConnection).where(eq(spotifyConnection.userId, userId)).limit(1);
  if (!conn) return { inserted: 0, skipped: "not connected" as const };
  try {
    const token = await getUserToken(userId);
    if (!token) return { inserted: 0 };
    const after = conn.lastSyncedAt ? `&after=${conn.lastSyncedAt.getTime() - 3_600_000}` : "";
    const data = await spotifyGet<RecentlyPlayed>(token, `/me/player/recently-played?limit=50${after}`);
    const rows = data.items
      .filter((i) => i.track?.name && i.track.artists?.length)
      .map((i) => ({
        user_id: userId,
        played_at: i.played_at,
        ms_played: i.track.duration_ms,
        kind: "track",
        track_uri: i.track.uri,
        track_name: i.track.name,
        artist_name: i.track.artists[0].name,
        album_name: i.track.album?.name ?? null,
        skipped: false,
        source: "api",
      }));
    let inserted = 0;
    if (rows.length) {
      const res = await sql`insert into play ${sql(rows)} on conflict do nothing`;
      inserted = res.count;
    }
    await db.update(spotifyConnection).set({ lastSyncedAt: new Date(), lastError: null }).where(eq(spotifyConnection.userId, userId));
    return { inserted };
  } catch (e) {
    const msg = e instanceof SpotifyError && e.status === 403
      ? "Spotify refused access. In Development Mode only allow-listed users (max 5) can be synced."
      : e instanceof Error ? e.message.slice(0, 300) : "Sync failed";
    await db.update(spotifyConnection).set({ lastError: msg }).where(eq(spotifyConnection.userId, userId));
    return { inserted: 0, error: msg };
  }
}

/** Cron entry point: syncs every connected user whose plan includes live sync. */
export async function syncAll() {
  const rows = await db
    .select({ userId: spotifyConnection.userId, plan: userTable.plan })
    .from(spotifyConnection)
    .innerJoin(userTable, eq(userTable.id, spotifyConnection.userId));
  let users = 0, inserted = 0, errors = 0;
  for (const r of rows) {
    if (!limitsFor(r.plan).liveSync) continue;
    const res = await syncRecent(r.userId);
    users++;
    inserted += res.inserted;
    if ("error" in res && res.error) errors++;
  }
  return { users, inserted, errors };
}
