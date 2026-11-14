import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import * as A from "@/lib/analytics";
import { parseRange } from "@/lib/range";
import { limitsFor } from "@/lib/plans";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { CompareLines } from "@/components/charts";
import { NoData } from "@/components/no-data";
import { enc, fmtDuration, fmtInt, pct } from "@/lib/format";

export const metadata: Metadata = { title: "Compare" };

type SP = Record<string, string | string[] | undefined>;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function ComparePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [anchor, years] = await Promise.all([A.latestPlay(user.id), A.availableYears(user.id, user.timezone)]);
  if (!anchor) return (<><PageHeader title="Compare" /><NoData /></>);

  if (!limitsFor(user.plan).compare) {
    return (
      <>
        <PageHeader title="Compare periods" />
        <EmptyState title="Compare is a Pro feature" action={<Button href="/app/settings#billing">Upgrade to Pro</Button>}>
          Put any two periods side by side: this year vs last, summer vs winter, before and after a breakup.
          See which artists rose, which faded, and how much your taste overlapped.
        </EmptyState>
      </>
    );
  }

  const options = [...years.map((y) => ({ key: `y${y}`, label: String(y) })), { key: "6m", label: "Last 6 months" }, { key: "12m", label: "Last 12 months" }];
  const aKey = typeof sp.a === "string" ? sp.a : years[1] ? `y${years[1]}` : "12m";
  const bKey = typeof sp.b === "string" ? sp.b : years[0] ? `y${years[0]}` : "6m";
  const ra = parseRange({ range: aKey }, anchor);
  const rb = parseRange({ range: bKey }, anchor);
  const sa = A.scopeOf(user.id, ra, user.timezone);
  const sb = A.scopeOf(user.id, rb, user.timezone);
  const [oa, ob, ta, tb, la, lb, mv] = await Promise.all([
    A.overview(sa), A.overview(sb), A.top(sa, "artists", { limit: 10 }), A.top(sb, "artists", { limit: 10 }),
    A.timeline(sa, "month"), A.timeline(sb, "month"), A.movers(sa, sb, 8),
  ]);
  const bothYears = ra.key.startsWith("y") && rb.key.startsWith("y");
  const n = Math.max(la.length, lb.length);
  const lines = Array.from({ length: bothYears ? 12 : n }, (_, i) => {
    const pick = (arr: typeof la) => bothYears ? (arr.find((r) => Number(r.bucket.slice(5, 7)) === i + 1)?.minutes ?? 0) : (arr[i]?.minutes ?? 0);
    return { x: bothYears ? MONTHS[i] : `M${i + 1}`, a: pick(la), b: pick(lb) };
  });
  const row = (label: string, a: string, b: string) => (
    <tr><td className="py-2 text-ink-3">{label}</td><td className="tabular py-2 text-right font-medium">{a}</td><td className="tabular py-2 text-right font-medium">{b}</td></tr>
  );

  return (
    <>
      <PageHeader title="Compare periods" description="Two periods, one scale.">
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <select name="a" defaultValue={aKey} aria-label="Period A" className="h-9 rounded-lg border border-line bg-surface px-2">
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <span className="text-ink-3">vs</span>
          <select name="b" defaultValue={bKey} aria-label="Period B" className="h-9 rounded-lg border border-line bg-surface px-2">
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button className="h-9 rounded-lg border border-line bg-surface px-3 hover:bg-surface-2">Compare</button>
        </form>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Head to head">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-3"><tr><th /><th className="py-1 text-right">{ra.label}</th><th className="py-1 text-right">{rb.label}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {row("Listening time", fmtDuration(oa.minutes), fmtDuration(ob.minutes))}
              {row("Streams", fmtInt(oa.streams), fmtInt(ob.streams))}
              {row("Artists", fmtInt(oa.artists), fmtInt(ob.artists))}
              {row("Tracks", fmtInt(oa.tracks), fmtInt(ob.tracks))}
              {row("Active days", fmtInt(oa.activeDays), fmtInt(ob.activeDays))}
              {row("Longest streak", `${oa.longestStreak} d`, `${ob.longestStreak} d`)}
              {row("Skip rate", pct(oa.skipRate), pct(ob.skipRate))}
              {row("Shuffle", pct(oa.shuffleRate), pct(ob.shuffleRate))}
            </tbody>
          </table>
          <p className="mt-4 text-sm text-ink-2">Artist overlap: <b className="text-ink">{pct(mv.overlap)}</b> of the artists you played appear in both periods.</p>
        </Card>
        <Card title="Listening time by month">
          <CompareLines data={lines} aLabel={ra.label} bLabel={rb.label} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {[{ label: ra.label, rows: ta }, { label: rb.label, rows: tb }].map((c) => (
          <Card key={c.label} title={`Top artists · ${c.label}`}>
            <ol className="space-y-1 text-sm">
              {c.rows.map((r) => (
                <li key={r.name} className="flex justify-between gap-3">
                  <Link href={`/app/artist/${enc(r.name)}`} className="truncate hover:underline"><span className="tabular mr-2 text-ink-3">{r.rank}</span>{r.name}</Link>
                  <span className="tabular text-ink-2">{fmtDuration(r.minutes)}</span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
        <Card title="Rising" subtitle={`More time in ${rb.label} than in ${ra.label}`}>
          <Movers rows={mv.risers.filter((r) => r.delta > 0)} sign="+" />
        </Card>
        <Card title="Fading" subtitle={`Less time in ${rb.label}`}>
          <Movers rows={mv.fallers.filter((r) => r.delta < 0)} sign="" />
        </Card>
      </div>
    </>
  );
}

function Movers({ rows, sign }: { rows: { artist: string; a: number; b: number; delta: number }[]; sign: string }) {
  if (!rows.length) return <p className="text-sm text-ink-2">Nothing here.</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map((r) => (
        <li key={r.artist} className="flex items-center justify-between gap-3 py-2">
          <Link href={`/app/artist/${enc(r.artist)}`} className="truncate font-medium hover:underline">{r.artist}</Link>
          <span className="tabular shrink-0 text-ink-2">{fmtDuration(r.a)} → {fmtDuration(r.b)} <span className="text-ink">({sign}{fmtDuration(Math.abs(r.delta)).replace(/^/, sign ? "" : "−")})</span></span>
        </li>
      ))}
    </ul>
  );
}
