"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { ErrorText, useApi } from "./use-api";

const PHRASE = { plays: "delete my data", account: "delete my account" } as const;

export function DangerZone() {
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [open, setOpen] = useState<null | "plays" | "account">(null);
  const [typed, setTyped] = useState("");

  return (
    <div className="space-y-4">
      <Row title="Delete all listening data" body="Removes every imported and synced play. Your account, playlists and settings stay."
        action={<Button variant="danger" onClick={() => { setOpen("plays"); setTyped(""); }}>Delete data</Button>} />
      <Row title="Delete account" body="Cancels any subscription and permanently deletes your account and everything in it."
        action={<Button variant="danger" onClick={() => { setOpen("account"); setTyped(""); }}>Delete account</Button>} />

      {open && (
        <div className="rounded-xl border border-critical/40 bg-critical/5 p-4">
          <p className="text-sm">
            This cannot be undone. Type <code className="rounded bg-surface-2 px-1 font-mono">{PHRASE[open]}</code> to confirm.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirmation phrase" autoFocus
              className="h-9 min-w-56 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" />
            <Button variant="danger" disabled={pending || typed.trim().toLowerCase() !== PHRASE[open]}
              onClick={async () => {
                const ok = await call("/api/account", { method: "DELETE", body: { scope: open } });
                if (!ok) return;
                if (open === "account") { router.push("/"); router.refresh(); }
                else { setOpen(null); router.refresh(); }
              }}>
              {pending ? "Deleting…" : "Permanently delete"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
          </div>
          <ErrorText error={error} />
        </div>
      )}
    </div>
  );
}

function Row({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-ink-3">{body}</div>
      </div>
      {action}
    </div>
  );
}
