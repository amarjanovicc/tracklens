import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { eq, sql as dsql } from "drizzle-orm";
import { Clock3, Flame, Headphones, Moon, Shuffle } from "lucide-react";
import { db } from "@/db";
import { shareLink, user } from "@/db/schema";
import * as A from "@/lib/analytics";
import { fmtDate, fmtDuration, fmtInt, pct } from "@/lib/format";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";

const getLink = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{3,40}$/i.test(slug)) return null;
  const [row] = await db
    .select({
      slug: shareLink.slug,
      title: shareLink.title,
      rangeFrom: shareLink.rangeFrom,
      rangeTo: shareLink.rangeTo,
      userId: shareLink.userId,
      ownerName: user.name,
      tz: user.timezone,
    })
    .from(shareLink)
    .innerJoin(user, eq(user.id, shareLink.userId))
    .where(eq(shareLink.slug, slug))
    .limit(1);
  return row ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const link = await getLink((await params).slug);
  if (!link) return { title: "Not found" };
  const first = link.ownerName.split(" ")[0];
  return {
    title: `${first}'s listening: ${link.title}`,
    description: `${first}'s top artists, tracks and listening personality on Tracklens.`,
    robots: { index: false },
  };
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const link = await getLink((await params).slug);
  if (!link) notFound();

  await db.update(shareLink).set({ views: dsql`${shareLink.views} + 1` }).where(eq(shareLink.slug, link.slug));

  const s: A.Scope = { userId: link.userId, from: link.rangeFrom, to: link.rangeTo, tz: link.tz, kind: "track" };
  const [ov, artists, tracks, hours, flags, discShare, diversity] = await Promise.all([
    A.overview(s),
    A.top(s, "artists", { limit: 5 }),
    A.top(s, "tracks", { limit: 5 }),
    A.hourly(s),
    A.flags(s),
    A.discoveryShare(s),
    A.diversityByMonth(s),
  ]);
  if (ov.plays === 0) notFound();

  const top10Share = diversity.length ? diversity.reduce((a, d) => a + d.top10Share, 0) / diversity.length : null;
  const traits = A.personality({ overview: ov, flags, discoveryShare: discShare, top10Share });
  const peak = hours.reduce<{ hour: number; minutes: number } | null>((b, h) => (!b || h.minutes > b.minutes ? h : b), null);
  const maxHour = Math.max(1, ...hours.map((h) => h.minutes));
  const first = link.ownerName.split(" ")[0];
  const period = `${fmtDate(link.rangeFrom ?? ov.first)} – ${fmtDate(link.rangeTo ?? ov.last)}`;

  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5">
        <Logo />
        <Button href="/sign-up">Get your own</Button>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16">
        <section className="rounded-lg border border-line bg-surface px-6 py-10 sm:px-10 sm:py-12">
          <p className="text-sm font-medium text-ink-2">{first}&apos;s listening · {link.title}</p>
          <p className="mt-1 text-xs text-ink-3">{period}</p>
          <div className="mt-8">
            <div className="tabular text-6xl font-semibold tracking-tight sm:text-7xl">{fmtInt(ov.minutes)}</div>
            <div className="mt-1 text-lg text-ink-2">minutes of music · {fmtDuration(ov.minutes)}</div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: "Streams", v: fmtInt(ov.streams) },
              { k: "Artists", v: fmtInt(ov.artists) },
              { k: "Tracks", v: fmtInt(ov.tracks) },
              { k: "Active days", v: fmtInt(ov.activeDays) },
            ].map((x) => (
              <div key={x.k} className="rounded-md bg-surface-2 px-4 py-3">
                <dt className="text-xs text-ink-3">{x.k}</dt>
                <dd className="tabular mt-0.5 text-xl font-semibold">{x.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {traits.length > 0 && (
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            {traits.map((t, i) => (
              <div key={t.id} className="rounded-lg border border-line bg-surface p-5">
                <div className="text-xs font-medium uppercase tracking-wide text-ink-3">
                  {i === 0 ? "Listening personality" : "With a streak of"}
                </div>
                <div className="mt-1 text-xl font-semibold">{t.label}</div>
                <p className="mt-1 text-sm text-ink-2">{t.blurb}</p>
              </div>
            ))}
          </section>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <TopList title="Top artists" rows={artists.map((a) => ({ key: a.name, primary: a.name, secondary: `${fmtDuration(a.minutes)} · ${fmtInt(a.streams)} streams` }))} />
          <TopList title="Top tracks" rows={tracks.map((t) => ({ key: `${t.name}-${t.artist}`, primary: t.name, secondary: `${t.artist} · ${fmtInt(t.streams)} streams` }))} />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={<Clock3 size={16} />} label="Peak hour" value={peak ? `${String(peak.hour).padStart(2, "0")}:00` : "–"} />
          <Fact icon={<Flame size={16} />} label="Longest streak" value={`${ov.longestStreak} days`} />
          <Fact icon={<Shuffle size={16} />} label="On shuffle" value={pct(flags.shuffle)} />
          <Fact icon={<Moon size={16} />} label="After 22:00" value={pct(flags.night_share)} />
        </section>

        <section className="mt-6 rounded-lg border border-line bg-surface p-5">
          <h2 className="text-[15px] font-semibold">Listening by hour of day</h2>
          <div className="mt-4 flex h-28 items-end gap-[2px]" role="img" aria-label="Listening time by hour of day">
            {Array.from({ length: 24 }, (_, h) => {
              const m = hours.find((x) => x.hour === h)?.minutes ?? 0;
              return (
                <div key={h} className="flex-1 rounded-t-[4px] bg-series-1" title={`${String(h).padStart(2, "0")}:00 · ${fmtDuration(m)}`}
                  style={{ height: `${Math.max(2, (m / maxHour) * 100)}%`, opacity: peak?.hour === h ? 1 : 0.55 }} />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-ink-3">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-line bg-surface px-6 py-10 text-center">
          <Headphones className="mx-auto text-brand" size={28} aria-hidden />
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">See your own, from your entire history</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-2">
            Import your Spotify streaming history and get habits, skips, discovery, sessions and more. Free to start.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button href="/sign-up">Get your own</Button>
            <Button href="/" variant="secondary">How it works</Button>
          </div>
        </section>
        <p className="mt-8 text-center text-xs text-ink-3">
          Tracklens is not affiliated with Spotify AB.
        </p>
      </main>
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: { key: string; primary: string; secondary: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <ol className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-3">
            <span className="tabular w-6 shrink-0 text-right text-lg font-semibold text-ink-3">{i + 1}</span>
            <div className="min-w-0">
              <div className="truncate font-medium">{r.primary}</div>
              <div className="truncate text-xs text-ink-3">{r.secondary}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">
        <span className="text-brand" aria-hidden>{icon}</span>
        {label}
      </div>
      <div className="tabular mt-1.5 text-2xl font-semibold">{value}</div>
    </div>
  );
}
