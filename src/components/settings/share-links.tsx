"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { ErrorText, useApi } from "./use-api";

type LinkRow = { slug: string; title: string; views: number; period: string };

export function ShareLinks({ links, years, limit, hasData }: { links: LinkRow[]; years: number[]; limit: number; hasData: boolean }) {
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [copied, setCopied] = useState<string | null>(null);
  const atLimit = links.length >= limit;

  return (
    <div>
      {links.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {links.map((l) => (
            <li key={l.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{l.title}</div>
                <div className="tabular text-xs text-ink-3">{l.period} · {l.views.toLocaleString("en-US")} view{l.views === 1 ? "" : "s"}</div>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded-md p-2 text-ink-2 hover:bg-surface-2" aria-label={`Copy link to ${l.title}`}
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/share/${l.slug}`);
                    setCopied(l.slug);
                    setTimeout(() => setCopied(null), 1500);
                  }}>
                  {copied === l.slug ? <Check size={16} className="text-good" /> : <Copy size={16} />}
                </button>
                <Link href={`/share/${l.slug}`} target="_blank" className="rounded-md p-2 text-ink-2 hover:bg-surface-2" aria-label={`Open ${l.title}`}>
                  <ExternalLink size={16} />
                </Link>
                <button className="rounded-md p-2 text-ink-2 hover:bg-surface-2 hover:text-critical" aria-label={`Delete ${l.title}`}
                  disabled={pending}
                  onClick={async () => {
                    if (!confirm(`Delete "${l.title}"? The link will stop working.`)) return;
                    if (await call(`/api/share?slug=${encodeURIComponent(l.slug)}`, { method: "DELETE" })) router.refresh();
                  }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">No share links yet.</p>
      )}

      <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const r = await call("/api/share", { method: "POST", body: { title: f.get("title"), range: f.get("range") } });
        if (r) { (e.target as HTMLFormElement).reset(); router.refresh(); }
      }}>
        <label className="min-w-48 flex-1">
          <span className="mb-1.5 block text-sm font-medium">Title</span>
          <input name="title" required maxLength={80} defaultValue="My listening" className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm" />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium">Period</span>
          <select name="range" defaultValue="12m" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
            <option value="4w">Last 4 weeks</option>
            <option value="6m">Last 6 months</option>
            <option value="12m">Last 12 months</option>
            <option value="all">All time</option>
            {years.map((y) => <option key={y} value={`y${y}`}>{y}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={pending || atLimit || !hasData}>Create link</Button>
      </form>
      <p className="mt-2 text-xs text-ink-3">
        {!hasData ? "Import your history first." : atLimit ? `You've used all ${limit} share link${limit === 1 ? "" : "s"} on your plan.` :
          "Links show your name, top artists and tracks, and totals for the period. Never your email."}
      </p>
      <ErrorText error={error} />
    </div>
  );
}
