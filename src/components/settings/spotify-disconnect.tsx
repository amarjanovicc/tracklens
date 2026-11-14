"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { ErrorText, useApi } from "./use-api";

export function SpotifyDisconnect() {
  const router = useRouter();
  const { call, pending, error } = useApi();
  return (
    <div>
      <Button variant="secondary" disabled={pending} onClick={async () => {
        if (!confirm("Disconnect Spotify? Live sync stops; your imported history stays.")) return;
        if (await call("/api/spotify/disconnect", { method: "POST" })) router.refresh();
      }}>{pending ? "Disconnecting…" : "Disconnect"}</Button>
      <ErrorText error={error} />
    </div>
  );
}
