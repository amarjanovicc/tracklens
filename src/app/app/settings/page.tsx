import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { CheckCircle2, Download, Info, XCircle } from "lucide-react";
import { db } from "@/db";
import { shareLink, spotifyConnection } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { availableYears, latestPlay } from "@/lib/analytics";
import { billingEnabled, limitsFor, PLANS } from "@/lib/plans";
import { spotifyConfigured } from "@/lib/spotify/client";
import { fmtDate } from "@/lib/format";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { ProfileForm } from "@/components/settings/profile-form";
import { BillingActions } from "@/components/settings/billing-actions";
import { ShareLinks } from "@/components/settings/share-links";
import { SpotifyDisconnect } from "@/components/settings/spotify-disconnect";
import { DangerZone } from "@/components/settings/danger-zone";

export const metadata: Metadata = { title: "Settings" };

const BANNERS: Record<string, { tone: "good" | "critical" | "info"; text: string }> = {
  "billing:success": { tone: "good", text: "Welcome to Pro! Your plan is active. It can take a few seconds to show up." },
  "billing:cancelled": { tone: "info", text: "Checkout cancelled. You have not been charged." },
  "spotify:connected": { tone: "good", text: "Spotify connected. Recent plays will sync automatically." },
  "spotify:error": { tone: "critical", text: "Could not connect Spotify. Please try again." },
  "spotify:denied": { tone: "info", text: "Spotify connection was cancelled." },
  "spotify:not_allowlisted": { tone: "critical", text: "Spotify refused this account. The app is in Spotify Development Mode, which only allows up to 5 allow-listed users. Your imported history still works." },
  "spotify:not_configured": { tone: "info", text: "Spotify isn't configured on this server yet (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)." },
  "spotify:state_mismatch": { tone: "critical", text: "The Spotify sign-in expired or came from another tab. Please try again." },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const banner =
    (typeof sp.billing === "string" && BANNERS[`billing:${sp.billing}`]) ||
    (typeof sp.spotify === "string" && BANNERS[`spotify:${sp.spotify}`]) ||
    null;

  const [[conn], links, years, anchor] = await Promise.all([
    db.select().from(spotifyConnection).where(eq(spotifyConnection.userId, user.id)).limit(1),
    db.select().from(shareLink).where(eq(shareLink.userId, user.id)).orderBy(desc(shareLink.createdAt)),
    availableYears(user.id, user.timezone),
    latestPlay(user.id),
  ]);
  const limits = limitsFor(user.plan);
  const timezones = (() => {
    try {
      const all = Intl.supportedValuesOf("timeZone");
      return all.includes(user.timezone) ? all : [user.timezone, ...all];
    } catch {
      return [user.timezone, "UTC"];
    }
  })();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Your profile, connections, plan and data." />

      {banner && (
        <div role="status" className={
          "mb-6 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm " +
          (banner.tone === "good" ? "border-good/30 bg-good/10" : banner.tone === "critical" ? "border-critical/30 bg-critical/10" : "border-line bg-surface-2")
        }>
          {banner.tone === "good" ? <CheckCircle2 size={18} className="mt-px shrink-0 text-good" aria-hidden />
            : banner.tone === "critical" ? <XCircle size={18} className="mt-px shrink-0 text-critical" aria-hidden />
            : <Info size={18} className="mt-px shrink-0 text-ink-2" aria-hidden />}
          {banner.text}
        </div>
      )}

      <div className="space-y-6">
        <Card title="Profile">
          <ProfileForm name={user.name} timezone={user.timezone} timezones={timezones} />
        </Card>

        <Card title="Spotify connection" subtitle="Optional. Keeps your stats up to date between imports."
          action={conn ? <Badge tone="good">Connected</Badge> : <Badge>Not connected</Badge>}>
          {conn ? (
            <div className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-ink-3">Account</dt><dd className="font-medium">{conn.displayName ?? conn.spotifyUserId}</dd></div>
                <div><dt className="text-ink-3">Connected</dt><dd>{fmtDate(conn.createdAt, { dateStyle: "medium" }, user.timezone)}</dd></div>
                <div><dt className="text-ink-3">Last sync</dt><dd>{conn.lastSyncedAt ? fmtDate(conn.lastSyncedAt, { dateStyle: "medium", timeStyle: "short" }, user.timezone) : "Not yet"}</dd></div>
              </dl>
              {conn.lastError && (
                <p className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
                  Last sync failed: {conn.lastError}
                </p>
              )}
              <SpotifyDisconnect />
            </div>
          ) : !spotifyConfigured() ? (
            <p className="text-sm text-ink-2">Spotify is not configured on this server (missing client ID/secret).</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-2">
                Connecting lets us read your recently played tracks (the last 50) every hour, so new listening shows up
                without another export. Spotify only returns the last 50 plays, so for your full lifetime history you
                still need the <Link href="/app/import" className="text-brand hover:underline">import</Link>.
              </p>
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-2">
                Heads-up: since February 2026 Spotify limits apps in Development Mode to 5 authorised users. Until
                Tracklens is approved for extended access, connecting may fail with a &ldquo;user not registered&rdquo;
                error. Imports always work.
              </p>
              {/* Plain <a>: a route handler that starts OAuth must not be prefetched. */}
              <a href="/api/spotify/connect" className="inline-flex h-9 items-center rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-ink hover:opacity-90">
                Connect Spotify
              </a>
            </div>
          )}
        </Card>

        <Card title="Plan & billing" action={<Badge tone={user.plan === "pro" ? "brand" : "neutral"}>{PLANS[user.plan].name}</Badge>}>
          <ul className="mb-4 grid gap-1.5 text-sm text-ink-2 sm:grid-cols-2">
            <li>Tracked playlists: <strong className="text-ink">{limits.trackedPlaylists}</strong></li>
            <li>Share links: <strong className="text-ink">{limits.shareLinks}</strong></li>
            <li>Live Spotify sync: <strong className="text-ink">{limits.liveSync ? "Yes" : "No"}</strong></li>
            <li>CSV export & period compare: <strong className="text-ink">{limits.csvExport ? "Yes" : "No"}</strong></li>
          </ul>
          <BillingActions plan={user.plan} enabled={billingEnabled()} hasCustomer={Boolean(user.stripeCustomerId)}
            monthly={PLANS.pro.price.monthly} yearly={PLANS.pro.price.yearly} />
        </Card>

        <Card title="Share links" subtitle={`"Wrapped, any time": public pages for a period of your choice. ${links.length}/${limits.shareLinks} used.`}>
          <ShareLinks
            limit={limits.shareLinks}
            years={years}
            hasData={anchor !== null}
            links={links.map((l) => ({
              slug: l.slug,
              title: l.title,
              views: l.views,
              period: `${l.rangeFrom ? fmtDate(l.rangeFrom, { dateStyle: "medium" }, user.timezone) : "Beginning"} – ${l.rangeTo ? fmtDate(l.rangeTo, { dateStyle: "medium" }, user.timezone) : "now"}`,
            }))}
          />
        </Card>

        <Card title="Your data">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Export all plays as CSV</div>
              <div className="text-sm text-ink-3">Every stream with timestamps, platform and skip info.{!limits.csvExport && " Pro feature."}</div>
            </div>
            {limits.csvExport ? (
              <a href="/api/export" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium hover:bg-surface-2">
                <Download size={16} aria-hidden /> Download CSV
              </a>
            ) : (
              <Button variant="secondary" disabled>Download CSV</Button>
            )}
          </div>
          <DangerZone />
        </Card>
      </div>
    </div>
  );
}
