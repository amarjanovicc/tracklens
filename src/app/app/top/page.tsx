import Link from "next/link";
import type { Metadata } from "next";
import clsx from "clsx";
import { getPageContext } from "@/lib/page-context";
import * as A from "@/lib/analytics";
import { Card, PageHeader, RankDelta } from "@/components/ui";
import { RangeBar } from "@/components/range-bar";
import { NoData } from "@/components/no-data";
import { enc, fmtDuration, fmtInt, pct } from "@/lib/format";
import { rangeQuery } from "@/lib/range";

export const metadata: Metadata = { title: "Top lists" };

const TABS = [
  { key: "artists", label: "Artists" },
  { key: "tracks", label: "Tracks" },
  { key: "albums", label: "Albums" },
  { key: "podcasts", label: "Podcasts" },
] as const;

export default async function TopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getPageContext(searchParams);
  if (!ctx.hasData) return (<><PageHeader title="Top lists" /><NoData /></>);
  const tab = (TABS.find((t) => t.key === ctx.sp.tab)?.key ?? "artists") as (typeof TABS)[number]["key"];
  const sort = ctx.sp.sort === "streams" ? "streams" : "minutes";
  const kind = tab === "podcasts" ? "artists" : tab;
  const scope = tab === "podcasts" ? { ...ctx.scope, kind: "episode" as const } : ctx.scope;
  const prev = ctx.prevScope ? (tab === "podcasts" ? { ...ctx.prevScope, kind: "episode" as const } : ctx.prevScope) : null;
  const rows = await A.top(scope, kind, { limit: 100, sort, prev });
  const q = rangeQuery(ctx.range);
  const link = (o: Record<string, string>) => `/app/top?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(q)), tab, sort, ...o })}`;
  const href = (r: A.TopRow) =>
    tab === "artists" ? `/app/artist/${enc(r.name)}` : tab === "tracks" ? `/app/track/${enc(r.artist)}/${enc(r.name)}` : tab === "albums" ? `/app/artist/${enc(r.artist)}` : null;

  return (
    <>
      <PageHeader title="Top lists" description={`${ctx.range.label}. Movement compares with the period of the same length just before.`}>
        <RangeBar range={ctx.range} years={ctx.years} />
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {TABS.map((t) => (
            <Link key={t.key} href={link({ tab: t.key })} aria-current={tab === t.key ? "page" : undefined}
              className={clsx("rounded-md px-3 py-1.5 text-sm", tab === t.key ? "bg-surface-2 font-medium" : "text-ink-2 hover:text-ink")}>{t.label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-3">
          Rank by
          {(["minutes", "streams"] as const).map((s) => (
            <Link key={s} href={link({ sort: s })} className={clsx("rounded-md px-2 py-1", sort === s ? "bg-surface-2 text-ink" : "hover:text-ink")}>
              {s === "minutes" ? "time" : "streams"}
            </Link>
          ))}
        </div>
      </div>
      <Card>
        {rows.length === 0 ? <p className="text-sm text-ink-2">Nothing in this range.</p> : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="w-10 px-2 py-2 text-right">#</th>
                  <th className="w-12 px-2 py-2"><span className="sr-only">Movement</span></th>
                  <th className="px-2 py-2">{tab === "podcasts" ? "Show" : tab.slice(0, -1).replace(/^./, (c) => c.toUpperCase())}</th>
                  <th className="px-2 py-2 text-right">Time</th>
                  <th className="px-2 py-2 text-right">Streams</th>
                  <th className="px-2 py-2 text-right" title="Share of plays skipped">Skips</th>
                  {tab !== "tracks" && <th className="px-2 py-2 text-right">Tracks</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const h = href(r);
                  return (
                    <tr key={r.name + r.artist} className="hover:bg-surface-2/50">
                      <td className="tabular px-2 py-2 text-right text-ink-3">{r.rank}</td>
                      <td className="px-2 py-2"><RankDelta rank={r.rank} prevRank={r.prevRank} isNew={r.isNew} /></td>
                      <td className="max-w-[360px] px-2 py-2">
                        {h ? <Link href={h} className="block truncate font-medium hover:underline">{r.name}</Link> : <span className="block truncate font-medium">{r.name}</span>}
                        {tab !== "artists" && tab !== "podcasts" && <span className="block truncate text-xs text-ink-3">{r.artist}</span>}
                      </td>
                      <td className="tabular px-2 py-2 text-right">{fmtDuration(r.minutes)}</td>
                      <td className="tabular px-2 py-2 text-right text-ink-2">{fmtInt(r.streams)}</td>
                      <td className="tabular px-2 py-2 text-right text-ink-2">{pct(r.skipRate)}</td>
                      {tab !== "tracks" && <td className="tabular px-2 py-2 text-right text-ink-2">{r.tracks}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
