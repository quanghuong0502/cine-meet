"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

/**
 * The sideways-scrolling strip of tabs. When the page opens (for instance coming back from an entry screen) the strip jumps, and when the tab changes it glides,
 * so the active tab (`aria-current`) sits in the middle, instead of starting from the first tab.
 */
export function ActiveTabStrip({ children, className }: { children: ReactNode; className?: string }) {
  const listRef = useRef<HTMLUListElement>(null);
  const tab = useSearchParams().get("tab");
  const mounted = useRef(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !active) return;
    const target = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
    const left = Math.max(0, target);
    // First paint: jump (nothing to animate from). Later tab changes: glide, so the strip does not snap under the finger.
    const glide = mounted.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mounted.current = true;
    list.scrollTo({ left, behavior: glide ? "smooth" : "auto" });
  }, [tab]);

  return (
    <ul ref={listRef} className={className}>
      {children}
    </ul>
  );
}
