import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-ink-2">Free forever for your full history. No Spotify login needed.</p>
      <div className="mt-6">
        <Suspense><AuthForm mode="sign-up" /></Suspense>
      </div>
    </>
  );
}
