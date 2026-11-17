"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import {
  ENABLED_ADMIN_NAV_ITEMS,
  isFocusedAdminRoute,
  MAX_BOTTOM_NAV_ITEMS,
  MIN_BOTTOM_NAV_ITEMS,
} from "@/lib/admin-nav";

/**
 * The admin menu on phones: only the pages that are ready (see `src/lib/admin-nav.ts`), five at most.
 * "Back to the app", change password and sign out live in the avatar menu. On wide screens the sidebar is used instead.
 */
export function AdminBottomNav() {
  const t = useTranslations("admin.bottomNav");
  const pathname = usePathname();
  const items = ENABLED_ADMIN_NAV_ITEMS.slice(0, MAX_BOTTOM_NAV_ITEMS);
  if (items.length < MIN_BOTTOM_NAV_ITEMS || isFocusedAdminRoute(pathname)) return null;

  return (
    <BottomNav
      className="md:hidden"
      label={t("label")}
      items={items.map((item) => ({ href: item.href, label: t(item.key), icon: item.icon, exact: item.exact }))}
    />
  );
}
