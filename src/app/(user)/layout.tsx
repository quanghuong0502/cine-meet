import { Wordmark } from "@/components/wordmark";
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
  const user = await requireUser();
  const hasBottomNav = ENABLED_NAV_ITEMS.length > 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between border-b px-4 py-1">
        <Wordmark className="text-lg" />
        <UserMenu name={user.name} identity={user.email ?? user.username}>
          <SignOutButton />
        </UserMenu>
      </header>
      <main
        className={
          hasBottomNav ? "flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : "flex-1"
        }
      >
        {children}
      </main>
      <UserBottomNav />
    </div>
  );
}
