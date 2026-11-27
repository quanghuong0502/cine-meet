"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isAdminTabRoot } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";
import { useShowsAdminBar } from "@/lib/use-shows-admin-bar";

const adminScrollPositions = new Map<string, number>();

/**
 * The scrolling area of the admin shell. `--bottom-nav-h` is the room the floating bottom bar takes on phones
 * (content and the fixed "Add" button keep clear of it); on focused screens without the bar it keeps `--inset-bottom`.
 */
export function AdminMain({ hasBottomNav, children }: { hasBottomNav: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const barAllowed = useShowsAdminBar();
  const showsBar = hasBottomNav && barAllowed;
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const saved = isAdminTabRoot(pathname) ? adminScrollPositions.get(pathname) : undefined;
    el.scrollTop = saved ?? 0;
    const onScroll = () => {
      if (isAdminTabRoot(pathname)) adminScrollPositions.set(pathname, el.scrollTop);
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
        showsBar
          ? "pb-[var(--bottom-nav-h)] [--bottom-nav-h:var(--nav-clearance)] md:[--bottom-nav-h:0px]"
          : "pb-(--inset-bottom) md:pb-0",
      )}
    >
      {children}
    </main>
  );
}
