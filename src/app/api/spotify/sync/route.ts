import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { spotifyConnection } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { syncRecent } from "@/lib/spotify/sync";

/** Manual "Sync now", throttled to once per 2 minutes. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const [c] = await db.select().from(spotifyConnection).where(eq(spotifyConnection.userId, user.id)).limit(1);
  if (!c) return NextResponse.json({ error: "Spotify is not connected" }, { status: 400 });
  if (c.lastSyncedAt && Date.now() - c.lastSyncedAt.getTime() < 120_000) {
    return NextResponse.json({ error: "Synced less than 2 minutes ago" }, { status: 429 });
  }
  return NextResponse.json(await syncRecent(user.id));
}
