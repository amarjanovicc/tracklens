# Tracklens

Deep listening analytics from your **entire** Spotify history, plus a playlist tracker with bot detection.
It started as a rewrite of `amarjanovicc/spotify` (a Vite PKCE demo showing one playlist's followers) and
`Spotify-playlist-track` (an unfinished PHP/MySQL playlist tracker). Tracklens is a working name.

## Who it is for

| Who | What they get |
|---|---|
| **Listeners** | "Wrapped any time": top lists with rank movement, listening clock, skips, sessions, discovery, diversity, forgotten favourites, artist and track deep dives, year-vs-year compare, shareable cards |
| **Curators** | Daily follower history for their playlists, 1d/7d/30d growth, projection, and a changelog of added/removed tracks for playlists they own |
| **Artists & managers** | Vet playlists before paying for placement: spike/purge detection and a 0–100 suspicion score |

## Why import-first (the Spotify API reality in 2026)

Since the **February 2026 Web API changes**, Development Mode apps are capped at **5 users**, the owner needs Premium, and
extended quota is only granted to organisations with large MAU. Audio features, recommendations, related artists, `popularity`,
artist `followers` and batch "several" endpoints are gone. Playlist items are only readable for playlists the user owns or
collaborates on. `/me/player/recently-played` only ever returns the last 50 plays.

So a real SaaS can't be built on "Log in with Spotify" alone. Tracklens is built around the **Extended streaming history**
privacy export (the full lifetime log, with skips, devices, countries, shuffle) that every user can request, which is the same
approach stats.fm Plus and your_spotify use. Spotify OAuth is an optional add-on for live sync and owned-playlist changelogs.

The export is **parsed in the browser**: IP addresses, user agents and the account username never reach the server.

## What we borrowed from existing products (ideas, not code)

- **stats.fm / your_spotify**: import the extended history, then keep it fresh by polling recently-played. Dedupe on re-import.
- **Wrapped / Obscurify / Receiptify**: listening personality archetypes, shareable public cards.
- **artist.tools / Spot Check**: playlist bot check from follower spikes without matching organic growth, purge detection.
- **Last.fm**: streaks, "on repeat" weeks, long-term loyalty ("ride or die").
- your_spotify is GPL-3.0, so no code was copied.

## Stack and why

| Layer | Choice | Reason |
|---|---|---|
| App | **Next.js 16** (App Router, Turbopack), React 19, TypeScript | One deployable for UI, API routes and crons; server components keep analytics SQL on the server |
| DB | **PostgreSQL** + **Drizzle ORM** | The analytics are window functions, `date_trunc`, `AT TIME ZONE`, `mode()`. Postgres does this in ~0.5 s for a full dashboard on 25k plays. Works on Neon/Supabase |
| Auth | **Better Auth** (email + password) | Self-hosted, Drizzle adapter, no per-MAU fees. Spotify is linked separately because the Spotify user object no longer has an email |
| Charts | **Recharts** + hand-built heatmap | Palette and mark rules follow a CVD-validated reference palette; one axis per chart; every chart has hover readouts |
| Billing | **Stripe** Checkout + Customer Portal + webhook | Disabled automatically when keys are missing |
| Jobs | **Vercel Cron** → `/api/cron/*` (Bearer `CRON_SECRET`) | No queue infra needed at this scale |

## Plans

| | Free | Pro ($4/mo or $36/yr) |
|---|---|---|
| Import + all listening analytics | ✓ | ✓ |
| Tracked playlists | 2 | 50 |
| Share links | 1 | 100 |
| Live sync (hourly) | – | ✓ |
| Playlist changelog (owned playlists) | – | ✓ |
| Compare periods | – | ✓ |
| CSV export | – | ✓ |

Limits live in `src/lib/plans.ts`.

## Run it locally

```bash
npm install
cp .env.example .env.local            # then fill in the values
createdb tracklens                    # any Postgres 15+ works
npm run db:migrate
npm run seed                          # demo@tracklens.dev / demo-password, plus /share/demo
npm run dev -- -H 127.0.0.1           # http://127.0.0.1:3000
```

Use `127.0.0.1`, not `localhost`: Spotify no longer accepts `localhost` redirect URIs.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

### Spotify (optional)
1. Create an app at developer.spotify.com/dashboard (Web API).
2. Redirect URI: `http://127.0.0.1:3000/api/spotify/callback` (and your production URL).
3. In Development Mode, add up to 5 users under *User Management*. Others get a clear "not allow-listed" message.
4. Set `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`. The playlist tracker uses the client-credentials flow for public playlists.

### Stripe (optional)
Create a "Pro" product with a monthly and a yearly price, set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_MONTHLY`,
`STRIPE_PRICE_PRO_YEARLY`, and point a webhook at `/api/stripe/webhook` (`checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`) and set `STRIPE_WEBHOOK_SECRET`.
Locally: `stripe listen --forward-to 127.0.0.1:3000/api/stripe/webhook`.

## Deploy (Vercel + Neon)

1. Create a Neon (or Supabase) Postgres database and set `DATABASE_URL` (pooled URL is fine, `prepare: false` is set).
2. `npm run db:migrate` against it.
3. Import the repo in Vercel, set every variable from `.env.example`, with `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` set to the production URL.
4. Crons in `vercel.json`: daily live sync and daily playlist snapshots (Hobby allows one run per day). For hourly sync use Vercel Pro (`0 * * * *`) or an external scheduler.

## Layout

```
src/
  app/
    page.tsx                     landing + pricing + FAQ
    (auth)/sign-in, sign-up
    app/                         the product (auth-guarded by proxy.ts + DAL)
      page.tsx                   overview
      top/ habits/ discovery/ compare/
      artist/[name]/ track/[artist]/[name]/
      playlists/ playlists/[id]/
      import/ settings/
    share/[slug]/                public "Wrapped any time" page
    api/
      import/                    chunked import (≤2000 rows per request)
      spotify/connect|callback|disconnect|sync
      playlists/  share/  settings/  account/  export/
      stripe/checkout|portal|webhook
      cron/sync  cron/playlists
  db/schema.ts                   Drizzle schema (auth + plays + playlists + shares)
  lib/
    analytics/                   all listening SQL (overview, top, clock, sessions, skips, discovery, diversity, compare, personality)
    import/normalize.ts          export parser (runs in the browser)
    playlists/detect.ts          spike/purge detection + suspicion score
    spotify/                     API client with token refresh, recently-played sync
scripts/
  seed-demo.ts, demo-history.ts  deterministic fictional history generator
```

## Definitions

- **Stream**: a play of at least 30 seconds (Spotify's own counting rule). **Listening time** includes skips.
- **Skip**: Spotify's `skipped` flag, or under 30 s ending with the forward/back button.
- **Session**: plays separated by less than 30 minutes of silence.
- **Diversity**: Shannon entropy of artist listening time per month, normalised to 0–100.
- **Discovery**: an artist or track whose first-ever play falls inside the selected range.
- Calendar bucketing (hours, weekdays, days) uses the timezone set in Settings.

## Not done yet / ideas

- Email alerts for playlist anomalies (needs an email provider such as Resend).
- Genre data: Spotify removed batch artist lookups; a per-artist cached lookup or MusicBrainz tags would work.
- Background import for very large exports (today the browser uploads in 2000-row chunks, which handles typical 100–300k-play exports).
- Teams/label workspace for managers tracking many playlists.
- Legal review of the privacy and terms templates.

Not affiliated with Spotify AB.
