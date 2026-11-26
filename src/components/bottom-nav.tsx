"use client";

import type { Icon as SolarIcon } from "@solar-icons/react/lib/types";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useOptimisticPath } from "@/lib/use-optimistic-path";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: SolarIcon;
  /** LineDuotone twin rendered when this tab is selected. */
  activeIcon?: SolarIcon;
  /** Active only on this exact path (for a root tab such as "/" or "/admin"); otherwise any path below it counts. */
  exact?: boolean;
  /** Other paths that light this tab up (screens opened from it that live outside its own path). */
  alsoActive?: string[];
}

interface BottomNavProps {
  label: string;
  items: BottomNavItem[];
  className?: string;
}

function isActive(pathname: string, item: BottomNavItem): boolean {
  const under = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  return item.exact ? pathname === item.href : under(item.href) || (item.alsoActive ?? []).some(under);
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
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 px-inset pb-[var(--nav-bottom)]",
        className,
      )}
    >
      <ul
        className="pointer-events-auto mx-auto grid max-w-menu rounded-full border border-border/70 bg-card/85 px-inset-xs shadow-menu backdrop-blur-md"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(current, item);
          const Icon = active && item.activeIcon ? item.activeIcon : item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => markPending(item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-nav flex-col items-center justify-center gap-tight rounded-full type-tag transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-75",
                  active ? "font-semibold! text-primary-text" : "text-muted-foreground",
                )}
              >
                {/* Active: soft pastel capsule + airy Solar LineDuotone icon + bolder label. */}
                <span
                  aria-hidden
                  className={cn(
                    "flex items-center justify-center rounded-full px-inset-sm py-hair transition-[background-color,transform] duration-200",
                    active && "bg-accent/85 motion-safe:scale-105",
                  )}
                >
                  <Icon className="size-icon-lg" />
                </span>
                <span className="max-w-full truncate px-hair">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
