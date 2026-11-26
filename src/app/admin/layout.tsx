import Link from "next/link";
import { AdminBottomNav } from "@/components/admin/admin-bottom-nav";
import { AdminMain } from "@/components/admin/admin-main";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { Logo } from "@/components/logo";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { SignOutButton } from "@/components/sign-out-button";
import { UserAvatar } from "@/components/user-avatar";
import { ENABLED_ADMIN_NAV_ITEMS, MIN_BOTTOM_NAV_ITEMS } from "@/lib/admin-nav";
import { requireAdmin } from "@/lib/auth/guards";
import { PX } from "@/lib/ui-sizes";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy.ts only sees the JWT; this re-reads role and status from the database.
  const admin = await requireAdmin();
  const hasBottomNav = ENABLED_ADMIN_NAV_ITEMS.length >= MIN_BOTTOM_NAV_ITEMS;

  return (
    <ScopedIntlProvider namespaces={ADMIN_SHELL_NAMESPACES}>
      <div data-app-shell className="h-dvh overflow-hidden md:grid md:grid-cols-[var(--spacing-sidebar)_1fr] md:grid-rows-1">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-group border-r p-inset md:flex">
          <span className="px-inset-sm py-inset-xs">
            <Logo size={PX.logoCompact} wordmarkClassName="type-heading" />
          </span>
          <AdminNav />
          <div className="mt-auto flex flex-col gap-tight border-t pt-item">
            <Link
              href="/admin/profile"
              className="flex min-h-target items-center gap-stack rounded-lg px-inset-sm py-inset-xs transition-colors outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <UserAvatar name={admin.name} image={admin.image} size={PX.avatar} />
              <span className="min-w-0 flex-1 truncate type-label">{admin.name}</span>
            </Link>
            <SignOutButton />
          </div>
        </aside>

        <div className="flex h-full min-w-0 flex-col">
          {/* Phones: logo and avatar menu on top, the menu itself is the bottom bar. */}
          <AppHeader area="admin" name={admin.name} image={admin.image} />
          <AdminMain hasBottomNav={hasBottomNav}>{children}</AdminMain>
        </div>
        <AdminBottomNav />
      </div>
    </ScopedIntlProvider>
  );
}
