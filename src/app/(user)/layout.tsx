import { AppOpenedMarker } from "@/components/route-loading";
import { AppHeader } from "@/components/app-header";
import { redirect } from "next/navigation";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { requireUser } from "@/lib/auth/guards";
import { ENABLED_NAV_ITEMS } from "@/lib/nav";
import { countUnread } from "@/services/notification.service";

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
  // Personal, so read on every request and never cached; a failed count must not take the whole app down.
  const unread = await countUnread(user.userId).catch(() => 0);

  return (
    <div data-app-shell className="mx-auto flex h-dvh w-full max-w-app flex-col overflow-hidden">
      <AppHeader area="app" name={user.name} image={user.image} unread={unread} />
      <main
        data-app-scroll
        className={
          hasBottomNav
            ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pb-[var(--nav-clearance)]"
            : "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain"
        }
      >
        {children}
      </main>
      <UserBottomNav />
      <AppOpenedMarker />
    </div>
  );
}
