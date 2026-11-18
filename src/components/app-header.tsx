"use client";

import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { UserMenu } from "@/components/user-menu";
import { isAdminTabRoot } from "@/lib/admin-nav";
import { isUserTabRoot } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { PX } from "@/lib/ui-sizes";

interface AppHeaderProps {
  area: "app" | "admin";
  name: string;
  image?: string;
  /** Unread notifications; only the user app has a bell (admin does not get these). */
  unread?: number;
}

/**
 * The app bar (logo and avatar). It shows only on a root screen; an inner screen has its own back bar (`PageHeader`), and
 * two bars stacked would take about 56px of a phone screen for nothing. On desktop admin the sidebar replaces it (`md:hidden`).
 */
export function AppHeader({ area, name, image, unread }: AppHeaderProps) {
  const pathname = usePathname();
  const isRoot = area === "admin" ? isAdminTabRoot(pathname) : isUserTabRoot(pathname);
  if (!isRoot) return null;

  return (
    <header
      className={cn(
        "z-30 flex shrink-0 items-center justify-between gap-stack border-b px-inset py-tight",
        area === "admin" && "bg-background/95 backdrop-blur md:hidden",
      )}
    >
      <Logo size={area === "admin" ? PX.logoCompact : PX.logo} wordmarkClassName="type-heading" />
      <div className="flex items-center gap-stack">
        {area === "app" && unread !== undefined ? <NotificationBell unread={unread} /> : null}
        {/* The user app reaches Profile from the bottom bar; only admin keeps the avatar here. */}
        {area === "admin" ? <UserMenu area={area} name={name} image={image} /> : null}
      </div>
    </header>
  );
}
