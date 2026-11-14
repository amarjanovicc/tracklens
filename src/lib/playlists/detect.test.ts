import { describe, expect, it } from "vitest";
import { changeOver, detect, mad, median, type FollowerPoint } from "./detect";

function series(days: number, start: number, step: (i: number) => number): FollowerPoint[] {
  const out: FollowerPoint[] = [];
  let f = start;
  const t0 = Date.UTC(2026, 0, 1);
  for (let i = 0; i < days; i++) {
    if (i > 0) f += step(i);
    out.push({ day: new Date(t0 + i * 86_400_000).toISOString().slice(0, 10), followers: f });
  }
  return out;
}

// Deterministic "noisy" organic growth: 20–40 followers a day.
const organicStep = (i: number) => 20 + ((i * 7919) % 21);

describe("median / mad", () => {
  it("computes robust stats", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(mad([1, 1, 1, 1])).toBe(0);
  });
});

describe("detect", () => {
  it("rates steady organic growth as organic", () => {
    const d = detect(series(120, 5000, organicStep));
    expect(d.anomalies).toHaveLength(0);
    expect(d.score).toBeLessThan(15);
    expect(d.verdict).toBe("Looks organic");
    expect(d.avgDailyGrowth).toBeGreaterThan(20);
    expect(d.avgDailyGrowth).toBeLessThan(40);
  });

  it("flags an injected follower spike and scores it high", () => {
    const d = detect(series(120, 5000, (i) => organicStep(i) + (i >= 60 && i < 63 ? 2500 : 0)));
    const spikes = d.anomalies.filter((a) => a.type === "spike");
    expect(spikes.map((a) => a.day)).toEqual(["2026-03-02", "2026-03-03", "2026-03-04"]);
    expect(d.score).toBeGreaterThanOrEqual(45);
    expect(d.verdict).toBe("Likely botted");
    // The organic rate ignores the spike days.
    expect(d.avgDailyGrowth).toBeLessThan(40);
  });

  it("detects a purge (sudden drop)", () => {
    const d = detect(series(90, 20000, (i) => (i === 50 ? -1500 : organicStep(i))));
    const drops = d.anomalies.filter((a) => a.type === "drop");
    expect(drops).toHaveLength(1);
    expect(drops[0].delta).toBe(-1500);
    expect(d.score).toBeGreaterThanOrEqual(15);
    expect(d.verdict).toBe("Unusual spikes");
  });

  it("ignores small absolute jumps on tiny playlists", () => {
    const d = detect(series(60, 40, (i) => (i === 30 ? 30 : 1)));
    expect(d.anomalies).toHaveLength(0);
  });

  it("handles gaps and nulls", () => {
    const s = series(30, 1000, () => 10);
    s[10].followers = null;
    const d = detect(s.filter((_, i) => i !== 20));
    expect(d.points).toHaveLength(28);
    expect(d.anomalies).toHaveLength(0);
    expect(d.verdict).toBe("Looks organic");
  });

  it("reports 'Not enough data' for short series", () => {
    expect(detect(series(3, 100, () => 5)).verdict).toBe("Not enough data");
  });
});

describe("changeOver", () => {
  it("computes change against the closest earlier snapshot", () => {
    const s = series(40, 1000, () => 10).map((p) => ({ day: p.day, followers: p.followers! }));
    expect(changeOver(s, 1)).toEqual({ abs: 10, pct: 10 / 1380 });
    expect(changeOver(s, 7)?.abs).toBe(70);
    expect(changeOver(s, 30)?.abs).toBe(300);
    expect(changeOver(s.slice(0, 5), 30)).toBeNull();
  });
});
