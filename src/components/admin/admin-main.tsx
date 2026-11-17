"use client";

import { cn } from "@/lib/utils";
import { useShowsAdminBar } from "@/lib/use-shows-admin-bar";

/**
 * The scrolling area of the admin shell. `--bottom-nav-h` is the room the floating bottom bar takes on phones
 * (content and the fixed "Add" button keep clear of it); on an entry screen the bar is hidden, so no room is kept.
 */
export function AdminMain({ hasBottomNav, children }: { hasBottomNav: boolean; children: React.ReactNode }) {
  const barAllowed = useShowsAdminBar();
  const showsBar = hasBottomNav && barAllowed;

  return (
    <main
      data-app-scroll
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain",
        showsBar && "pb-[var(--bottom-nav-h)] [--bottom-nav-h:calc(var(--spacing-nav)+2*var(--spacing-nav-gap)+env(safe-area-inset-bottom))] md:[--bottom-nav-h:0px]",
      )}
    >
      {children}
    </main>
  );
}
