import { subDays, subMonths, startOfYear, endOfYear } from "date-fns";

export type RangeKey = "4w" | "6m" | "12m" | "all" | `y${number}` | "custom";

export type DateRange = {
  key: RangeKey;
  label: string;
  from: Date | null;
  to: Date | null;
};

export const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "4w", label: "4 weeks" },
  { key: "6m", label: "6 months" },
  { key: "12m", label: "12 months" },
  { key: "all", label: "All time" },
];

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Parses ?range=4w|6m|12m|all|y2024|custom&from=YYYY-MM-DD&to=YYYY-MM-DD.
 * Relative ranges are anchored to `anchor` (the user's latest play), so a
 * history imported months ago still shows something under "4 weeks".
 */
export function parseRange(sp: SP, anchor: Date | null, fallback: RangeKey = "12m"): DateRange {
  const raw = (one(sp.range) ?? fallback) as string;
  const end = anchor ?? new Date();
  if (raw === "4w") return { key: raw, label: "Last 4 weeks", from: subDays(end, 28), to: null };
  if (raw === "6m") return { key: raw, label: "Last 6 months", from: subMonths(end, 6), to: null };
  if (raw === "12m") return { key: raw, label: "Last 12 months", from: subMonths(end, 12), to: null };
  if (raw === "all") return { key: raw, label: "All time", from: null, to: null };
  const y = /^y(\d{4})$/.exec(raw);
  if (y) {
    const d = new Date(Date.UTC(Number(y[1]), 0, 1));
    return { key: raw as RangeKey, label: y[1], from: startOfYear(d), to: endOfYear(d) };
  }
  if (raw === "custom") {
    const f = one(sp.from);
    const t = one(sp.to);
    const from = f ? new Date(f + "T00:00:00Z") : null;
    const to = t ? new Date(t + "T23:59:59Z") : null;
    if ((from && !isNaN(+from)) || (to && !isNaN(+to))) {
      return { key: "custom", label: `${f ?? "…"} → ${t ?? "…"}`, from, to };
    }
  }
  return parseRange({ range: fallback }, anchor, fallback === "12m" ? "all" : "12m");
}

/** The period of equal length immediately before `r`, for rank movement and deltas. */
export function previousRange(r: DateRange, anchor: Date | null): DateRange | null {
  if (!r.from) return null;
  const to = r.to ?? anchor ?? new Date();
  const len = to.getTime() - r.from.getTime();
  return { key: "custom", label: "previous period", from: new Date(r.from.getTime() - len), to: r.from };
}

export function rangeQuery(r: DateRange): string {
  if (r.key === "custom") {
    const p = new URLSearchParams({ range: "custom" });
    if (r.from) p.set("from", r.from.toISOString().slice(0, 10));
    if (r.to) p.set("to", r.to.toISOString().slice(0, 10));
    return p.toString();
  }
  return `range=${r.key}`;
}

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
