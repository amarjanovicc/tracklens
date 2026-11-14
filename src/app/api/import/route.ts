import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, sql } from "@/db";
import { importJob } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

/**
 * Chunked import. The browser parses the export and posts normalised plays
 * in batches (≤ 2000 rows ≈ 600 KB, well under serverless body limits).
 *   { action: "start", files }            → { jobId }
 *   { action: "batch", jobId, plays[] }   → { inserted }
 *   { action: "finish", jobId }           → { ok }
 */
const play = z.object({
  playedAt: z.iso.datetime(),
  msPlayed: z.number().int().positive().max(24 * 3_600_000),
  kind: z.enum(["track", "episode"]),
  trackUri: z.string().max(100).nullable(),
  trackName: z.string().min(1).max(500),
  artistName: z.string().min(1).max(300),
  albumName: z.string().max(500).nullable(),
  platform: z.string().max(20).nullable(),
  country: z.string().max(4).nullable(),
  reasonStart: z.string().max(40).nullable(),
  reasonEnd: z.string().max(40).nullable(),
  shuffle: z.boolean().nullable(),
  skipped: z.boolean(),
  offline: z.boolean().nullable(),
  incognito: z.boolean().nullable(),
});

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), files: z.number().int().min(1).max(200) }),
  z.object({ action: z.literal("batch"), jobId: z.number().int(), plays: z.array(play).min(1).max(2000) }),
  z.object({ action: z.literal("finish"), jobId: z.number().int(), error: z.string().max(500).optional() }),
]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const b = parsed.data;

  if (b.action === "start") {
    const [job] = await db.insert(importJob).values({ userId: user.id, filesTotal: b.files }).returning({ id: importJob.id });
    return NextResponse.json({ jobId: job.id });
  }

  const [job] = await db.select().from(importJob).where(and(eq(importJob.id, b.jobId), eq(importJob.userId, user.id))).limit(1);
  if (!job) return NextResponse.json({ error: "Unknown import" }, { status: 404 });

  if (b.action === "batch") {
    const rows = b.plays.map((p) => ({
      user_id: user.id,
      played_at: p.playedAt,
      ms_played: p.msPlayed,
      kind: p.kind,
      track_uri: p.trackUri,
      track_name: p.trackName,
      artist_name: p.artistName,
      album_name: p.albumName,
      platform: p.platform,
      country: p.country,
      reason_start: p.reasonStart,
      reason_end: p.reasonEnd,
      shuffle: p.shuffle,
      skipped: p.skipped,
      offline: p.offline,
      incognito: p.incognito,
      source: "import",
    }));
    // Re-importing the same export is safe: duplicates hit play_dedupe_idx.
    const res = await sql`insert into play ${sql(rows)} on conflict do nothing`;
    await sql`update import_job set rows_seen = rows_seen + ${rows.length}, rows_inserted = rows_inserted + ${res.count}
              where id = ${job.id}`;
    return NextResponse.json({ inserted: res.count });
  }

  await db
    .update(importJob)
    .set({ status: b.error ? "failed" : "done", error: b.error ?? null, finishedAt: new Date() })
    .where(eq(importJob.id, job.id));
  return NextResponse.json({ ok: true });
}
