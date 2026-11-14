/**
 * Follower anomaly detection for the playlist tracker. Pure functions, no I/O,
 * so they run in tests, server components and scripts alike.
 *
 * The idea (same family of heuristics artist.tools / Spot Check describe):
 * organic playlists grow at a fairly steady daily rate; bought followers show
 * up as a few days of growth far outside that rate, and are often followed by
 * a purge when Spotify removes the fake accounts.
 */

export type FollowerPoint = { day: string; followers: number | null };

export type Anomaly = {
  day: string;
  delta: number;
  pctOfFollowers: number;
  type: "spike" | "drop";
};

export type Change = { abs: number; pct: number | null } | null;

export type Verdict = "Looks organic" | "Unusual spikes" | "Likely botted" | "Not enough data";

export type Detection = {
  points: { day: string; followers: number }[];
  deltas: { day: string; delta: number; prev: number }[];
  baseline: { median: number; mad: number; threshold: number };
  anomalies: Anomaly[];
  flaggedDays: Set<string>;
  score: number; // 0–100
  verdict: Verdict;
  latest: number | null;
  change1d: Change;
  change7d: Change;
  change30d: Change;
  avgDailyGrowth: number | null; // organic rate: last 30 days, spike days excluded
  projection30d: number | null;
  spikeGrowth: number;
  grossGrowth: number;
};

const DAY_MS = 86_400_000;
const dayNum = (d: string) => Math.round(Date.parse(d + "T00:00:00Z") / DAY_MS);

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median absolute deviation, scaled to be comparable with a standard deviation. */
export function mad(xs: number[]): number {
  if (!xs.length) return 0;
  const m = median(xs);
  return 1.4826 * median(xs.map((x) => Math.abs(x - m)));
}

/** Normalised daily deltas; a gap of n days is spread evenly over n days. */
export function dailyDeltas(points: { day: string; followers: number }[]) {
  const out: { day: string; delta: number; prev: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const gap = Math.max(1, dayNum(points[i].day) - dayNum(points[i - 1].day));
    out.push({ day: points[i].day, delta: (points[i].followers - points[i - 1].followers) / gap, prev: points[i - 1].followers });
  }
  return out;
}

/** Change between the latest point and the latest point at least `days` earlier. */
export function changeOver(points: { day: string; followers: number }[], days: number): Change {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const target = dayNum(last.day) - days;
  let base: { day: string; followers: number } | null = null;
  for (let i = points.length - 2; i >= 0; i--) {
    if (dayNum(points[i].day) <= target) {
      base = points[i];
      break;
    }
  }
  if (!base) return null;
  const abs = last.followers - base.followers;
  return { abs, pct: base.followers > 0 ? abs / base.followers : null };
}

export const SPIKE_MAD_K = 6;

export function detect(series: FollowerPoint[]): Detection {
  const points = series
    .filter((p): p is { day: string; followers: number } => p.followers != null)
    .sort((a, b) => a.day.localeCompare(b.day));
  const deltas = dailyDeltas(points);
  const values = deltas.map((d) => d.delta);
  const med = median(values);
  const spread = Math.max(mad(values), 1); // flat-growth playlists have MAD 0
  const threshold = med + SPIKE_MAD_K * spread;

  const anomalies: Anomaly[] = [];
  for (const d of deltas) {
    const pctOf = d.prev > 0 ? d.delta / d.prev : 0;
    if (d.delta > threshold && d.delta > Math.max(50, 0.01 * d.prev)) {
      anomalies.push({ day: d.day, delta: d.delta, pctOfFollowers: pctOf, type: "spike" });
    } else if (d.delta < -50 && pctOf < -0.01) {
      anomalies.push({ day: d.day, delta: d.delta, pctOfFollowers: pctOf, type: "drop" });
    }
  }

  const spikeDays = new Set(anomalies.filter((a) => a.type === "spike").map((a) => a.day));
  const grossGrowth = values.filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const spikeGrowth = deltas.filter((d) => spikeDays.has(d.day)).reduce((a, d) => a + Math.max(0, d.delta - med), 0);
  const purges = anomalies.filter((a) => a.type === "drop").length;

  let score = grossGrowth > 0 ? (spikeGrowth / grossGrowth) * 100 : 0;
  score += Math.min(30, purges * 15);
  score = Math.round(Math.max(0, Math.min(100, score)));

  let verdict: Verdict;
  if (points.length < 7) verdict = "Not enough data";
  else if (score < 15) verdict = "Looks organic";
  else if (score < 45) verdict = "Unusual spikes";
  else verdict = "Likely botted";

  // Organic growth rate: last 30 days of deltas, ignoring flagged spikes.
  const last = points.at(-1);
  let avgDailyGrowth: number | null = null;
  if (last) {
    const since = dayNum(last.day) - 30;
    const recent = deltas.filter((d) => dayNum(d.day) > since && !spikeDays.has(d.day));
    if (recent.length) avgDailyGrowth = recent.reduce((a, d) => a + d.delta, 0) / recent.length;
  }

  return {
    points,
    deltas,
    baseline: { median: med, mad: spread, threshold },
    anomalies,
    flaggedDays: new Set(anomalies.map((a) => a.day)),
    score,
    verdict,
    latest: last?.followers ?? null,
    change1d: changeOver(points, 1),
    change7d: changeOver(points, 7),
    change30d: changeOver(points, 30),
    avgDailyGrowth,
    projection30d: last && avgDailyGrowth != null ? Math.round(last.followers + avgDailyGrowth * 30) : null,
    spikeGrowth,
    grossGrowth,
  };
}
