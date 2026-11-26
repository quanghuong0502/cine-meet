import { redirect } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { NotificationBellFallback, NotificationBellSlot } from "@/components/notification-bell";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserMain } from "@/components/user-main";
import { requireUser } from "@/lib/auth/guards";
import { ENABLED_NAV_ITEMS } from "@/lib/nav";
import { sweepDueNotifications } from "@/notifications/sweep";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reads the account from the database: proxy.ts only sees the JWT, so never rely on it alone.
  const user = await requireUser();
  // Admins only have the admin area: the user app is for regular accounts.
  if (user.role === "admin") redirect("/admin");
  const hasBottomNav = ENABLED_NAV_ITEMS.length > 0;
  // Schedule due-reminder sweep after the response is sent so SSR never blocks on background notification delivery.
  after(() => sweepDueNotifications().catch(() => undefined));

  return (
    <div data-app-shell className="mx-auto flex h-dvh w-full max-w-app flex-col overflow-hidden">
      <AppHeader
        area="app"
        name={user.name}
        image={user.image}
        bell={
          <Suspense fallback={<NotificationBellFallback />}>
            <NotificationBellSlot userId={user.userId} />
          </Suspense>
        }
      />
      <UserMain hasBottomNav={hasBottomNav}>{children}</UserMain>
      <UserBottomNav />
    </div>
  );
}
