import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarRange,
  Check,
  Clock3,
  Compass,
  FileDown,
  GitCompare,
  History,
  Layers,
  ListMusic,
  Search,
  Share2,
  ShieldAlert,
  SkipForward,
  Trophy,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { PLANS } from "@/lib/plans";
import { Logo } from "@/components/logo";

const FEATURES = [
  { icon: BarChart3, title: "Overview & streaks", body: "Minutes, streams, active days, your best day, longest and current listening streak." },
  { icon: Trophy, title: "Top lists with movement", body: "Artists, tracks and albums for any period, with rank changes vs. the period before and badges for new discoveries." },
  { icon: Clock3, title: "Listening clock", body: "A weekday × hour heatmap in your own timezone. Find your commute, your focus hours, your 2 a.m. habit." },
  { icon: SkipForward, title: "Skip analysis", body: "Skip rate overall, on shuffle vs. in order, by hour, plus the songs you keep skipping and the artists you never do." },
  { icon: Layers, title: "Sessions", body: "How long you actually listen in one go, how many tracks per session, and your longest marathon." },
  { icon: Compass, title: "Discovery & diversity", body: "New artists per month, share of time on discoveries, top-10 concentration and a diversity index." },
  { icon: History, title: "Forgotten favourites", body: "Artists you played for hours years ago and haven't touched since. One click from a nostalgia trip." },
  { icon: Search, title: "Artist & track deep dives", body: "First listen, all-time rank, monthly history, top songs, what time of day you play them, how often you finish them." },
  { icon: GitCompare, title: "Compare periods", body: "This year vs. last, summer vs. winter: risers, fallers and how much your taste overlaps." },
  { icon: ListMusic, title: "Playlist tracker", body: "Follow any public playlist's followers daily. Spikes and purges are flagged so botted playlists stand out." },
  { icon: Share2, title: "Wrapped, any time", body: "Shareable cards for any period with your top artists, peak hour and listening personality." },
  { icon: FileDown, title: "CSV export", body: "All your plays, cleaned and normalised, ready for a spreadsheet or a notebook." },
];

const FAQ = [
  {
    q: "Why do I import a file instead of just logging in with Spotify?",
    a: "Spotify's API only returns your last 50 plays and coarse 'top' lists, so login alone can't show your full history. Since February 2026 Spotify also caps new apps at 5 users unless they get extended access, and removed data like popularity and audio features. Your privacy export has every stream since you opened your account, with skips, devices and countries, so it's the only way to get the full picture. You can still connect Spotify on top of it to keep things updated automatically.",
  },
  {
    q: "How do I get my export?",
    a: "Go to spotify.com/account/privacy, tick “Extended streaming history” and request it. Spotify emails you a zip, usually within a few days and at most 30. Drop the zip into Tracklens as is.",
  },
  {
    q: "What happens to my data?",
    a: "The zip is unpacked and parsed in your browser. IP addresses, user agents and your Spotify username in the export are dropped before anything is uploaded. We store the plays (track, artist, album, time, duration, device type, country, skip/shuffle flags) so we can compute your stats. We never sell it.",
  },
  {
    q: "Can I delete everything?",
    a: "Yes. Settings has one button to delete all listening data and another to delete your account, which removes everything and cancels any subscription.",
  },
  {
    q: "Is Tracklens affiliated with Spotify?",
    a: "No. Tracklens is an independent product and is not affiliated with, endorsed by or sponsored by Spotify AB.",
  },
];

export default async function Landing() {
  const me = await getCurrentUser();

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <a href="#features" className="hidden rounded-lg px-3 py-2 text-ink-2 hover:text-ink sm:inline">Features</a>
            <a href="#pricing" className="hidden rounded-lg px-3 py-2 text-ink-2 hover:text-ink sm:inline">Pricing</a>
            <a href="#faq" className="hidden rounded-lg px-3 py-2 text-ink-2 hover:text-ink md:inline">FAQ</a>
            {me ? (
              <Link href="/app" className="inline-flex h-9 items-center rounded-lg bg-brand px-3.5 font-medium text-brand-ink hover:opacity-90">Open app</Link>
            ) : (
              <>
                <Link href="/sign-in" className="rounded-lg px-3 py-2 text-ink-2 hover:text-ink">Sign in</Link>
                <Link href="/sign-up" className="inline-flex h-9 items-center rounded-lg bg-brand px-3.5 font-medium text-brand-ink hover:opacity-90">Get started</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:pt-20">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-ink-3">Spotify listening analytics</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Your complete Spotify history, analysed for any period
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-ink-2">
              Import your extended streaming history and get habits, skips, sessions, discovery and playlist tracking,
              for any date range, not just once a year. Your export is parsed in the browser; IP addresses never leave your device.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={me ? "/app" : "/sign-up"} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-ink hover:opacity-90">
                {me ? "Open your dashboard" : "Start free"} <ArrowRight size={16} aria-hidden />
              </Link>
              <Link href="/share/demo" className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                View live demo
              </Link>
            </div>
          </div>

          <ProductPreview />
        </section>

        {/* Features */}
        <section id="features" className="border-t border-line bg-surface/50 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">Detailed analytics, not a top-5 list</h2>
              <p className="mt-3 text-ink-2">
                Every chart works on any date range: last 4 weeks, a single year, your whole history, or exact dates.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-lg border border-line bg-surface p-5">
                  <Icon size={16} aria-hidden className="text-ink-3" />
                  <h3 className="mt-3 text-[15px] font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  n: "1",
                  title: "Request your history",
                  body: (
                    <>On <a className="text-brand hover:underline" href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer">spotify.com/account/privacy</a>, select <em>Extended streaming history</em>. Spotify emails a zip within a few days.</>
                  ),
                },
                {
                  n: "2",
                  title: "Drop the zip",
                  body: "It's unpacked and parsed in your browser. IP addresses, user agents and your username are stripped before upload.",
                },
                {
                  n: "3",
                  title: "Optional: connect Spotify",
                  body: "Link your account and we'll pull your recent plays every hour, so your stats stay current between exports.",
                },
              ].map((s) => (
                <li key={s.n} className="relative rounded-lg border border-line bg-surface p-6">
                  <span className="tabular inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink">{s.n}</span>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-line bg-surface/50 py-20">
          <div className="mx-auto max-w-4xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Simple pricing</h2>
              <p className="mt-3 text-ink-2">Every analysis is free for your full history. Pro is for power users and curators.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <PlanCard
                name={PLANS.free.name}
                price="$0"
                cadence="forever"
                cta={me ? "Open app" : "Start free"}
                href={me ? "/app" : "/sign-up"}
                items={[
                  "Unlimited history import",
                  "All analytics on any date range",
                  "Artist & track deep dives",
                  `${PLANS.free.trackedPlaylists} tracked playlists`,
                  `${PLANS.free.shareLinks} share link`,
                ]}
              />
              <PlanCard
                highlight
                name={PLANS.pro.name}
                price={`$${PLANS.pro.price.monthly}`}
                cadence={`per month · or $${PLANS.pro.price.yearly}/year`}
                cta="Go Pro"
                href={me ? "/app/settings" : "/sign-up?next=/app/settings"}
                items={[
                  "Everything in Free",
                  "Live Spotify sync, hourly",
                  "Period compare: risers & fallers",
                  `${PLANS.pro.trackedPlaylists} tracked playlists + track changelog`,
                  `${PLANS.pro.shareLinks} share links`,
                  "CSV export of every play",
                ]}
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
            <div className="mt-8 divide-y divide-line rounded-lg border border-line bg-surface">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {f.q}
                    <span className="text-ink-3 transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-ink-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20">
          <div className="mx-auto max-w-4xl rounded-lg border border-line bg-surface px-6 py-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Your history is already waiting</h2>
            <p className="mx-auto mt-3 max-w-xl text-ink-2">Request the export today. It&apos;s free, and by the time it arrives your account will be ready.</p>
            <Link href={me ? "/app/import" : "/sign-up"} className="mt-7 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-ink hover:opacity-90">
              {me ? "Import your data" : "Create a free account"} <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-ink-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3"><Logo /><span>© {new Date().getFullYear()}</span></div>
          <p>Not affiliated with Spotify AB. Spotify is a trademark of Spotify AB.</p>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function PlanCard({ name, price, cadence, items, cta, href, highlight }: {
  name: string; price: string; cadence: string; items: string[]; cta: string; href: string; highlight?: boolean;
}) {
  return (
    <div className={"flex flex-col rounded-lg border bg-surface p-6 " + (highlight ? "border-brand ring-1 ring-brand" : "border-line")}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{name}</h3>
        {highlight && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">Most popular</span>}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="tabular text-4xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-ink-3">{cadence}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {items.map((i) => (
          <li key={i} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />{i}</li>
        ))}
      </ul>
      <Link href={href} className={
        "mt-8 inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium " +
        (highlight ? "bg-brand text-brand-ink hover:opacity-90" : "border border-line hover:bg-surface-2")
      }>{cta}</Link>
    </div>
  );
}

/* A static, hand-built preview of the dashboard (no screenshots). */
function ProductPreview() {
  const timeline = [42, 48, 39, 55, 61, 58, 66, 72, 64, 70, 81, 77, 69, 74, 88, 93, 85, 79, 90, 97, 92, 86, 99, 104];
  const max = Math.max(...timeline);
  const pts = timeline.map((v, i) => `${(i / (timeline.length - 1)) * 100},${100 - (v / max) * 88}`).join(" ");
  const artists = [
    { name: "Neon Gardens", h: "69 h", d: 2 },
    { name: "Paper Rivers", h: "29 h", d: 0 },
    { name: "Hollow Lights", h: "24 h", d: 4 },
    { name: "Glass Atlas", h: "22 h", d: -1 },
    { name: "Silver Ghosts", h: "19 h", d: 4 },
  ];
  // Deterministic pseudo-heat: commute, afternoon, late night peaks.
  const heat = (d: number, h: number) => {
    const base = [7, 8, 17, 18].includes(h) ? 5 : [21, 22, 23, 0].includes(h) ? 6 : h >= 2 && h <= 6 ? 0 : 2;
    const weekend = d >= 5 ? ([10, 11, 12, 13, 14].includes(h) ? 3 : -1) : 0;
    return Math.max(0, Math.min(7, base + weekend + ((d * 7 + h * 3) % 3) - 1));
  };

  return (
    <div className="relative mt-12 max-w-6xl" aria-label="Preview of the Tracklens dashboard" role="img">
      <div className="overflow-hidden rounded-lg border border-line bg-bg">
        <div className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-3/40" /><span className="h-2.5 w-2.5 rounded-full bg-ink-3/40" /><span className="h-2.5 w-2.5 rounded-full bg-ink-3/40" />
          <span className="ml-3 hidden items-center gap-1.5 text-xs text-ink-3 sm:inline-flex"><CalendarRange size={12} /> Last 12 months</span>
        </div>
        <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 md:col-span-3 md:grid-cols-4">
            {[
              ["Listening time", "455 h", "27,327 minutes"],
              ["Streams", "7,730", "≥ 30 s plays"],
              ["Artists", "128", "11 new this year"],
              ["Longest streak", "33 days", "current: 9"],
            ].map(([k, v, h]) => (
              <div key={k} className="rounded-lg border border-line bg-surface p-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-ink-3">{k}</div>
                <div className="tabular mt-1 text-lg font-semibold sm:text-xl">{v}</div>
                <div className="text-[11px] text-ink-3">{h}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-line bg-surface p-3 md:col-span-2">
            <div className="text-xs font-semibold">Listening time per week</div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-2 h-32 w-full sm:h-40">
              <defs>
                <linearGradient id="pv" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[25, 50, 75].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--grid)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />)}
              <polygon points={`0,100 ${pts} 100,100`} fill="url(#pv)" />
              <polyline points={pts} fill="none" stroke="var(--series-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>

          <div className="rounded-lg border border-line bg-surface p-3">
            <div className="text-xs font-semibold">Top artists</div>
            <ol className="mt-2 space-y-1.5">
              {artists.map((a, i) => (
                <li key={a.name} className="flex items-center gap-2 text-sm">
                  <span className="tabular w-4 text-right text-xs text-ink-3">{i + 1}</span>
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="tabular text-xs text-ink-2">{a.h}</span>
                  <span className="tabular inline-flex w-7 items-center justify-end text-[11px] font-medium text-good">
                    {a.d > 0 ? <><ArrowUp size={10} aria-hidden />{a.d}</> : <span className="text-ink-3">{a.d === 0 ? "=" : a.d}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-line bg-surface p-3 md:col-span-2">
            <div className="text-xs font-semibold">Listening clock</div>
            <div className="mt-2 grid gap-[2px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {Array.from({ length: 7 * 24 }, (_, i) => (
                <div key={i} className="aspect-square rounded-[2px]" style={{ background: `var(--seq-${heat(Math.floor(i / 24), i % 24)})` }} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface p-3">
            <div className="text-xs font-semibold">Listening personality</div>
            <div className="mt-2 text-base font-semibold">The Night Owl</div>
            <p className="text-xs text-ink-2">24% of your listening happens after 22:00.</p>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-2 text-xs text-ink-2">
              <ShieldAlert size={14} className="shrink-0 text-critical" aria-hidden />
              <span><strong className="text-ink">VIRAL HITS 2026</strong>: +9,600 followers in 3 days, flagged</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
