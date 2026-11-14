import "server-only";
import { sql } from "@/db";
import type { DateRange } from "@/lib/range";

/**
 * All listening analytics. Plain SQL on purpose: these are aggregate queries
 * with window functions that read better as SQL than as a query builder.
 *
 * Conventions
 *  - "minutes" = all time played, including skips.
 *  - "streams" = plays of at least 30 s (Spotify's own counting rule).
 *  - Calendar bucketing (hour, weekday, day) uses the user's timezone.
 */

export type Scope = {
  userId: string;
  from: Date | null;
  to: Date | null;
  tz: string;
  kind?: "track" | "episode" | "all";
};

export const scopeOf = (userId: string, r: DateRange, tz: string, kind: Scope["kind"] = "track"): Scope => ({
  userId,
  from: r.from,
  to: r.to,
  tz,
  kind,
});

function where(s: Scope) {
  return sql`user_id = ${s.userId}
    ${s.from ? sql`and played_at >= ${s.from}` : sql``}
    ${s.to ? sql`and played_at < ${s.to}` : sql``}
    ${s.kind && s.kind !== "all" ? sql`and kind = ${s.kind}` : sql``}`;
}

const local = (s: Scope) => sql`(played_at at time zone ${s.tz})`;

/* ------------------------------------------------------------------ */

export async function latestPlay(userId: string): Promise<Date | null> {
  const [r] = await sql<{ last: Date | null }[]>`select max(played_at) as last from play where user_id = ${userId}`;
  return r?.last ?? null;
}

export async function availableYears(userId: string, tz: string): Promise<number[]> {
  const rows = await sql<{ y: number }[]>`
    select distinct extract(year from played_at at time zone ${tz})::int as y
    from play where user_id = ${userId} order by 1 desc`;
  return rows.map((r) => r.y);
}

/* ------------------------------ Overview ---------------------------- */

export type Overview = {
  plays: number;
  streams: number;
  minutes: number;
  artists: number;
  tracks: number;
  albums: number;
  activeDays: number;
  first: Date | null;
  last: Date | null;
  skipRate: number;
  shuffleRate: number | null;
  offlineRate: number | null;
  longestStreak: number;
  currentStreak: number;
  bestDay: { day: string; minutes: number } | null;
};

export async function overview(s: Scope): Promise<Overview> {
  const [o] = await sql`
    select count(*)::int as plays,
      count(*) filter (where ms_played >= 30000)::int as streams,
      coalesce(sum(ms_played), 0)::float8 / 60000 as minutes,
      count(distinct artist_name)::int as artists,
      count(distinct (track_name, artist_name))::int as tracks,
      count(distinct (album_name, artist_name)) filter (where album_name is not null)::int as albums,
      count(distinct ${local(s)}::date)::int as active_days,
      min(played_at) as first, max(played_at) as last,
      coalesce(avg(skipped::int), 0)::float8 as skip_rate,
      avg(shuffle::int)::float8 as shuffle_rate,
      avg(offline::int)::float8 as offline_rate
    from play where ${where(s)}`;

  const days = await sql<{ d: string; minutes: number }[]>`
    select to_char(${local(s)}::date, 'YYYY-MM-DD') as d, sum(ms_played)::float8 / 60000 as minutes
    from play where ${where(s)} group by 1 order by 1`;

  const { longest, current } = streaks(days.map((d) => d.d));
  const best = days.reduce<{ day: string; minutes: number } | null>(
    (b, d) => (!b || d.minutes > b.minutes ? { day: d.d, minutes: d.minutes } : b),
    null,
  );
  return {
    plays: o.plays,
    streams: o.streams,
    minutes: o.minutes,
    artists: o.artists,
    tracks: o.tracks,
    albums: o.albums,
    activeDays: o.active_days,
    first: o.first,
    last: o.last,
    skipRate: o.skip_rate,
    shuffleRate: o.shuffle_rate,
    offlineRate: o.offline_rate,
    longestStreak: longest,
    currentStreak: current,
    bestDay: best,
  };
}

export function streaks(sortedDays: string[]) {
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sortedDays) {
    const t = Date.parse(d + "T00:00:00Z") / 86_400_000;
    run = prev !== null && t - prev === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  return { longest, current: run };
}

/* ------------------------------ Timeline ---------------------------- */

export type Unit = "day" | "week" | "month";

export function autoUnit(from: Date | null, to: Date | null, first: Date | null): Unit {
  const start = from ?? first;
  if (!start) return "month";
  const days = ((to ?? new Date()).getTime() - start.getTime()) / 86_400_000;
  if (days <= 62) return "day";
  if (days <= 730) return "week";
  return "month";
}

export async function timeline(s: Scope, unit: Unit) {
  return sql<{ bucket: string; minutes: number; streams: number; artists: number }[]>`
    select to_char(date_trunc(${unit}, ${local(s)}), 'YYYY-MM-DD') as bucket,
      sum(ms_played)::float8 / 60000 as minutes,
      count(*) filter (where ms_played >= 30000)::int as streams,
      count(distinct artist_name)::int as artists
    from play where ${where(s)} group by 1 order by 1`;
}

/* ------------------------------ Top lists --------------------------- */

export type TopRow = {
  name: string;
  artist: string;
  album?: string | null;
  uri?: string | null;
  minutes: number;
  streams: number;
  skipRate: number;
  tracks?: number;
  rank: number;
  prevRank: number | null;
  isNew: boolean; // first ever listen falls inside the range
};

type TopKind = "artists" | "tracks" | "albums";

function groupCols(kind: TopKind) {
  if (kind === "artists") return { sel: sql`artist_name as name, artist_name as artist`, grp: sql`artist_name` };
  if (kind === "tracks") return { sel: sql`track_name as name, artist_name as artist`, grp: sql`track_name, artist_name` };
  return { sel: sql`album_name as name, artist_name as artist`, grp: sql`album_name, artist_name` };
}

export async function top(
  s: Scope,
  kind: TopKind,
  opts: { limit?: number; sort?: "minutes" | "streams"; prev?: Scope | null } = {},
): Promise<TopRow[]> {
  const limit = opts.limit ?? 50;
  const order = opts.sort === "streams" ? sql`streams desc, minutes desc` : sql`minutes desc`;
  const g = groupCols(kind);
  const albumFilter = kind === "albums" ? sql`and album_name is not null` : sql``;

  const rows = await sql`
    select ${g.sel},
      max(track_uri) as uri,
      max(album_name) as album,
      sum(ms_played)::float8 / 60000 as minutes,
      count(*) filter (where ms_played >= 30000)::int as streams,
      avg(skipped::int)::float8 as skip_rate,
      count(distinct track_name)::int as tracks
    from play where ${where(s)} ${albumFilter}
    group by ${g.grp} order by ${order} limit ${limit}`;

  let prevRanks = new Map<string, number>();
  if (opts.prev) {
    const prev = await sql`
      select ${g.sel}, row_number() over (order by ${opts.sort === "streams" ? sql`count(*) filter (where ms_played >= 30000) desc` : sql`sum(ms_played) desc`})::int as rank
      from play where ${where(opts.prev)} ${albumFilter}
      group by ${g.grp} order by rank limit ${limit * 4}`;
    prevRanks = new Map(prev.map((r) => [`${r.name}\u0000${r.artist}`, r.rank as number]));
  }

  // First-ever listen, to badge discoveries.
  const firsts = new Map<string, Date>();
  const floor = s.from && rows.length ? await discoveryFloor(s) : null;
  if (floor && rows.length) {
    const names = rows.map((r) => r.name as string);
    const artists = rows.map((r) => r.artist as string);
    const fr = await sql`
      select ${g.sel}, min(played_at) as first from play
      where user_id = ${s.userId}
        and (${kind === "artists" ? sql`artist_name = any(${artists})` : kind === "tracks" ? sql`track_name = any(${names}) and artist_name = any(${artists})` : sql`album_name = any(${names}) and artist_name = any(${artists})`})
      group by ${g.grp}`;
    for (const r of fr) firsts.set(`${r.name}\u0000${r.artist}`, r.first as Date);
  }

  return rows.map((r, i) => {
    const key = `${r.name}\u0000${r.artist}`;
    const first = firsts.get(key);
    return {
      name: r.name,
      artist: r.artist,
      album: kind === "tracks" ? r.album : null,
      uri: kind === "tracks" ? r.uri : null,
      minutes: r.minutes,
      streams: r.streams,
      skipRate: r.skip_rate ?? 0,
      tracks: kind !== "tracks" ? r.tracks : undefined,
      rank: i + 1,
      prevRank: opts.prev ? (prevRanks.get(key) ?? null) : null,
      isNew: Boolean(first && floor && first >= floor),
    };
  });
}

/* ------------------------------ Habits ------------------------------ */

export async function clock(s: Scope) {
  // isodow: 1 = Monday … 7 = Sunday
  return sql<{ dow: number; hour: number; minutes: number }[]>`
    select extract(isodow from ${local(s)})::int as dow, extract(hour from ${local(s)})::int as hour,
      sum(ms_played)::float8 / 60000 as minutes
    from play where ${where(s)} group by 1, 2`;
}

export async function hourly(s: Scope) {
  return sql<{ hour: number; minutes: number; skipRate: number }[]>`
    select extract(hour from ${local(s)})::int as hour,
      sum(ms_played)::float8 / 60000 as minutes,
      avg(skipped::int)::float8 as "skipRate"
    from play where ${where(s)} group by 1 order by 1`;
}

export async function sessions(s: Scope, gapMinutes = 30) {
  const rows = await sql<{ started: Date; minutes: number; tracks: number }[]>`
    with p as (
      select played_at, ms_played,
        case when lag(played_at) over (order by played_at) is null
               or played_at - lag(played_at) over (order by played_at) > make_interval(mins => ${gapMinutes})
             then 1 else 0 end as is_start
      from play where ${where(s)}
    ), q as (select *, sum(is_start) over (order by played_at) as sid from p)
    select min(played_at) as started, sum(ms_played)::float8 / 60000 as minutes, count(*)::int as tracks
    from q group by sid`;
  if (!rows.length) return null;
  const mins = rows.map((r) => r.minutes).sort((a, b) => a - b);
  const longest = rows.reduce((a, b) => (b.minutes > a.minutes ? b : a));
  const buckets = [
    { label: "< 15 min", n: 0 },
    { label: "15–60 min", n: 0 },
    { label: "1–3 h", n: 0 },
    { label: "3 h +", n: 0 },
  ];
  for (const m of mins) buckets[m < 15 ? 0 : m < 60 ? 1 : m < 180 ? 2 : 3].n++;
  return {
    count: rows.length,
    avgMinutes: mins.reduce((a, b) => a + b, 0) / mins.length,
    medianMinutes: mins[Math.floor(mins.length / 2)],
    avgTracks: rows.reduce((a, b) => a + b.tracks, 0) / rows.length,
    longest,
    buckets,
  };
}

export async function breakdown(s: Scope, col: "platform" | "country" | "reason_start" | "reason_end") {
  const c = sql(col);
  return sql<{ key: string | null; minutes: number; plays: number }[]>`
    select ${c} as key, sum(ms_played)::float8 / 60000 as minutes, count(*)::int as plays
    from play where ${where(s)} group by 1 order by minutes desc limit 25`;
}

export async function flags(s: Scope) {
  const [r] = await sql`
    select
      avg(shuffle::int)::float8 as shuffle,
      avg(offline::int)::float8 as offline,
      avg(incognito::int)::float8 as incognito,
      avg(skipped::int) filter (where shuffle)::float8 as skip_shuffle,
      avg(skipped::int) filter (where not shuffle)::float8 as skip_ordered,
      avg((extract(isodow from ${local(s)}) >= 6)::int)::float8 as weekend_plays,
      sum(ms_played) filter (where extract(hour from ${local(s)}) >= 22 or extract(hour from ${local(s)}) < 5)::float8
        / nullif(sum(ms_played), 0) as night_share
    from play where ${where(s)}`;
  return r as {
    shuffle: number | null;
    offline: number | null;
    incognito: number | null;
    skip_shuffle: number | null;
    skip_ordered: number | null;
    weekend_plays: number | null;
    night_share: number | null;
  };
}

/* ------------------------------ Skips ------------------------------- */

export async function mostSkipped(s: Scope, minPlays = 5) {
  return sql<{ name: string; artist: string; plays: number; skipRate: number; avgSeconds: number }[]>`
    select track_name as name, artist_name as artist, count(*)::int as plays,
      avg(skipped::int)::float8 as "skipRate", avg(ms_played)::float8 / 1000 as "avgSeconds"
    from play where ${where(s)} group by 1, 2 having count(*) >= ${minPlays}
    order by "skipRate" desc, plays desc limit 15`;
}

export async function artistSkipRates(s: Scope, minPlays = 20) {
  return sql<{ artist: string; plays: number; skipRate: number }[]>`
    select artist_name as artist, count(*)::int as plays, avg(skipped::int)::float8 as "skipRate"
    from play where ${where(s)} group by 1 having count(*) >= ${minPlays}
    order by "skipRate" asc, plays desc limit 10`;
}

/* ------------------------------ Discovery --------------------------- */

/**
 * Discovery needs history before the range: in the first weeks of someone's
 * data *everything* looks new. Discoveries only count once 30 days of
 * history exist, and never before the range start.
 */
const WARMUP_MS = 30 * 86_400_000;
async function discoveryFloor(s: Scope): Promise<Date | null> {
  const [r] = await sql<{ first: Date | null }[]>`select min(played_at) as first from play where user_id = ${s.userId}`;
  if (!r?.first) return null;
  const warm = new Date(r.first.getTime() + WARMUP_MS);
  return s.from && s.from > warm ? s.from : warm;
}

export async function discoveryByMonth(s: Scope) {
  const floor = await discoveryFloor(s);
  if (!floor) return [];
  return sql<{ month: string; newArtists: number; newTracks: number }[]>`
    with fa as (
      select artist_name, min(played_at) as first from play
      where user_id = ${s.userId} and kind = 'track' group by 1
    ), ft as (
      select track_name, artist_name, min(played_at) as first from play
      where user_id = ${s.userId} and kind = 'track' group by 1, 2
    ), months as (
      select to_char(date_trunc('month', first at time zone ${s.tz}), 'YYYY-MM') as month, count(*)::int as n
      from fa where first >= ${floor} ${s.to ? sql`and first < ${s.to}` : sql``}
      group by 1
    ), tmonths as (
      select to_char(date_trunc('month', first at time zone ${s.tz}), 'YYYY-MM') as month, count(*)::int as n
      from ft where first >= ${floor} ${s.to ? sql`and first < ${s.to}` : sql``}
      group by 1
    )
    select coalesce(m.month, t.month) as month, coalesce(m.n, 0) as "newArtists", coalesce(t.n, 0) as "newTracks"
    from months m full join tmonths t on t.month = m.month order by 1`;
}

export async function topDiscoveries(s: Scope, limit = 12) {
  const floor = await discoveryFloor(s);
  if (!floor) return [];
  return sql<{ artist: string; first: Date; minutes: number; tracks: number }[]>`
    with fa as (
      select artist_name, min(played_at) as first from play
      where user_id = ${s.userId} and kind = 'track' group by 1
    )
    select p.artist_name as artist, fa.first, sum(p.ms_played)::float8 / 60000 as minutes,
      count(distinct p.track_name)::int as tracks
    from play p join fa on fa.artist_name = p.artist_name
    where ${where(s)} and fa.first >= ${floor}
    group by 1, 2 order by minutes desc limit ${limit}`;
}

/** Share of listening time that went to artists first heard in this range. */
export async function discoveryShare(s: Scope) {
  const floor = await discoveryFloor(s);
  if (!floor || (s.to && floor >= s.to)) return null;
  const [r] = await sql`
    with fa as (
      select artist_name, min(played_at) as first from play
      where user_id = ${s.userId} and kind = 'track' group by 1
    )
    select sum(p.ms_played) filter (where fa.first >= ${floor})::float8 / nullif(sum(p.ms_played), 0) as share
    from play p join fa on fa.artist_name = p.artist_name where ${where(s)} and p.played_at >= ${floor}`;
  return (r?.share as number | null) ?? null;
}

/**
 * Monthly diversity: unique artists, share of the top 10, and normalised
 * Shannon entropy over artist minutes (0 = one artist, 1 = perfectly even).
 */
export async function diversityByMonth(s: Scope) {
  const rows = await sql<{ month: string; artist: string; ms: number }[]>`
    select to_char(date_trunc('month', ${local(s)}), 'YYYY-MM') as month, artist_name as artist,
      sum(ms_played)::float8 as ms
    from play where ${where(s)} group by 1, 2`;
  const by = new Map<string, number[]>();
  for (const r of rows) {
    const a = by.get(r.month) ?? [];
    a.push(r.ms);
    by.set(r.month, a);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, arr]) => {
      const total = arr.reduce((x, y) => x + y, 0);
      const sorted = [...arr].sort((x, y) => y - x);
      const top10 = sorted.slice(0, 10).reduce((x, y) => x + y, 0) / total;
      const h = -arr.reduce((acc, v) => {
        const p = v / total;
        return acc + (p > 0 ? p * Math.log(p) : 0);
      }, 0);
      const entropy = arr.length > 1 ? h / Math.log(arr.length) : 0;
      return { month, artists: arr.length, top10Share: top10, entropy };
    });
}

export async function forgottenFavorites(userId: string, minMinutes = 180, quietDays = 180) {
  return sql<{ artist: string; minutes: number; last: Date; peakYear: number }[]>`
    with a as (
      select artist_name, sum(ms_played)::float8 / 60000 as minutes, max(played_at) as last,
        mode() within group (order by extract(year from played_at)::int) as peak_year
      from play where user_id = ${userId} and kind = 'track' group by 1
    ), latest as (select max(played_at) as t from play where user_id = ${userId})
    select artist_name as artist, minutes, last, peak_year as "peakYear"
    from a, latest where minutes >= ${minMinutes} and last < latest.t - make_interval(days => ${quietDays})
    order by minutes desc limit 12`;
}

/** Weeks where one song dominated: the most plays of a single track in a calendar week. */
export async function onRepeat(s: Scope, limit = 10) {
  return sql<{ name: string; artist: string; week: string; plays: number }[]>`
    select track_name as name, artist_name as artist,
      to_char(date_trunc('week', ${local(s)}), 'YYYY-MM-DD') as week, count(*)::int as plays
    from play where ${where(s)} and ms_played >= 30000
    group by 1, 2, 3 order by plays desc limit ${limit}`;
}

/** Artists that stay: present in the most distinct months. */
export async function loyalty(s: Scope, limit = 10) {
  return sql<{ artist: string; months: number; minutes: number }[]>`
    select artist_name as artist,
      count(distinct date_trunc('month', ${local(s)}))::int as months,
      sum(ms_played)::float8 / 60000 as minutes
    from play where ${where(s)} group by 1 order by months desc, minutes desc limit ${limit}`;
}

/* ------------------------------ Detail pages ------------------------ */

export async function artistDetail(userId: string, artist: string, tz: string) {
  const s: Scope = { userId, from: null, to: null, tz, kind: "all" };
  const w = sql`user_id = ${userId} and artist_name = ${artist}`;
  const [o] = await sql`
    select count(*)::int as plays, count(*) filter (where ms_played >= 30000)::int as streams,
      coalesce(sum(ms_played), 0)::float8 / 60000 as minutes, min(played_at) as first, max(played_at) as last,
      count(distinct track_name)::int as tracks, avg(skipped::int)::float8 as skip_rate
    from play where ${w}`;
  if (!o || o.plays === 0) return null;
  const [rank] = await sql`
    with a as (select artist_name, sum(ms_played) as ms from play where user_id = ${userId} group by 1)
    select (select count(*) from a where ms > (select ms from a where artist_name = ${artist}))::int + 1 as rank,
      (select ms from a where artist_name = ${artist})::float8 / nullif((select sum(ms) from a), 0) as share`;
  const monthly = await sql<{ month: string; minutes: number }[]>`
    select to_char(date_trunc('month', ${local(s)}), 'YYYY-MM-DD') as month, sum(ms_played)::float8 / 60000 as minutes
    from play where ${w} group by 1 order by 1`;
  const tracks = await sql<{ name: string; streams: number; minutes: number; skipRate: number; first: Date }[]>`
    select track_name as name, count(*) filter (where ms_played >= 30000)::int as streams,
      sum(ms_played)::float8 / 60000 as minutes, avg(skipped::int)::float8 as "skipRate", min(played_at) as first
    from play where ${w} group by 1 order by minutes desc limit 50`;
  const albums = await sql<{ name: string; minutes: number; tracks: number }[]>`
    select album_name as name, sum(ms_played)::float8 / 60000 as minutes, count(distinct track_name)::int as tracks
    from play where ${w} and album_name is not null group by 1 order by minutes desc limit 12`;
  const hours = await sql<{ hour: number; minutes: number }[]>`
    select extract(hour from ${local(s)})::int as hour, sum(ms_played)::float8 / 60000 as minutes
    from play where ${w} group by 1 order by 1`;
  return {
    plays: o.plays as number,
    streams: o.streams as number,
    minutes: o.minutes as number,
    first: o.first as Date,
    last: o.last as Date,
    tracks: o.tracks as number,
    skipRate: o.skip_rate as number,
    rank: rank.rank as number,
    share: rank.share as number,
    monthly,
    topTracks: tracks,
    albums,
    hours,
  };
}

export async function trackDetail(userId: string, track: string, artist: string, tz: string) {
  const s: Scope = { userId, from: null, to: null, tz, kind: "all" };
  const w = sql`user_id = ${userId} and track_name = ${track} and artist_name = ${artist}`;
  const [o] = await sql`
    select count(*)::int as plays, count(*) filter (where ms_played >= 30000)::int as streams,
      coalesce(sum(ms_played), 0)::float8 / 60000 as minutes, min(played_at) as first, max(played_at) as last,
      avg(skipped::int)::float8 as skip_rate, avg(ms_played)::float8 / 1000 as avg_seconds,
      max(ms_played)::float8 / 1000 as max_seconds, max(track_uri) as uri, max(album_name) as album
    from play where ${w}`;
  if (!o || o.plays === 0) return null;
  const monthly = await sql<{ month: string; streams: number }[]>`
    select to_char(date_trunc('month', ${local(s)}), 'YYYY-MM-DD') as month,
      count(*) filter (where ms_played >= 30000)::int as streams
    from play where ${w} group by 1 order by 1`;
  const reasons = await sql<{ key: string | null; plays: number }[]>`
    select reason_end as key, count(*)::int as plays from play where ${w} group by 1 order by 2 desc`;
  const hours = await sql<{ hour: number; plays: number }[]>`
    select extract(hour from ${local(s)})::int as hour, count(*)::int as plays from play where ${w} group by 1 order by 1`;
  return {
    plays: o.plays as number,
    streams: o.streams as number,
    minutes: o.minutes as number,
    first: o.first as Date,
    last: o.last as Date,
    skipRate: o.skip_rate as number,
    avgSeconds: o.avg_seconds as number,
    // Rough completion: avg played vs. longest single play of the same track.
    completion: o.max_seconds ? Math.min(1, (o.avg_seconds as number) / (o.max_seconds as number)) : null,
    uri: o.uri as string | null,
    album: o.album as string | null,
    monthly,
    reasons,
    hours,
  };
}

/* ------------------------------ Compare ----------------------------- */

export async function movers(a: Scope, b: Scope, limit = 10) {
  // a = earlier period, b = later period
  const rows = await sql<{ artist: string; a: number; b: number }[]>`
    with x as (
      select artist_name, sum(ms_played)::float8 / 60000 as m from play where ${where(a)} group by 1
    ), y as (
      select artist_name, sum(ms_played)::float8 / 60000 as m from play where ${where(b)} group by 1
    )
    select coalesce(x.artist_name, y.artist_name) as artist, coalesce(x.m, 0) as a, coalesce(y.m, 0) as b
    from x full join y on x.artist_name = y.artist_name`;
  const withDelta = rows.map((r) => ({ ...r, delta: r.b - r.a }));
  return {
    risers: [...withDelta].sort((p, q) => q.delta - p.delta).slice(0, limit),
    fallers: [...withDelta].sort((p, q) => p.delta - q.delta).slice(0, limit),
    overlap:
      rows.filter((r) => r.a > 0 && r.b > 0).length / Math.max(1, rows.filter((r) => r.a > 0 || r.b > 0).length),
  };
}

/* ------------------------------ Personality ------------------------- */

export type Trait = { id: string; label: string; blurb: string; score: number };

/**
 * Rule-based listening archetypes, in the spirit of Wrapped's "listening
 * personality" and Obscurify. Each trait has a 0–1 score; we surface the top two.
 */
export function personality(input: {
  overview: Overview;
  flags: Awaited<ReturnType<typeof flags>>;
  discoveryShare: number | null;
  top10Share: number | null;
}): Trait[] {
  const { overview: o, flags: f } = input;
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const traits: Trait[] = [
    {
      id: "explorer",
      label: "The Explorer",
      blurb: "A big slice of your time goes to artists you had never played before.",
      score: clamp(((input.discoveryShare ?? 0) - 0.1) / 0.3),
    },
    {
      id: "loyalist",
      label: "The Loyalist",
      blurb: "You keep coming back to the same core of artists.",
      score: clamp(((input.top10Share ?? 0) - 0.35) / 0.4),
    },
    {
      id: "night-owl",
      label: "The Night Owl",
      blurb: "Your listening peaks after 22:00.",
      score: clamp(((f.night_share ?? 0) - 0.12) / 0.25),
    },
    {
      id: "skipper",
      label: "The Curator",
      blurb: "You skip ruthlessly until the right song comes on.",
      score: clamp((o.skipRate - 0.2) / 0.3),
    },
    {
      id: "album",
      label: "The Album Listener",
      blurb: "Shuffle off, front to back, the way it was sequenced.",
      score: f.shuffle === null ? 0 : clamp((0.5 - f.shuffle) / 0.4),
    },
    {
      id: "marathoner",
      label: "The Marathoner",
      blurb: "Music is on almost every day.",
      score: clamp((o.longestStreak - 14) / 60),
    },
  ];
  return traits.sort((a, b) => b.score - a.score).slice(0, 2);
}
