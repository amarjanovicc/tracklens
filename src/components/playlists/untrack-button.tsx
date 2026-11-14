"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function UntrackButton({ spotifyId, name }: { spotifyId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-critical hover:bg-surface-2 disabled:opacity-50"
      onClick={async () => {
        if (!confirm(`Stop tracking "${name}"? Its history stays available if you add it again.`)) return;
        setBusy(true);
        const res = await fetch(`/api/playlists?id=${encodeURIComponent(spotifyId)}`, { method: "DELETE" });
        if (res.ok) {
          router.push("/app/playlists");
          router.refresh();
        } else setBusy(false);
      }}>
      <Trash2 size={15} aria-hidden />
      {busy ? "Removing…" : "Stop tracking"}
    </button>
  );
}
