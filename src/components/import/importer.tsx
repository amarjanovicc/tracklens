"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, FileArchive, Loader2, ShieldCheck, TriangleAlert, Upload } from "lucide-react";
import { isHistoryFile, normalizeFile, type NormalizedPlay } from "@/lib/import/normalize";

type Phase =
  | { t: "idle" }
  | { t: "reading"; detail: string }
  | { t: "uploading"; done: number; total: number; inserted: number }
  | { t: "done"; parsed: number; inserted: number; files: number; from: string; to: string }
  | { t: "error"; message: string };

const BATCH = 2000;

async function post(body: unknown) {
  const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`);
  return json;
}

/** Reads .zip / .json files locally, extracts only streaming-history entries. */
async function readFiles(files: File[], onStep: (s: string) => void) {
  const plays: NormalizedPlay[] = [];
  let used = 0;
  for (const f of files) {
    if (f.name.toLowerCase().endsWith(".zip")) {
      onStep(`Opening ${f.name}…`);
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(f);
      const entries = Object.values(zip.files).filter((e) => !e.dir && isHistoryFile(e.name));
      for (const e of entries) {
        onStep(`Reading ${e.name.split("/").pop()}…`);
        plays.push(...normalizeFile(JSON.parse(await e.async("string"))));
        used++;
      }
    } else if (f.name.toLowerCase().endsWith(".json")) {
      onStep(`Reading ${f.name}…`);
      try {
        const n = normalizeFile(JSON.parse(await f.text()));
        if (n.length) { plays.push(...n); used++; }
      } catch {
        throw new Error(`${f.name} is not valid JSON.`);
      }
    }
  }
  return { plays, used };
}

export function Importer() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<Phase>({ t: "idle" });
  const busy = phase.t === "reading" || phase.t === "uploading";

  const run = useCallback(async (files: File[]) => {
    let jobId: number | null = null;
    try {
      setPhase({ t: "reading", detail: "Reading files…" });
      const { plays, used } = await readFiles(files, (detail) => setPhase({ t: "reading", detail }));
      if (!plays.length) {
        throw new Error(
          "No streaming history found. Upload the my_spotify_data.zip from Spotify, or the Streaming_History_Audio_*.json / StreamingHistory_music_*.json files inside it.",
        );
      }
      plays.sort((a, b) => a.playedAt.localeCompare(b.playedAt));
      ({ jobId } = await post({ action: "start", files: used }));
      let inserted = 0;
      for (let i = 0; i < plays.length; i += BATCH) {
        setPhase({ t: "uploading", done: i, total: plays.length, inserted });
        const r = await post({ action: "batch", jobId, plays: plays.slice(i, i + BATCH) });
        inserted += r.inserted;
      }
      await post({ action: "finish", jobId });
      setPhase({
        t: "done",
        parsed: plays.length,
        inserted,
        files: used,
        from: plays[0].playedAt.slice(0, 10),
        to: plays[plays.length - 1].playedAt.slice(0, 10),
      });
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Import failed";
      if (jobId) await post({ action: "finish", jobId, error: message }).catch(() => {});
      setPhase({ t: "error", message });
    }
  }, [router]);

  const trySample = async () => {
    setPhase({ t: "reading", detail: "Downloading sample…" });
    const res = await fetch("/sample/Streaming_History_Audio_sample.json");
    const blob = await res.blob();
    run([new File([blob], "Streaming_History_Audio_sample.json")]);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) run([...e.dataTransfer.files]); }}
        className={clsx(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
          drag ? "border-brand bg-brand/5" : "border-line bg-surface",
        )}
      >
        <FileArchive size={32} className="text-ink-3" aria-hidden />
        <p className="mt-3 font-medium">Drop <code className="rounded bg-surface-2 px-1.5 py-0.5 text-sm">my_spotify_data.zip</code> here</p>
        <p className="mt-1 text-sm text-ink-3">or the JSON files inside it. Several files at once are fine.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button disabled={busy} onClick={() => input.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-ink disabled:opacity-50">
            <Upload size={15} aria-hidden /> Choose files
          </button>
          <button disabled={busy} onClick={trySample}
            className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm hover:bg-surface-2 disabled:opacity-50">
            Try with sample data
          </button>
        </div>
        <input ref={input} type="file" multiple accept=".zip,.json,application/zip,application/json" className="hidden"
          onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) run(f); }} />
        <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-ink-3">
          <ShieldCheck size={14} aria-hidden /> Parsed in your browser. IP addresses, user agents and your username are never uploaded.
        </p>
      </div>

      <div aria-live="polite">
        {phase.t === "reading" && (
          <Status icon={<Loader2 className="animate-spin" size={16} />}>{phase.detail}</Status>
        )}
        {phase.t === "uploading" && (
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} />Uploading streams…</span>
              <span className="tabular text-ink-3">{phase.done.toLocaleString()} / {phase.total.toLocaleString()}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(phase.done / phase.total) * 100}%` }} />
            </div>
          </div>
        )}
        {phase.t === "done" && (
          <Status icon={<CheckCircle2 size={16} className="text-good" />}>
            Imported <b>{phase.inserted.toLocaleString()}</b> new streams from {phase.files} file{phase.files === 1 ? "" : "s"} ({phase.from} → {phase.to}).
            {phase.parsed > phase.inserted && <> {(phase.parsed - phase.inserted).toLocaleString()} were already in your library and were skipped.</>}
            {" "}<a href="/app" className="font-medium text-brand underline">Open your dashboard →</a>
          </Status>
        )}
        {phase.t === "error" && (
          <Status icon={<TriangleAlert size={16} className="text-critical" />}><span className="sr-only">Error: </span>{phase.message}</Status>
        )}
      </div>
    </div>
  );
}

function Status({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-4 text-sm"><span className="mt-0.5">{icon}</span><div>{children}</div></div>;
}
