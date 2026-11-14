import { sql } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { limitsFor } from "@/lib/plans";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "played_at", "ms_played", "kind", "track_name", "artist_name", "album_name", "track_uri",
  "platform", "country", "reason_start", "reason_end", "shuffle", "skipped", "offline", "incognito", "source",
] as const;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  // Quote when needed; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!limitsFor(me.plan).csvExport) {
    return Response.json({ error: "CSV export is a Pro feature." }, { status: 403 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(COLUMNS.join(",") + "\n"));
        const cursor = sql`
          select played_at, ms_played, kind, track_name, artist_name, album_name, track_uri, platform, country,
            reason_start, reason_end, shuffle, skipped, offline, incognito, source
          from play where user_id = ${me.id} order by played_at`.cursor(2000);
        for await (const rows of cursor) {
          let chunk = "";
          for (const r of rows) chunk += COLUMNS.map((c) => cell((r as Record<string, unknown>)[c])).join(",") + "\n";
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tracklens-plays-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
