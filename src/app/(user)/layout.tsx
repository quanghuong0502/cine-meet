import { AppOpenedMarker } from "@/components/route-loading";
import { Logo } from "@/components/logo";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { SignOutButton } from "@/components/sign-out-button";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { requireUser } from "@/lib/auth/guards";
import { ENABLED_NAV_ITEMS } from "@/lib/nav";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reads the account from the database: proxy.ts only sees the JWT, so never rely on it alone.
  // The whole layout waits for this behind the full-screen loader in app/loading.tsx, so the
  // header, nav and page appear together instead of in stages.
  const user = await requireUser();
  // Admins only have the admin area: the user app is for regular accounts.
  if (user.role === "admin") redirect("/admin");
  const hasBottomNav = ENABLED_NAV_ITEMS.length > 0;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-1">
        <Logo size={48} wordmarkClassName="text-xl" />
        <UserMenu name={user.name} identity={user.email ?? user.username}>
          <SignOutButton />
        </UserMenu>
      </header>
      <main
        data-app-scroll
        className={
          hasBottomNav
            ? "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[calc(var(--spacing-nav)+2*var(--spacing-nav-gap)+env(safe-area-inset-bottom))]"
            : "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
        }
      >
        {children}
      </main>
      <UserBottomNav />
      <AppOpenedMarker />
    </div>
  );
}
