import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-2">Sign in to see your listening analytics.</p>
      <div className="mt-6">
        <Suspense><AuthForm mode="sign-in" /></Suspense>
      </div>
      <div className="mt-6 rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-2">
        <span className="font-medium text-ink">Try the demo account:</span>{" "}
        <code className="font-mono">demo@tracklens.dev</code> / <code className="font-mono">demo-password</code>
      </div>
    </>
  );
}
