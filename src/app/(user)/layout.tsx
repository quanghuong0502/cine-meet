import { cache, Suspense } from "react";
import { redirect } from "next/navigation";
import { LoadingState } from "@/components/loading-state";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { SignOutButton } from "@/components/sign-out-button";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { requireUser } from "@/lib/auth/guards";
import { ENABLED_NAV_ITEMS } from "@/lib/nav";

// Reads the account from the database: proxy.ts only sees the JWT, so never rely on it alone.
// Cached per request so the header and the content guard share one lookup.
const getUser = cache(async () => {
  const user = await requireUser();
  // Admins only have the admin area: the user app is for regular accounts.
  if (user.role === "admin") redirect("/admin");
  return user;
});

/** Content gate: nothing under the layout renders for a signed-out, locked or admin account. */
async function UserGuard({ children }: { children: React.ReactNode }) {
  await getUser();
  return children;
}

async function HeaderUserMenu() {
  const user = await getUser();
  return (
    <UserMenu name={user.name} identity={user.email ?? user.username}>
      <SignOutButton />
    </UserMenu>
  );
}

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasBottomNav = ENABLED_NAV_ITEMS.length > 0;

  // The shell (header, nav) renders at once, so only the area inside <main> shows a loading state:
  // the layout never swaps one full-screen loader for another.
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between border-b px-4 py-1">
        <Logo size={48} wordmarkClassName="text-xl" />
        <Suspense fallback={<div className="size-target rounded-full bg-muted" aria-hidden />}>
          <HeaderUserMenu />
        </Suspense>
      </header>
      <main
        className={
          hasBottomNav ? "flex-1 pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom))]" : "flex-1"
        }
      >
        {/* Same fallback as (user)/loading.tsx, so waiting on the guard and on the page looks like one loader. */}
        <Suspense fallback={<LoadingState />}>
          <UserGuard>{children}</UserGuard>
        </Suspense>
      </main>
      <UserBottomNav />
    </div>
  );
}
