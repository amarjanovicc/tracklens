"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { BarChart3, Clock3, Compass, GitCompare, ListMusic, Settings, Trophy, Upload } from "lucide-react";

const NAV = [
  { href: "/app", label: "Overview", icon: BarChart3, keepRange: true },
  { href: "/app/top", label: "Top lists", icon: Trophy, keepRange: true },
  { href: "/app/habits", label: "Habits", icon: Clock3, keepRange: true },
  { href: "/app/discovery", label: "Discovery", icon: Compass, keepRange: true },
  { href: "/app/compare", label: "Compare", icon: GitCompare },
  { href: "/app/playlists", label: "Playlist tracker", icon: ListMusic },
  { href: "/app/import", label: "Import data", icon: Upload },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const path = usePathname();
  const sp = useSearchParams();
  const range = sp.get("range");
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {NAV.map(({ href, label, icon: Icon, keepRange }) => {
        const active = href === "/app" ? path === "/app" : path.startsWith(href);
        const target = keepRange && range ? `${href}?${sp.toString()}` : href;
        return (
          <Link key={href} href={target}
            className={clsx(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink",
            )}>
            <Icon size={16} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
