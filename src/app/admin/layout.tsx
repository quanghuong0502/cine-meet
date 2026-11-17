import { AdminBottomNav } from "@/components/admin/admin-bottom-nav";
import { AdminMain } from "@/components/admin/admin-main";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/logo";
import { AppOpenedMarker } from "@/components/route-loading";
import { SignOutButton } from "@/components/sign-out-button";
import { UserMenu } from "@/components/user-menu";
import { ENABLED_ADMIN_NAV_ITEMS, MIN_BOTTOM_NAV_ITEMS } from "@/lib/admin-nav";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy.ts only sees the JWT; this re-reads role and status from the database.
  const admin = await requireAdmin();
  const hasBottomNav = ENABLED_ADMIN_NAV_ITEMS.length >= MIN_BOTTOM_NAV_ITEMS;

  return (
    <div data-app-shell className="h-dvh overflow-hidden md:grid md:grid-cols-[16rem_1fr] md:grid-rows-1">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-r p-4 md:flex">
        <span className="px-3 py-2">
          <Logo size={44} wordmarkClassName="text-xl" />
        </span>
        <AdminNav />
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-col">
        {/* Phones: logo and avatar menu on top, the menu itself is the bottom bar. */}
        <header className="z-30 flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 py-1 backdrop-blur md:hidden">
          <Logo size={44} wordmarkClassName="text-xl" />
          <UserMenu area="admin" name={admin.name} image={admin.image} />
        </header>
        <AdminMain hasBottomNav={hasBottomNav}>{children}</AdminMain>
      </div>
      <AdminBottomNav />
      <AppOpenedMarker />
    </div>
  );
}
