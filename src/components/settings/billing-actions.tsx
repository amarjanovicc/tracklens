"use client";
import { Button } from "@/components/ui";
import { ErrorText, useApi } from "./use-api";

export function BillingActions({ plan, enabled, hasCustomer, monthly, yearly }: {
  plan: "free" | "pro";
  enabled: boolean;
  hasCustomer: boolean;
  monthly: number;
  yearly: number;
}) {
  const { call, pending, error } = useApi();
  const go = async (url: string, body?: unknown) => {
    const r = await call<{ url?: string }>(url, { method: "POST", body: body ?? {} });
    if (r?.url) window.location.href = r.url;
  };
  if (!enabled) {
    return (
      <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
        Billing is not configured on this server (no <code className="font-mono text-xs">STRIPE_SECRET_KEY</code>).
      </p>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {plan === "free" ? (
          <>
            <Button disabled={pending} onClick={() => go("/api/stripe/checkout", { interval: "month" })}>
              Upgrade · ${monthly}/month
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => go("/api/stripe/checkout", { interval: "year" })}>
              ${yearly}/year (save {Math.round((1 - yearly / (monthly * 12)) * 100)}%)
            </Button>
          </>
        ) : null}
        {hasCustomer && (
          <Button variant="secondary" disabled={pending} onClick={() => go("/api/stripe/portal")}>
            Manage billing & invoices
          </Button>
        )}
      </div>
      <ErrorText error={error} />
    </div>
  );
}
