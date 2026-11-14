import Link from "next/link";
import type { Metadata } from "next";
import { getPageContext } from "@/lib/page-context";
import * as A from "@/lib/analytics";
import { Card, PageHeader, Stat } from "@/components/ui";
import { ColumnChart } from "@/components/charts";
import { RangeBar } from "@/components/range-bar";
import { NoData } from "@/components/no-data";
import { enc, fmtDate, fmtDuration, pct } from "@/lib/format";

export const metadata: Metadata = { title: "Discovery" };

export default async function DiscoveryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getPageContext(searchParams);
  if (!ctx.hasData) return (<><PageHeader title="Discovery" /><NoData /></>);
  const s = ctx.scope;
  const [byMonth, discoveries, share, diversity, repeat, loyal, forgotten] = await Promise.all([
    A.discoveryByMonth(s), A.topDiscoveries(s), A.discoveryShare(s), A.diversityByMonth(s),
    A.onRepeat(s), A.loyalty(s), A.forgottenFavorites(ctx.user.id),
  ]);
  const newArtists = byMonth.reduce((a, b) => a + b.newArtists, 0);
  const newTracks = byMonth.reduce((a, b) => a + b.newTracks, 0);
  const avg = (k: "entropy" | "top10Share" | "artists") => diversity.length ? diversity.reduce((a, d) => a + d[k], 0) / diversity.length : null;

  return (
    <>
      <PageHeader title="Discovery & diversity" description={`How much new music you find, and how widely you listen · ${ctx.range.label}`}>
        <RangeBar range={ctx.range} years={ctx.years} />
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="New artists" value={newArtists.toLocaleString()} hint="First ever play in this range" />
        <Stat label="New tracks" value={newTracks.toLocaleString()} />
        <Stat label="Time on new artists" value={share == null ? "–" : pct(share)} hint="Share of listening time" />
        <Stat label="Diversity" value={avg("entropy") == null ? "–" : `${Math.round(avg("entropy")! * 100)}/100`}
          hint={`Top 10 artists = ${pct(avg("top10Share"))} of a typical month`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="New artists per month">
          <ColumnChart data={byMonth} xKey="month" yKey="newArtists" name="New artists" format="count" xFormat="month" />
        </Card>
        <Card title="Unique artists per month">
          <ColumnChart data={diversity} xKey="month" yKey="artists" name="Unique artists" format="count" xFormat="month" />
        </Card>
        <Card title="Top 10 artists' share of each month" subtitle="Lower = you spread your time wider">
          <ColumnChart data={diversity} xKey="month" yKey="top10Share" name="Top-10 share" format="percent" xFormat="month" />
        </Card>
        <Card title="Best discoveries" subtitle="Artists first heard in this range, by time since">
          {discoveries.length === 0 ? <p className="text-sm text-ink-2">Pick a bounded range (not All time) to see discoveries.</p> : (
            <ul className="divide-y divide-line text-sm">
              {discoveries.map((d) => (
                <li key={d.artist} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/app/artist/${enc(d.artist)}`} className="min-w-0 hover:underline">
                    <span className="block truncate font-medium">{d.artist}</span>
                    <span className="block text-xs text-ink-3">First played {fmtDate(d.first)} · {d.tracks} tracks</span>
                  </Link>
                  <span className="tabular shrink-0 text-ink-2">{fmtDuration(d.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="On repeat" subtitle="The weeks one song took over">
          <ul className="divide-y divide-line text-sm">
            {repeat.map((r) => (
              <li key={r.name + r.week} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/app/track/${enc(r.artist)}/${enc(r.name)}`} className="min-w-0 hover:underline">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-ink-3">{r.artist} · week of {fmtDate(r.week)}</span>
                </Link>
                <span className="tabular shrink-0 text-ink-2">{r.plays}× that week</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Ride or die" subtitle="Artists present in the most months">
          <ul className="divide-y divide-line text-sm">
            {loyal.map((l) => (
              <li key={l.artist} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/app/artist/${enc(l.artist)}`} className="truncate font-medium hover:underline">{l.artist}</Link>
                <span className="tabular shrink-0 text-ink-2">{l.months} months · {fmtDuration(l.minutes)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6" title="Forgotten favorites" subtitle="Artists you loved (3 h+) but haven't played in 6 months. Across your whole history.">
        {forgotten.length === 0 ? <p className="text-sm text-ink-2">None yet. You stay loyal.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forgotten.map((f) => (
              <Link key={f.artist} href={`/app/artist/${enc(f.artist)}`} className="rounded-xl border border-line p-3 hover:bg-surface-2">
                <div className="truncate font-medium">{f.artist}</div>
                <div className="mt-0.5 text-xs text-ink-3">{fmtDuration(f.minutes)} total · peak {f.peakYear} · last {fmtDate(f.last)}</div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
