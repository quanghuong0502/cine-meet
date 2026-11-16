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
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/users", label: "Người dùng", icon: Users },
  { href: "/admin/master-data", label: "Danh mục", icon: Database },
  { href: "/admin/auditoriums", label: "Phòng chiếu", icon: Projector },
  { href: "/admin/movies", label: "Phim & suất chiếu", icon: Clapperboard },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

interface AdminNavProps {
  /** Wrap links in SheetClose so the mobile drawer closes after navigating. */
  insideSheet?: boolean;
}

export function AdminNav({ insideSheet = false }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu quản trị">
      <ul className="flex flex-col gap-1">
        {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
              {label}
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
