"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";

const axis = { stroke: "var(--text-3)", fontSize: 11, tickLine: false, axisLine: false } as const;

type TipProps = {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; name?: unknown; value?: unknown }[];
  label?: unknown;
};

function Tip({ active, payload, label, fmtLabel, fmtValue, name }: TipProps & {
  fmtLabel?: (l: string) => string;
  fmtValue: (v: number) => string;
  name: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs">
      <div className="text-ink-3">{fmtLabel ? fmtLabel(String(label)) : String(label ?? "")}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="tabular mt-0.5 font-medium text-ink">
          {payload.length > 1 ? `${String(p.name)}: ` : `${name}: `}
          {fmtValue(Number(p.value))}
        </div>
      ))}
    </div>
  );
}

const fmtBucket = (unit: "day" | "week" | "month") => (b: string) => {
  const d = new Date(b + "T12:00:00Z");
  if (unit === "month") return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  if (unit === "week") return "Week of " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const fmtTick = (unit: "day" | "week" | "month") => (b: string) => {
  const d = new Date(b + "T12:00:00Z");
  return unit === "month"
    ? d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const hoursFmt = (m: number) => (m >= 120 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);

/** Listening time over time. One series, one axis, crosshair tooltip. */
export function TimelineChart({ data, unit, height = 240 }: {
  data: { bucket: string; minutes: number }[];
  unit: "day" | "week" | "month";
  height?: number;
}) {
  return (
    <div style={{ height }} role="img" aria-label="Listening time over time">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="tl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="bucket" {...axis} tickFormatter={fmtTick(unit)} minTickGap={28} />
          <YAxis {...axis} width={48} tickFormatter={(v) => (v >= 120 ? `${Math.round(v / 60)}h` : `${v}m`)} />
          <Tooltip
            cursor={{ stroke: "var(--text-3)", strokeDasharray: "3 3" }}
            content={(p) => <Tip {...p} name="Listening" fmtLabel={fmtBucket(unit)} fmtValue={hoursFmt} />}
          />
          <Area isAnimationActive={false} type="monotone" dataKey="minutes" stroke="var(--series-1)" strokeWidth={2} fill="url(#tl)"
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Generic single-series column chart (hours of day, months, buckets). */
export function ColumnChart({ data, xKey, yKey, name, height = 200, format = "minutes", xFormat }: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  name: string;
  height?: number;
  format?: "minutes" | "count" | "percent";
  xFormat?: "hour" | "month" | "none";
}) {
  const fv = format === "percent" ? (v: number) => `${(v * 100).toFixed(0)}%` : format === "count" ? (v: number) => v.toLocaleString("en-US") : hoursFmt;
  const fx = xFormat === "hour" ? (h: string | number) => `${String(h).padStart(2, "0")}:00`
    : xFormat === "month" ? (m: string | number) => new Date(String(m).slice(0, 7) + "-15T12:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
    : (x: string | number) => String(x);
  return (
    <div style={{ height }} role="img" aria-label={name}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={xKey} {...axis} tickFormatter={fx} minTickGap={12} />
          <YAxis {...axis} width={48} tickFormatter={(v) => (format === "percent" ? `${Math.round(v * 100)}%` : format === "count" ? String(v) : v >= 120 ? `${Math.round(v / 60)}h` : `${v}m`)} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }}
            content={(p) => <Tip {...p} name={name} fmtLabel={(l) => fx(l)} fmtValue={fv} />} />
          <Bar isAnimationActive={false} dataKey={yKey} fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two-line comparison (A vs B) on one shared axis and unit. */
export function CompareLines({ data, aLabel, bLabel, height = 220 }: {
  data: { x: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  height?: number;
}) {
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--series-1)]" />{aLabel}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t-2 border-dashed border-[var(--series-2)]" />{bLabel}</span>
      </div>
      <div style={{ height }} role="img" aria-label={`${aLabel} vs ${bLabel}`}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="x" {...axis} />
            <YAxis {...axis} width={48} tickFormatter={(v) => (v >= 120 ? `${Math.round(v / 60)}h` : `${v}m`)} />
            <Tooltip content={(p) => <Tip {...p} name="" fmtValue={hoursFmt} />} />
            <Line isAnimationActive={false} name={aLabel} dataKey="a" stroke="var(--series-1)" strokeWidth={2} dot={false} />
            <Line isAnimationActive={false} name={bLabel} dataKey="b" stroke="var(--series-2)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Weekday × hour heatmap on the one-hue sequential ramp, quantised to 8 steps.
 * Every cell has a hover readout; a legend shows the scale.
 */
export function Heatmap({ cells }: { cells: { dow: number; hour: number; minutes: number }[] }) {
  const [hover, setHover] = useState<{ dow: number; hour: number; minutes: number } | null>(null);
  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.minutes]));
  const max = Math.max(1, ...cells.map((c) => c.minutes));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const step = (m: number) => (m <= 0 ? 0 : Math.min(7, 1 + Math.floor((m / max) * 6.999)));
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-[2px]" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}
          onMouseLeave={() => setHover(null)}>
          {days.map((d, di) => (
            <div key={d} className="contents">
              <div className="flex items-center text-[11px] text-ink-3">{d}</div>
              {Array.from({ length: 24 }, (_, h) => {
                const m = grid.get(`${di + 1}-${h}`) ?? 0;
                return (
                  <div key={h} className="h-5 rounded-[3px] sm:h-6 outline-offset-0 hover:outline hover:outline-2 hover:outline-[var(--text)]"
                    style={{ background: `var(--seq-${step(m)})` }}
                    onMouseEnter={() => setHover({ dow: di, hour: h, minutes: m })}
                    aria-label={`${d} ${h}:00, ${Math.round(m)} minutes`} />
                );
              })}
            </div>
          ))}
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center text-[10px] text-ink-3">{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
        <div className="tabular h-4 text-ink-2">
          {hover ? `${days[hover.dow]} ${String(hover.hour).padStart(2, "0")}:00–${String(hover.hour + 1).padStart(2, "0")}:00 · ${hoursFmt(hover.minutes)}` : "Hover a cell"}
        </div>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          {Array.from({ length: 8 }, (_, i) => <span key={i} className="h-3 w-3 rounded-[2px]" style={{ background: `var(--seq-${i})` }} />)}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

/** Followers over time for the playlist tracker; flagged days get a marker. */
export function FollowerChart({ data, height = 260 }: {
  data: { day: string; followers: number | null; flagged?: boolean }[];
  height?: number;
}) {
  return (
    <div style={{ height }} role="img" aria-label="Followers over time">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="day" {...axis} tickFormatter={fmtTick("day")} minTickGap={32} />
          <YAxis {...axis} width={56} domain={["auto", "auto"]} tickFormatter={(v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : String(v))} />
          <Tooltip cursor={{ stroke: "var(--text-3)", strokeDasharray: "3 3" }}
            content={(p) => <Tip {...p} name="Followers" fmtLabel={fmtBucket("day")} fmtValue={(v) => v.toLocaleString("en-US")} />} />
          <Line isAnimationActive={false} dataKey="followers" stroke="var(--series-1)" strokeWidth={2}
            dot={(props: { cx?: number; cy?: number; payload?: { flagged?: boolean }; index?: number }) =>
              props.payload?.flagged && props.cx != null && props.cy != null ? (
                <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill="var(--critical)" stroke="var(--surface)" strokeWidth={2} />
              ) : <g key={props.index} />}
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
