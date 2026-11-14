import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col md:flex-row">
      <aside className="border-b border-line px-4 py-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r md:py-6">
        <div className="mb-4 flex items-center justify-between md:mb-8 md:px-2">
          <Logo href="/app" />
          {user.plan === "pro" && <Badge tone="brand">Pro</Badge>}
        </div>
        <Suspense><AppNav /></Suspense>
        <div className="mt-4 hidden md:absolute md:bottom-6 md:left-4 md:right-4 md:block">
          <UserMenu name={user.name} email={user.email} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
