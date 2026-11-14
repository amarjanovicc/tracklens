"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-ink-3">{email}</div>
      </div>
      <button aria-label="Sign out" title="Sign out" className="rounded-md p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"
        onClick={async () => { await authClient.signOut(); router.push("/"); router.refresh(); }}>
        <LogOut size={16} />
      </button>
    </div>
  );
}
