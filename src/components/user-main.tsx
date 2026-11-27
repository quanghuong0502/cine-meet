"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isFocusedUserRoute, isUserTabRoot } from "@/lib/nav";
import { cn } from "@/lib/utils";

const scrollPositions = new Map<string, number>();

/**
 * The scrolling area of the user shell. While the floating bottom menu is on screen the page keeps `--nav-clearance` clear at its end;
 * on focused screens without the menu it keeps `--inset-bottom` so content never hides behind the iPhone home indicator.
 * Also preserves scroll positions for root tabs and resets small scroll residue on forward navigation.
 */
export function UserMain({ hasBottomNav, children }: { hasBottomNav: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const showsNav = hasBottomNav && !isFocusedUserRoute(pathname);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const saved = isUserTabRoot(pathname) ? scrollPositions.get(pathname) : undefined;
    el.scrollTop = saved ?? 0;
    const onScroll = () => {
      if (isUserTabRoot(pathname)) scrollPositions.set(pathname, el.scrollTop);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <main
      ref={mainRef}
      data-app-scroll
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain",
        showsNav ? "pb-[var(--nav-clearance)]" : "pb-(--inset-bottom)",
      )}
    >
      {children}
    </main>
  );
}
