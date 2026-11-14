import Link from "next/link";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireUser } from "@/lib/session";
import { limitsFor } from "@/lib/plans";
import { spotifyConfigured } from "@/lib/spotify/client";
import { loadTrackedPlaylists } from "@/lib/playlists/queries";
import { AddPlaylistForm } from "@/components/playlists/add-playlist-form";
import { ChangeValue, Cover, VerdictBadge } from "@/components/playlists/bits";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { fmtDate, fmtInt } from "@/lib/format";

export const metadata: Metadata = { title: "Playlist tracker" };

export default async function PlaylistsPage() {
  const user = await requireUser();
  const limits = limitsFor(user.plan);
  const playlists = await loadTrackedPlaylists(user.id);
  const atLimit = playlists.length >= limits.trackedPlaylists;

  return (
    <div className="space-y-6">
      <PageHeader title="Playlist tracker"
        description="Follower history for any public playlist, snapshotted daily. Spot organic growth, bought followers and purges before you pitch or pay a curator." />

      <Card title="Track a playlist"
        subtitle={<span className="tabular">{playlists.length} / {limits.trackedPlaylists} playlists on the {limits.name} plan</span>}
        action={user.plan !== "pro" ? <Link href="/app/settings#billing" className="text-sm font-medium text-brand hover:underline">Upgrade</Link> : undefined}>
        <AddPlaylistForm disabled={atLimit}
          disabledReason={atLimit ? (user.plan === "pro" ? "You've reached the playlist limit. Remove one to add another." : "Free plan limit reached. Upgrade to Pro to track up to 50 playlists.") : undefined} />
        {!spotifyConfigured() && (
          <p className="mt-3 text-xs text-ink-3">Spotify API credentials aren&apos;t configured on this server, so new playlists can&apos;t be fetched yet.</p>
        )}
      </Card>

      {playlists.length === 0 ? (
        <EmptyState title="No playlists tracked yet">
          Paste a playlist link above. We take a follower snapshot every day, so the growth chart and bot check fill in over the first week.
        </EmptyState>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="px-5 py-3 font-medium">Playlist</th>
                  <th className="px-3 py-3 text-right font-medium">Followers</th>
                  <th className="px-3 py-3 text-right font-medium">24 h</th>
                  <th className="px-3 py-3 text-right font-medium">7 days</th>
                  <th className="px-3 py-3 text-right font-medium">30 days</th>
                  <th className="px-5 py-3 font-medium">Bot check</th>
                </tr>
              </thead>
              <tbody>
                {playlists.map((p) => (
                  <tr key={p.spotifyId} className="border-b border-line last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-3">
                      <Link href={`/app/playlists/${p.spotifyId}`} className="flex items-center gap-3">
                        <Cover url={p.imageUrl} size={40} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">{p.name}</span>
                          <span className="block truncate text-xs text-ink-3">
                            by {p.ownerName ?? "unknown"} · {p.trackCount != null ? `${fmtInt(p.trackCount)} tracks` : "tracks hidden"}
                            {p.lastError && <span className="text-critical"> · last update failed</span>}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="tabular px-3 py-3 text-right font-medium">{p.followers != null ? fmtInt(p.followers) : "–"}</td>
                    <td className="px-3 py-3 text-right"><ChangeValue change={p.detection.change1d} showPct={false} /></td>
                    <td className="px-3 py-3 text-right"><ChangeValue change={p.detection.change7d} showPct={false} /></td>
                    <td className="px-3 py-3 text-right"><ChangeValue change={p.detection.change30d} /></td>
                    <td className="px-5 py-3"><VerdictBadge verdict={p.detection.verdict} score={p.detection.score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
            Snapshots are taken once a day (UTC). Last update{" "}
            {fmtDate(playlists.reduce<Date | null>((a, p) => (p.lastFetchedAt && (!a || p.lastFetchedAt > a) ? p.lastFetchedAt : a), null), { dateStyle: "medium", timeStyle: "short" }, user.timezone)}.
          </p>
        </Card>
      )}

      <div className="flex gap-3 rounded-lg border border-line bg-surface-2/50 p-4 text-sm text-ink-2">
        <Info size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
        <p>
          Spotify&apos;s API shows follower counts for any public playlist, but the <strong className="font-medium text-ink">track list</strong> only for
          playlists you own or collaborate on. <Link href="/app/settings" className="font-medium text-brand hover:underline">Connect Spotify in Settings</Link>{" "}
          and your own playlists also get a daily changelog of added and removed tracks. Spotify doesn&apos;t expose stream counts per playlist, so
          we don&apos;t pretend to.
        </p>
      </div>
    </div>
  );
}
