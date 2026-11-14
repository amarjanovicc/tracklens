import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, Lock, Minus, Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { limitsFor } from "@/lib/plans";
import { loadPlaylistDetail } from "@/lib/playlists/queries";
import { SPIKE_MAD_K } from "@/lib/playlists/detect";
import { FollowerChart } from "@/components/charts";
import { ChangeValue, Cover, VerdictBadge } from "@/components/playlists/bits";
import { UntrackButton } from "@/components/playlists/untrack-button";
import { Badge, Button, Card, EmptyState, Stat } from "@/components/ui";
import { fmt1, fmtDate, fmtInt } from "@/lib/format";

export const metadata: Metadata = { title: "Playlist" };

const VERDICT_TEXT = {
  "Looks organic": "Growth is steady day to day. No single day stands far outside the playlist's normal rate.",
  "Unusual spikes": "There are days far outside the normal growth rate, or a sudden drop. That can be a feature, a viral moment, or a purge of fake followers. Worth a closer look before paying for a placement.",
  "Likely botted": "Most of the growth came in a few abnormal bursts. That pattern is typical of bought followers, which don't stream. Treat placement offers on this playlist with caution.",
  "Not enough data": "We need about a week of daily snapshots before the check means anything.",
} as const;

export default async function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const data = await loadPlaylistDetail(user.id, id);
  if (!data) notFound();
  const { playlist: p, detection: d, events } = data;
  const canSeeChangelog = limitsFor(user.plan).playlistChangelog;
  const isDemo = p.spotifyId.startsWith("demo_");
  const chartData = d.points.map((pt) => ({ day: pt.day, followers: pt.followers, flagged: d.flaggedDays.has(pt.day) }));
  const anomalies = [...d.anomalies].sort((a, b) => b.day.localeCompare(a.day));

  return (
    <div className="space-y-6">
      <Link href="/app/playlists" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={14} aria-hidden /> All playlists
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Cover url={p.imageUrl} size={72} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
            <p className="mt-1 text-sm text-ink-2">
              by {p.ownerName ?? "unknown"}
              {p.trackCount != null && <> · {fmtInt(p.trackCount)} tracks</>}
              {isDemo && <> · <Badge>Demo data</Badge></>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isDemo && (
            <Button variant="secondary" href={`https://open.spotify.com/playlist/${p.spotifyId}`}>
              <ExternalLink size={15} aria-hidden /> Open in Spotify
            </Button>
          )}
          <UntrackButton spotifyId={p.spotifyId} name={p.name} />
        </div>
      </div>

      {p.lastError && (
        <p role="alert" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-critical">
          The last update failed: {p.lastError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Followers" value={d.latest != null ? fmtInt(d.latest) : "–"} hint={p.lastFetchedAt ? `as of ${fmtDate(p.lastFetchedAt, { dateStyle: "medium" }, user.timezone)}` : undefined} />
        <Stat label="24 hours" value={<ChangeValue change={d.change1d} showPct={false} />} hint={d.change1d?.pct != null ? `${(d.change1d.pct * 100).toFixed(2)}%` : undefined} />
        <Stat label="7 days" value={<ChangeValue change={d.change7d} showPct={false} />} hint={d.change7d?.pct != null ? `${(d.change7d.pct * 100).toFixed(1)}%` : undefined} />
        <Stat label="30 days" value={<ChangeValue change={d.change30d} showPct={false} />} hint={d.change30d?.pct != null ? `${(d.change30d.pct * 100).toFixed(1)}%` : undefined} />
        <Stat label="Organic growth" value={d.avgDailyGrowth != null ? `${d.avgDailyGrowth >= 0 ? "+" : ""}${fmt1(d.avgDailyGrowth)}/day` : "–"} hint="last 30 days, spikes excluded" />
        <Stat label="In 30 days" value={d.projection30d != null ? fmtInt(d.projection30d) : "–"} hint="projected at the organic rate" />
      </div>

      <Card title="Followers over time" subtitle={d.anomalies.length ? "Red dots mark days flagged as abnormal" : "One snapshot per day"}>
        {chartData.length > 1 ? <FollowerChart data={chartData} /> : (
          <p className="py-10 text-center text-sm text-ink-2">The chart appears after the second daily snapshot.</p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2" title="Bot check" action={<VerdictBadge verdict={d.verdict} />}>
          <div className="tabular text-4xl font-semibold">{d.verdict === "Not enough data" ? "–" : d.score}<span className="text-base font-normal text-ink-3"> / 100</span></div>
          <p className="mt-1 text-xs text-ink-3">suspicion score</p>
          <p className="mt-4 text-sm text-ink-2">{VERDICT_TEXT[d.verdict]}</p>
          <details className="mt-4 text-sm text-ink-2">
            <summary className="cursor-pointer font-medium text-ink">How the score works</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>We compute the playlist&apos;s typical daily change (median <span className="tabular">{fmtInt(d.baseline.median)}</span>) and how much it normally varies.</li>
              <li>A day is a <strong className="font-medium text-ink">spike</strong> when growth exceeds the median by more than {SPIKE_MAD_K}× that variation (currently above <span className="tabular">{fmtInt(d.baseline.threshold)}</span>/day) and by at least 50 followers or 1%.</li>
              <li>A <strong className="font-medium text-ink">drop</strong> is a loss of more than 1% in a day, which often means Spotify removed fake accounts.</li>
              <li>The score is the share of all growth that came from spike days (<span className="tabular">{fmtInt(d.spikeGrowth)}</span> of <span className="tabular">{fmtInt(d.grossGrowth)}</span>), plus 15 points per drop.</li>
            </ul>
            <p className="mt-2">It&apos;s a heuristic on follower counts, not proof. A feature on a big editorial list can look like a spike too.</p>
          </details>
        </Card>

        <Card className="lg:col-span-3" title="Flagged days" subtitle={`${d.anomalies.length} in ${d.points.length} days of history`}>
          {anomalies.length === 0 ? (
            <p className="py-6 text-sm text-ink-2">Nothing abnormal so far.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="pb-2 font-medium">Day</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 text-right font-medium">Change</th>
                  <th className="pb-2 text-right font-medium">Of followers</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.slice(0, 20).map((a) => (
                  <tr key={a.day} className="border-t border-line">
                    <td className="py-2">{fmtDate(a.day, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="py-2">{a.type === "spike" ? <Badge tone="critical">Spike</Badge> : <Badge>Drop</Badge>}</td>
                    <td className="py-2 text-right"><ChangeValue change={{ abs: a.delta, pct: null }} showPct={false} /></td>
                    <td className="tabular py-2 text-right text-ink-2">{(a.pctOfFollowers * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Track changes" subtitle="Tracks added and removed, detected daily">
        {!canSeeChangelog ? (
          <EmptyState title="Track changelog is a Pro feature" action={<Button href="/app/settings#billing">Upgrade to Pro</Button>}>
            See exactly which tracks were added or removed each day, and when your song entered or left the list.
          </EmptyState>
        ) : events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="pb-2 font-medium">Day</th>
                  <th className="pb-2 font-medium">Change</th>
                  <th className="pb-2 font-medium">Track</th>
                  <th className="pb-2 text-right font-medium">Position</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-line">
                    <td className="py-2 whitespace-nowrap">{fmtDate(e.day)}</td>
                    <td className="py-2">
                      {e.type === "added"
                        ? <span className="inline-flex items-center gap-1 text-good"><Plus size={13} aria-hidden />Added</span>
                        : <span className="inline-flex items-center gap-1 text-critical"><Minus size={13} aria-hidden />Removed</span>}
                    </td>
                    <td className="py-2"><span className="font-medium">{e.trackName}</span> <span className="text-ink-3">· {e.artistName}</span></td>
                    <td className="tabular py-2 text-right text-ink-2">{e.position != null ? `#${e.position + 1}` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex gap-3 py-2 text-sm text-ink-2">
            <Lock size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
            <p>
              {data.ownedByConnectedUser
                ? "No changes recorded yet. The first sync stores the current track list as a baseline; changes show up from the next daily run."
                : data.spotifyConnected
                  ? "Spotify only exposes the track list of playlists you own or collaborate on, and this one belongs to someone else. Follower tracking still works."
                  : <>Spotify only exposes track lists for playlists you own. <Link href="/app/settings" className="font-medium text-brand hover:underline">Connect Spotify</Link> to get a changelog for your own playlists.</>}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
