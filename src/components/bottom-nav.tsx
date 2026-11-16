"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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
 * Bottom navigation bar for phones: rounded top corners, room for the iPhone home bar.
 * The selected tab shows its state three ways, not just by colour: a filled icon, the accent colour and a bolder label.
 */
export function BottomNav({ label, items, className }: BottomNavProps) {
  const pathname = usePathname();
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={label}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-x border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-12px_rgb(0_0_0/0.45)] backdrop-blur",
        className,
      )}
    >
      <ul
        className="mx-auto grid max-w-2xl px-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs",
                  active ? "font-semibold text-primary-text" : "font-medium text-muted-foreground",
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
