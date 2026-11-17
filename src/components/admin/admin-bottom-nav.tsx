"use client";

import { useTranslations } from "next-intl";
import { BottomNav } from "@/components/bottom-nav";
import {
  ENABLED_ADMIN_NAV_ITEMS,
  MAX_BOTTOM_NAV_ITEMS,
  MIN_BOTTOM_NAV_ITEMS,
} from "@/lib/admin-nav";
import { useShowsAdminBar } from "@/lib/use-shows-admin-bar";

/**
 * The admin menu on phones: only the pages that are ready (see `src/lib/admin-nav.ts`), five at most.
 * "Back to the app", change password and sign out live in the avatar menu. On wide screens the sidebar is used instead.
 */
export function AdminBottomNav() {
  const t = useTranslations("admin.bottomNav");
  const showsBar = useShowsAdminBar();
  const items = ENABLED_ADMIN_NAV_ITEMS.slice(0, MAX_BOTTOM_NAV_ITEMS);
  if (items.length < MIN_BOTTOM_NAV_ITEMS || !showsBar) return null;

  return (
    <BottomNav
      className="md:hidden"
      label={t("label")}
      items={items.map((item) => ({ href: item.href, label: t(item.key), icon: item.icon, exact: item.exact }))}
    />
  );
}
