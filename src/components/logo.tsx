import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="var(--brand)" />
        <rect x="6" y="11" width="2.4" height="6" rx="1.2" fill="var(--brand-ink)" />
        <rect x="10.8" y="7" width="2.4" height="10" rx="1.2" fill="var(--brand-ink)" />
        <rect x="15.6" y="9.5" width="2.4" height="7.5" rx="1.2" fill="var(--brand-ink)" />
      </svg>
      Tracklens
    </Link>
  );
}
