"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useTransition } from "react";

const PRESETS = [
  { key: "4w", label: "4W" },
  { key: "6m", label: "6M" },
  { key: "12m", label: "12M" },
  { key: "all", label: "All" },
];

/** Date-range filter: presets + years + custom dates, in one row above the charts. */
export function RangePicker({ current, years, from, to }: { current: string; years: number[]; from?: string; to?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const go = (params: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) { if (v === null) next.delete(k); else next.set(k, v); }
    start(() => router.push(`${path}?${next.toString()}`, { scroll: false }));
  };
  return (
    <div className={clsx("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
      <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => go({ range: p.key, from: null, to: null })} aria-pressed={current === p.key}
            className={clsx("h-8 rounded-md px-3 text-sm", current === p.key ? "bg-surface-2 font-medium" : "text-ink-2 hover:text-ink")}>
            {p.label}
          </button>
        ))}
      </div>
      {years.length > 0 && (
        <select aria-label="Year" value={current.startsWith("y") ? current : ""}
          onChange={(e) => e.target.value && go({ range: e.target.value, from: null, to: null })}
          className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
          <option value="">Year…</option>
          {years.map((y) => <option key={y} value={`y${y}`}>{y}</option>)}
        </select>
      )}
      <form className="flex w-full items-center gap-1 text-sm sm:w-auto" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        go({ range: "custom", from: String(f.get("from") || "") || null, to: String(f.get("to") || "") || null });
      }}>
        <input name="from" type="date" defaultValue={from} aria-label="From" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 sm:flex-none" />
        <span className="text-ink-3">→</span>
        <input name="to" type="date" defaultValue={to} aria-label="To" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 sm:flex-none" />
        <button className="h-9 shrink-0 rounded-lg border border-line bg-surface px-3 hover:bg-surface-2">Apply</button>
      </form>
    </div>
  );
}
