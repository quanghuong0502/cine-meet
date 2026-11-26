"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { MASTER_DATA_SECTIONS, type MasterDataSectionKey } from "@/lib/master-data-sections";
import { cn } from "@/lib/utils";

interface MasterDataTabsProps {
  label: string;
  /** Translated tab names by section key. */
  labels: Record<MasterDataSectionKey, string>;
  activeKey: MasterDataSectionKey;
}

/**
 * The sideways-scrolling tabs of the Catalog page. The tapped tab is highlighted at once (not after the server answers) and the
 * strip glides to put it in the middle; when the page opens (for instance coming back from an entry screen) it jumps there.
 */
export function MasterDataTabs({ label, labels, activeKey }: MasterDataTabsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const mounted = useRef(false);
  const [pending, setPending] = useState<{ key: MasterDataSectionKey; from: MasterDataSectionKey } | null>(null);
  const shown = pending && pending.from === activeKey ? pending.key : activeKey;

  useLayoutEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !active) return;
    const left = Math.max(0, active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2);
    const glide = mounted.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mounted.current = true;
    list.scrollTo({ left, behavior: glide ? "smooth" : "auto" });
  }, [shown]);

  return (
    <nav aria-label={label} className="relative">
      <ul ref={listRef} className="scroll-strip relative flex gap-stack pb-tight md:flex-wrap md:overflow-visible">
        {MASTER_DATA_SECTIONS.map(({ key, icon: Icon }) => {
          const selected = key === shown;
          return (
            <li key={key} className="shrink-0">
              <Link
                href={`/admin/master-data?tab=${key}`}
                prefetch={false}
                aria-current={selected ? "page" : undefined}
                onClick={() => setPending({ key, from: activeKey })}
                className={cn(
                  "flex h-target items-center gap-stack rounded-full border px-inset type-label transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80",
                  selected ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="size-icon-sm" aria-hidden />
                {labels[key]}
              </Link>
            </li>
          );
        })}
      </ul>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-inset-lg bg-gradient-to-l from-background to-transparent md:hidden" />
    </nav>
  );
}
