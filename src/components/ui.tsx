import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";

export function Card({ title, subtitle, action, children, className }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-lg border border-line bg-surface p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className="tabular mt-1.5 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Button({ href, children, variant = "primary", className, ...rest }: {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = clsx(
    "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:opacity-50",
    variant === "primary" && "bg-brand text-brand-ink hover:opacity-90",
    variant === "secondary" && "border border-line bg-surface hover:bg-surface-2",
    variant === "ghost" && "hover:bg-surface-2",
    variant === "danger" && "border border-line bg-surface text-critical hover:bg-surface-2",
    className,
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "good" | "critical" }) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
      tone === "neutral" && "bg-surface-2 text-ink-2",
      tone === "brand" && "bg-brand/15 text-brand",
      tone === "good" && "bg-good/15 text-good",
      tone === "critical" && "bg-critical/15 text-critical",
    )}>{children}</span>
  );
}

/** Rank movement: icon + number, never colour alone. */
export function RankDelta({ rank, prevRank, isNew }: { rank: number; prevRank: number | null; isNew?: boolean }) {
  if (isNew) return <Badge tone="brand"><Sparkles size={11} aria-hidden />New</Badge>;
  if (prevRank == null) return <span className="text-xs text-ink-3" title="Not in the previous period">—</span>;
  const d = prevRank - rank;
  if (d === 0) return <span className="text-xs text-ink-3" title="Same rank as previous period">=</span>;
  return (
    <span className={clsx("tabular inline-flex items-center text-xs font-medium", d > 0 ? "text-good" : "text-critical")}
      title={`${d > 0 ? "Up" : "Down"} ${Math.abs(d)} from #${prevRank}`}>
      {d > 0 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
      {Math.abs(d)}
      <span className="sr-only">{d > 0 ? "up" : "down"} from {prevRank}</span>
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-6 py-14 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Horizontal bar list (server component). Single series → one hue,
 * value as text in ink colour, bar carries magnitude only.
 */
export function BarList({ items, format, max }: {
  items: { key: string; label: ReactNode; value: number; href?: string; extra?: ReactNode }[];
  format: (v: number) => string;
  max?: number;
}) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-1.5">
      {items.map((i) => {
        const label = i.href ? <Link href={i.href} className="hover:underline">{i.label}</Link> : i.label;
        return (
          <li key={i.key} className="group relative" title={`${typeof i.label === "string" ? i.label : i.key}: ${format(i.value)}`}>
            <div className="relative h-8 overflow-hidden rounded-md bg-surface-2/60">
              <div className="absolute inset-y-0 left-0 rounded-r-[4px] bg-series-1/25 transition-colors group-hover:bg-series-1/40"
                style={{ width: `${Math.max(1.5, (i.value / m) * 100)}%` }} />
              <div className="relative flex h-full items-center justify-between gap-3 px-2.5 text-sm">
                <span className="truncate">{label}</span>
                <span className="tabular flex shrink-0 items-center gap-2 text-ink-2">{i.extra}{format(i.value)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
