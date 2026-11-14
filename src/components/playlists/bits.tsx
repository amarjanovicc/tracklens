import clsx from "clsx";
import { AlertTriangle, ArrowDown, ArrowUp, ListMusic, Minus, ShieldAlert, ShieldCheck, HelpCircle } from "lucide-react";
import type { Change, Verdict } from "@/lib/playlists/detect";
import { fmtInt } from "@/lib/format";

/** Follower change: sign + icon + number; colour only reinforces. */
export function ChangeValue({ change, showPct = true, className }: { change: Change; showPct?: boolean; className?: string }) {
  if (!change) return <span className={clsx("text-ink-3", className)} title="Not enough history yet">–</span>;
  const { abs, pct } = change;
  const up = abs > 0;
  const flat = Math.round(abs) === 0;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className={clsx("tabular inline-flex items-center gap-0.5 whitespace-nowrap", flat ? "text-ink-3" : up ? "text-good" : "text-critical", className)}>
      <Icon size={12} aria-hidden />
      {up ? "+" : ""}{fmtInt(abs)}
      {showPct && pct != null && !flat && <span className="ml-1 text-xs opacity-80">({up ? "+" : ""}{(pct * 100).toFixed(pct !== 0 && Math.abs(pct) < 0.01 ? 2 : 1)}%)</span>}
      <span className="sr-only">{flat ? "no change" : up ? "increase" : "decrease"}</span>
    </span>
  );
}

const VERDICT: Record<Verdict, { icon: typeof ShieldCheck; cls: string }> = {
  "Looks organic": { icon: ShieldCheck, cls: "bg-good/15 text-good" },
  "Unusual spikes": { icon: AlertTriangle, cls: "bg-surface-2 text-ink" },
  "Likely botted": { icon: ShieldAlert, cls: "bg-critical/15 text-critical" },
  "Not enough data": { icon: HelpCircle, cls: "bg-surface-2 text-ink-3" },
};

export function VerdictBadge({ verdict, score }: { verdict: Verdict; score?: number }) {
  const { icon: Icon, cls } = VERDICT[verdict];
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", cls)}
      title={score != null && verdict !== "Not enough data" ? `Suspicion score ${score}/100` : undefined}>
      <Icon size={12} aria-hidden />
      {verdict}
      {score != null && verdict !== "Not enough data" && <span className="tabular opacity-70">· {score}</span>}
    </span>
  );
}

export function Cover({ url, size = 48 }: { url: string | null; size?: number }) {
  if (!url) {
    return (
      <div className="flex shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-3" style={{ width: size, height: size }}>
        <ListMusic size={size * 0.42} aria-hidden />
      </div>
    );
  }
  // Spotify serves covers from several CDN hosts; a plain <img> avoids image-optimizer host allowlists.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-md object-cover" style={{ width: size, height: size }} />;
}
