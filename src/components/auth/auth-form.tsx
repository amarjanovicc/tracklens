"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Only allow same-origin relative redirects, never "//evil.com". */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/app";
  return next;
}

const input =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-ink-3 focus:border-brand focus:outline-none";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const next = safeNext(sp.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    try {
      const res =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: String(f.get("name") ?? "").trim() || email.split("@")[0],
              // Server-side additionalField (input: true); the client has no type for it.
              ...({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } as object),
            });
      if (res.error) {
        setError(res.error.message ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      router.push(mode === "sign-up" && next === "/app" ? "/app/import" : next);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
      {mode === "sign-up" && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <input name="name" autoComplete="name" required maxLength={80} className={input} placeholder="Your name" />
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Email</span>
        <input name="email" type="email" autoComplete="email" required className={input} placeholder="you@example.com" />
      </label>
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-sm font-medium">
          Password
          {mode === "sign-up" && <span className="text-xs font-normal text-ink-3">At least 8 characters</span>}
        </span>
        <input name="password" type="password" required minLength={8}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"} className={input} />
      </label>

      {error && (
        <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand text-sm font-medium text-brand-ink hover:opacity-90 disabled:opacity-60">
        {pending ? (mode === "sign-in" ? "Signing in…" : "Creating account…") : mode === "sign-in" ? "Sign in" : "Create account"}
      </button>

      <p className="text-center text-sm text-ink-2">
        {mode === "sign-in" ? (
          <>No account yet? <Link className="font-medium text-brand hover:underline" href={`/sign-up${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}>Create one</Link></>
        ) : (
          <>Already have an account? <Link className="font-medium text-brand hover:underline" href={`/sign-in${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link></>
        )}
      </p>
    </form>
  );
}
