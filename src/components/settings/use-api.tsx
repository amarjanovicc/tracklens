"use client";
import { useState } from "react";

/** Small helper for JSON calls with pending + error state. */
export function useApi() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function call<T = Record<string, unknown>>(url: string, init: { method: string; body?: unknown }): Promise<T | null> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: init.method,
        headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return null;
      }
      return data;
    } catch {
      setError("Could not reach the server.");
      return null;
    } finally {
      setPending(false);
    }
  }
  return { call, pending, error, setError };
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p role="alert" className="mt-2 text-sm text-critical">{error}</p>;
}
