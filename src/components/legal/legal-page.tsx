import Link from "next/link";
import { Logo } from "@/components/logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Logo />
        <Link href="/" className="text-sm text-ink-2 hover:text-ink">Back to home</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <p role="note" className="mb-8 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
          <strong className="text-ink">Template.</strong> This page is a plain-English starting point and has not been
          reviewed by a lawyer. Have it reviewed for your jurisdiction (e.g. GDPR) before launch.
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-ink-3">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-2 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
    </div>
  );
}
