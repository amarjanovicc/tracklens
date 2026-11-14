import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db, sql } from "@/db";
import { importJob, spotifyConnection } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { Badge, Card, PageHeader } from "@/components/ui";
import { Importer } from "@/components/import/importer";
import { fmtDate, fmtInt } from "@/lib/format";

export const metadata: Metadata = { title: "Import data" };

export default async function ImportPage() {
  const user = await requireUser();
  const [jobs, [lib], [conn]] = await Promise.all([
    db.select().from(importJob).where(eq(importJob.userId, user.id)).orderBy(desc(importJob.createdAt)).limit(8),
    sql`select count(*)::int as n, min(played_at) as first, max(played_at) as last,
          count(*) filter (where source = 'api')::int as live
        from play where user_id = ${user.id}`,
    db.select().from(spotifyConnection).where(eq(spotifyConnection.userId, user.id)).limit(1),
  ]);

  return (
    <>
      <PageHeader title="Import your listening history"
        description="Spotify's own export is the only complete record of everything you've ever played. The API only remembers your last 50 tracks." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Importer />
          <Card title="Your library">
            {lib.n === 0 ? <p className="text-sm text-ink-2">Nothing imported yet.</p> : (
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div><dt className="text-ink-3">Streams stored</dt><dd className="tabular mt-1 text-lg font-semibold">{fmtInt(lib.n)}</dd></div>
                <div><dt className="text-ink-3">First play</dt><dd className="mt-1 font-medium">{fmtDate(lib.first)}</dd></div>
                <div><dt className="text-ink-3">Latest play</dt><dd className="mt-1 font-medium">{fmtDate(lib.last)}</dd></div>
                <div><dt className="text-ink-3">From live sync</dt><dd className="tabular mt-1 font-medium">{fmtInt(lib.live)}</dd></div>
              </dl>
            )}
          </Card>
          {jobs.length > 0 && (
            <Card title="Recent imports">
              <ul className="divide-y divide-line text-sm">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span>{fmtDate(j.createdAt, { dateStyle: "medium", timeStyle: "short" }, user.timezone)}</span>
                    <span className="tabular text-ink-2">{fmtInt(j.rowsInserted)} new of {fmtInt(j.rowsSeen)}</span>
                    <Badge tone={j.status === "done" ? "good" : j.status === "failed" ? "critical" : "neutral"}>
                      {j.status === "done" ? "Done" : j.status === "failed" ? "Failed" : "Running"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="How to get your data">
            <ol className="list-decimal space-y-2.5 pl-4 text-sm text-ink-2">
              <li>Open <a className="text-brand underline" href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer">spotify.com/account/privacy</a>.</li>
              <li>Tick <b className="text-ink">Extended streaming history</b> (your whole lifetime, with skips, devices and countries). <i>Account data</i> only covers about a year.</li>
              <li>Confirm the email. Spotify says it can take up to 30 days; it is often much faster.</li>
              <li>Download <code>my_spotify_data.zip</code> and drop it here. Re-importing later is safe, duplicates are skipped.</li>
            </ol>
          </Card>
          <Card title="Keep it up to date">
            <p className="text-sm text-ink-2">
              {conn
                ? <>Spotify is connected as <b className="text-ink">{conn.displayName ?? conn.spotifyUserId}</b>. New plays sync automatically.</>
                : <>Connect Spotify in <a className="text-brand underline" href="/app/settings">Settings</a> to add new plays automatically after your import.</>}
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
