"use client";

import {
  Clapperboard,
  Database,
  LayoutDashboard,
  Projector,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type AdminNavKey = "overview" | "users" | "masterData" | "auditoriums" | "movies" | "settings";

interface AdminNavItem {
  href: string;
  key: AdminNavKey;
  icon: LucideIcon;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", key: "overview", icon: LayoutDashboard },
  { href: "/admin/users", key: "users", icon: Users },
  { href: "/admin/master-data", key: "masterData", icon: Database },
  { href: "/admin/auditoriums", key: "auditoriums", icon: Projector },
  { href: "/admin/movies", key: "movies", icon: Clapperboard },
  { href: "/admin/settings", key: "settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

interface AdminNavProps {
  /** Wrap links in SheetClose so the mobile drawer closes after navigating. */
  insideSheet?: boolean;
}

export function AdminNav({ insideSheet = false }: AdminNavProps) {
  const t = useTranslations("admin");
  const pathname = usePathname();

  return (
    <nav aria-label={t("menuLabel")}>
      <ul className="flex flex-col gap-1">
        {ADMIN_NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          const link = (
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(`nav.${key}`)}
            </Link>
          );
          return (
            <li key={href}>
              {insideSheet ? <SheetClose asChild>{link}</SheetClose> : link}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
