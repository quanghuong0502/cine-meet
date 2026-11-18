"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useOptimisticPath } from "@/lib/use-optimistic-path";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Active only on this exact path (for a root tab such as "/" or "/admin"); otherwise any path below it counts. */
  exact?: boolean;
}

interface BottomNavProps {
  label: string;
  items: BottomNavItem[];
  className?: string;
}

function isActive(pathname: string, item: BottomNavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Bottom navigation for phones: a floating pill of frosted glass, 68px tall and 16px in from the sides, low on the screen (`--nav-bottom`),
 * so the page scrolls visibly behind it.
 * The selected tab shows its state three ways, not just by colour: a filled icon, the accent colour and a bolder label.
 */
export function BottomNav({ label, items, className }: BottomNavProps) {
  const { current, markPending } = useOptimisticPath();
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={label}
      data-bottom-fixed
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[var(--nav-bottom)]",
        className,
      )}
    >
      <ul
        className="pointer-events-auto mx-auto grid max-w-md rounded-full border border-white/15 bg-card/70 px-2 shadow-[0_8px_32px_-8px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.12)] backdrop-blur-xl backdrop-saturate-150"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(current, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => markPending(item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-nav flex-col items-center justify-center gap-1 rounded-full type-tag",
                  active ? "font-semibold! text-primary-text" : "text-muted-foreground",
                )}
              >
                {/* Active: filled with the tab colour; the bar colour as stroke carves the icon's details out of the fill. */}
                <Icon className={cn("size-6", active && "fill-current stroke-card")} aria-hidden />
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
