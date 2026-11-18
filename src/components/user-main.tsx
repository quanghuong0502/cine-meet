"use client";

import { usePathname } from "next/navigation";
import { isFocusedUserRoute } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * The scrolling area of the user shell. While the floating bottom menu is on screen the page keeps `--nav-clearance` clear at its end;
 * on an entry screen the menu is hidden and a Save bar takes its place (the form leaves its own room), so no menu room is kept.
 */
export function UserMain({ hasBottomNav, children }: { hasBottomNav: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const showsNav = hasBottomNav && !isFocusedUserRoute(pathname);

  return (
    <main
      data-app-scroll
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain",
        showsNav && "pb-[var(--nav-clearance)]",
      )}
    >
      {children}
    </main>
  );
}
