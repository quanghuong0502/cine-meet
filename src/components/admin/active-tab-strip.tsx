"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

/**
 * The sideways-scrolling strip of tabs. When the page opens (for instance coming back from an entry screen) or the tab changes,
 * the strip scrolls so the active tab (`aria-current`) sits in the middle, instead of starting from the first tab.
 */
export function ActiveTabStrip({ children, className }: { children: ReactNode; className?: string }) {
  const listRef = useRef<HTMLUListElement>(null);
  const tab = useSearchParams().get("tab");

  useLayoutEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !active) return;
    const target = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
    list.scrollLeft = Math.max(0, target);
  }, [tab]);

  return (
    <ul ref={listRef} className={className}>
      {children}
    </ul>
  );
}
