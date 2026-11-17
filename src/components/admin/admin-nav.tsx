"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ENABLED_ADMIN_NAV_ITEMS } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";
import { useOptimisticPath } from "@/lib/use-optimistic-path";

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Sidebar menu for wide screens. Phones use `AdminBottomNav`. */
export function AdminNav() {
  const t = useTranslations("admin");
  const { current, markPending } = useOptimisticPath();

  return (
    <nav aria-label={t("menuLabel")}>
      <ul className="flex flex-col gap-1">
        {ENABLED_ADMIN_NAV_ITEMS.map(({ href, key, icon: Icon, exact }) => {
          const active = isActive(current, href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => markPending(href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-target items-center gap-3 rounded-lg px-3 text-sm font-medium",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <Icon className={cn("size-4", active && "fill-current stroke-accent")} aria-hidden />
                {t(`nav.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
