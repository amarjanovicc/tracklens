import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="mb-8"><Logo /></div>
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 sm:p-8">{children}</div>
      <p className="mt-6 max-w-sm text-center text-xs text-ink-3">
        Not affiliated with Spotify AB. By continuing you agree to the <a className="underline" href="/terms">terms</a> and{" "}
        <a className="underline" href="/privacy">privacy policy</a>.
      </p>
    </div>
  );
}
