"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

export function AddPlaylistForm({ disabled, disabledReason }: { disabled?: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setUrl("");
      start(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="playlist-url" className="sr-only">Spotify playlist link</label>
        <input id="playlist-url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={disabled || busy}
          placeholder="https://open.spotify.com/playlist/…"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-ink-3 disabled:opacity-60" />
        <button type="submit" disabled={disabled || busy || !url.trim()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-brand-ink hover:opacity-90 disabled:opacity-50">
          <Plus size={16} aria-hidden />
          {busy ? "Adding…" : "Track playlist"}
        </button>
      </div>
      {disabled && disabledReason && <p className="mt-2 text-sm text-ink-2">{disabledReason}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-critical">{error}</p>}
    </form>
  );
}
