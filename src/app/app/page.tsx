import Link from "next/link";
import type { Metadata } from "next";
import { getPageContext } from "@/lib/page-context";
import * as A from "@/lib/analytics";
import { Card, PageHeader, RankDelta, Stat } from "@/components/ui";
import { TimelineChart } from "@/components/charts";
import { RangeBar } from "@/components/range-bar";
import { NoData } from "@/components/no-data";
import { enc, fmtDate, fmtDuration, fmtInt, pct } from "@/lib/format";
import { rangeQuery } from "@/lib/range";

export const metadata: Metadata = { title: "Overview" };

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getPageContext(searchParams);
  if (!ctx.hasData) return (<><PageHeader title={`Hi ${ctx.user.name.split(" ")[0]}`} /><NoData /></>);
  const { scope: s, prevScope: p, range, user } = ctx;

  const [o, po, artists, tracks, flags, discShare, diversity, hourly] = await Promise.all([
    A.overview(s),
    p ? A.overview(p) : null,
    A.top(s, "artists", { limit: 6, prev: p }),
    A.top(s, "tracks", { limit: 6, prev: p }),
    A.flags(s),
    A.discoveryShare(s),
    A.diversityByMonth(s),
    A.hourly(s),
  ]);
  const unit = A.autoUnit(s.from, s.to, o.first);
  const timeline = await A.timeline(s, unit);
  const top10Share = diversity.length ? diversity.reduce((a, d) => a + d.top10Share, 0) / diversity.length : null;
  const traits = A.personality({ overview: o, flags, discoveryShare: discShare, top10Share });
  const peak = hourly.reduce((a, b) => (b.minutes > a.minutes ? b : a), hourly[0]);
  const days = s.from ? Math.max(1, ((s.to ?? ctx.anchor ?? new Date()).getTime() - s.from.getTime()) / 86_400_000) : Math.max(1, ((o.last?.getTime() ?? 0) - (o.first?.getTime() ?? 0)) / 86_400_000);
  const delta = (cur: number, prev: number | undefined) => {
    if (prev === undefined || prev === 0) return undefined;
    const d = (cur - prev) / prev;
    if (Math.abs(d) < 0.005) return <span>≈ same as previous period</span>;
    return <span className={d >= 0 ? "text-good" : "text-critical"}>{d >= 0 ? "▲" : "▼"} {pct(Math.abs(d), Math.abs(d) < 0.1 ? 1 : 0)} vs previous period</span>;
  };
  const q = rangeQuery(range);

  return (
    <>
      <PageHeader title="Overview" description={`${range.label} · ${fmtDate(o.first)} – ${fmtDate(o.last)}`}>
        <RangeBar range={range} years={ctx.years} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Listening time" value={fmtDuration(o.minutes)} hint={delta(o.minutes, po?.minutes) ?? `${fmtInt(o.minutes)} minutes`} />
        <Stat label="Streams" value={fmtInt(o.streams)} hint={delta(o.streams, po?.streams) ?? `${fmtInt(o.plays)} plays incl. skips`} />
        <Stat label="Artists" value={fmtInt(o.artists)} hint={`${fmtInt(o.tracks)} tracks · ${fmtInt(o.albums)} albums`} />
        <Stat label="Per day" value={fmtDuration(o.minutes / days)} hint={`${o.activeDays} active days`} />
        <Stat label="Longest streak" value={`${o.longestStreak} days`} hint={`Current: ${o.currentStreak} days`} />
        <Stat label="Skip rate" value={pct(o.skipRate)} hint="Skipped before 30 s or flagged by Spotify" />
        <Stat label="Peak hour" value={peak ? `${String(peak.hour).padStart(2, "0")}:00` : "–"} hint={`In ${user.timezone}`} />
        <Stat label="Biggest day" value={o.bestDay ? fmtDuration(o.bestDay.minutes) : "–"} hint={o.bestDay ? fmtDate(o.bestDay.day, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : undefined} />
      </div>

      <Card className="mt-6" title="Listening time" subtitle={`Per ${unit}`}>
        <TimelineChart data={timeline} unit={unit} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Top artists" action={<Link href={`/app/top?${q}`} className="text-sm text-brand">See all</Link>}>
          <TopMini rows={artists.map((a) => ({ ...a, href: `/app/artist/${enc(a.name)}`, sub: `${a.tracks} tracks` }))} />
        </Card>
        <Card title="Top tracks" action={<Link href={`/app/top?tab=tracks&${q}`} className="text-sm text-brand">See all</Link>}>
          <TopMini rows={tracks.map((t) => ({ ...t, href: `/app/track/${enc(t.artist)}/${enc(t.name)}`, sub: t.artist }))} />
        </Card>
      </div>

      <Card className="mt-6" title="Your listening personality" subtitle="Derived from discovery, loyalty, time of day, skips and shuffle">
        <div className="grid gap-4 sm:grid-cols-2">
          {traits.map((t) => (
            <div key={t.id} className="rounded-xl bg-surface-2/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.label}</span>
                <span className="tabular text-sm text-ink-3">{Math.round(t.score * 100)}/100</span>
              </div>
              <p className="mt-1 text-sm text-ink-2">{t.blurb}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function TopMini({ rows }: { rows: (A.TopRow & { href: string; sub: string })[] }) {
  return (
    <ol className="space-y-1">
      {rows.map((r) => (
        <li key={r.href}>
          <Link href={r.href} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
            <span className="tabular w-5 text-right text-sm text-ink-3">{r.rank}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{r.name}</span>
              <span className="block truncate text-xs text-ink-3">{r.sub}</span>
            </span>
            <span className="tabular text-sm text-ink-2">{fmtDuration(r.minutes)}</span>
            <span className="w-10 text-right"><RankDelta rank={r.rank} prevRank={r.prevRank} isNew={r.isNew} /></span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
