import Link from "next/link";
import type { Metadata } from "next";
import { getPageContext } from "@/lib/page-context";
import * as A from "@/lib/analytics";
import { BarList, Card, PageHeader, Stat } from "@/components/ui";
import { ColumnChart, Heatmap } from "@/components/charts";
import { RangeBar } from "@/components/range-bar";
import { NoData } from "@/components/no-data";
import { countryName, enc, fmtDate, fmtDuration, fmtInt, pct, PLATFORM_LABEL, REASON_LABEL } from "@/lib/format";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getPageContext(searchParams);
  if (!ctx.hasData) return (<><PageHeader title="Habits" /><NoData /></>);
  const s = ctx.scope;
  const [clock, hourly, sess, platforms, countries, starts, ends, flags, skipped, loyalSkip] = await Promise.all([
    A.clock(s), A.hourly(s), A.sessions(s), A.breakdown(s, "platform"), A.breakdown(s, "country"),
    A.breakdown(s, "reason_start"), A.breakdown(s, "reason_end"), A.flags(s), A.mostSkipped(s), A.artistSkipRates(s),
  ]);
  const totalPlays = ends.reduce((a, b) => a + b.plays, 0) || 1;
  const totalStarts = starts.reduce((a, b) => a + b.plays, 0) || 1;
  const hourData = Array.from({ length: 24 }, (_, h) => {
    const r = hourly.find((x) => x.hour === h);
    return { hour: h, minutes: r?.minutes ?? 0, skipRate: r?.skipRate ?? 0 };
  });

  return (
    <>
      <PageHeader title="Habits" description={`When, where and how you listen · ${ctx.range.label} · times in ${ctx.user.timezone}`}>
        <RangeBar range={ctx.range} years={ctx.years} />
      </PageHeader>

      <Card title="Listening clock" subtitle="Minutes by weekday and hour">
        <Heatmap cells={clock} />
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sessions" value={fmtInt(sess?.count)} hint="A new session starts after 30 min of silence" />
        <Stat label="Typical session" value={fmtDuration(sess?.medianMinutes)} hint={`${(sess?.avgTracks ?? 0).toFixed(0)} tracks on average`} />
        <Stat label="Longest session" value={fmtDuration(sess?.longest.minutes)} hint={sess ? fmtDate(sess.longest.started, { dateStyle: "medium", timeStyle: "short" }, ctx.user.timezone) : undefined} />
        <Stat label="After 22:00" value={pct(flags.night_share)} hint="Share of listening time at night" />
        <Stat label="Shuffle" value={pct(flags.shuffle)} hint="Plays with shuffle on" />
        <Stat label="Skips on shuffle" value={pct(flags.skip_shuffle)} hint={`vs ${pct(flags.skip_ordered)} in order`} />
        <Stat label="Weekend plays" value={pct(flags.weekend_plays)} hint="Weekends are 29% of the week" />
        <Stat label="Offline" value={pct(flags.offline)} hint={`Private session: ${pct(flags.incognito)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Time of day" subtitle="Listening time per hour">
          <ColumnChart data={hourData} xKey="hour" yKey="minutes" name="Listening" xFormat="hour" />
        </Card>
        <Card title="Skip rate by hour" subtitle="Share of plays skipped">
          <ColumnChart data={hourData} xKey="hour" yKey="skipRate" name="Skip rate" format="percent" xFormat="hour" />
        </Card>
        <Card title="Session length">
          <ColumnChart data={sess?.buckets ?? []} xKey="label" yKey="n" name="Sessions" format="count" />
        </Card>
        <Card title="Devices">
          <BarList format={fmtDuration} items={platforms.map((p) => ({ key: p.key ?? "unknown", label: PLATFORM_LABEL[p.key ?? ""] ?? "Unknown", value: p.minutes }))} />
        </Card>
        <Card title="How tracks start" subtitle="Did you pick it, or did it just play?">
          <BarList format={(v) => pct(v / totalStarts)} items={starts.slice(0, 7).map((r) => ({ key: r.key ?? "?", label: REASON_LABEL[r.key ?? ""] ?? r.key ?? "Unknown", value: r.plays }))} />
        </Card>
        <Card title="How tracks end">
          <BarList format={(v) => pct(v / totalPlays)} items={ends.slice(0, 7).map((r) => ({ key: r.key ?? "?", label: REASON_LABEL[r.key ?? ""] ?? r.key ?? "Unknown", value: r.plays }))} />
        </Card>
        <Card title="Most skipped tracks" subtitle="At least 5 plays">
          <ul className="divide-y divide-line text-sm">
            {skipped.slice(0, 8).map((t) => (
              <li key={t.name + t.artist} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/app/track/${enc(t.artist)}/${enc(t.name)}`} className="min-w-0 hover:underline">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-ink-3">{t.artist}</span>
                </Link>
                <span className="tabular shrink-0 text-ink-2">{pct(t.skipRate)} of {t.plays}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Never skipped" subtitle="Artists you let play, at least 20 plays">
          <ul className="divide-y divide-line text-sm">
            {loyalSkip.slice(0, 8).map((a) => (
              <li key={a.artist} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/app/artist/${enc(a.artist)}`} className="truncate font-medium hover:underline">{a.artist}</Link>
                <span className="tabular shrink-0 text-ink-2">{pct(a.skipRate)} skipped · {a.plays} plays</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Countries" subtitle="Where you were connected from">
          <BarList format={fmtDuration} items={countries.map((c) => ({ key: c.key ?? "?", label: countryName(c.key), value: c.minutes }))} />
        </Card>
      </div>
    </>
  );
}
