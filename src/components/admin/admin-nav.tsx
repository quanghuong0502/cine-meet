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
export function AdminNav({ openReports = 0 }: { openReports?: number }) {
  const t = useTranslations("admin");
  const { current, markPending } = useOptimisticPath();

  return (
    <nav aria-label={t("menuLabel")}>
      <ul className="flex flex-col gap-tight">
        {ENABLED_ADMIN_NAV_ITEMS.map(({ href, key, icon, activeIcon, exact }) => {
          const active = isActive(current, href, exact);
          const Icon = active ? activeIcon : icon;
          const badge = key === "settings" && openReports > 0 ? openReports : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => markPending(href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-target items-center gap-item rounded-lg px-inset-sm type-label",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <Icon className="size-icon shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{t(`nav.${key}`)}</span>
                {badge > 0 ? (
                  <span className="flex h-icon min-w-icon shrink-0 items-center justify-center rounded-full bg-primary px-tight type-tag text-primary-foreground tabular-nums">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
