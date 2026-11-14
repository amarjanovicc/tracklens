"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { ErrorText, useApi } from "./use-api";

export function ProfileForm({ name, timezone, timezones }: { name: string; timezone: string; timezones: string[] }) {
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [saved, setSaved] = useState(false);
  const detected = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      setSaved(false);
      const f = new FormData(e.currentTarget);
      const ok = await call("/api/settings", { method: "PATCH", body: { name: f.get("name"), timezone: f.get("timezone") } });
      if (ok) { setSaved(true); router.refresh(); }
    }}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Display name</span>
        <input name="name" defaultValue={name} required maxLength={80}
          className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm" />
        <span className="mt-1 block text-xs text-ink-3">Shown on your public share links.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Timezone</span>
        <select name="timezone" defaultValue={timezone} className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm">
          {timezones.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
        </select>
        <span className="mt-1 block text-xs text-ink-3">
          Used for hour-of-day, weekday and daily stats.
          {detected && detected !== timezone && <> Your browser says <strong>{detected}</strong>.</>}
        </span>
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
        {saved && <span className="text-sm text-good">Saved</span>}
      </div>
      <div className="sm:col-span-2"><ErrorText error={error} /></div>
    </form>
  );
}
