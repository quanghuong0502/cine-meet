"use client";

import { useTranslations } from "next-intl";
import { BottomNav } from "@/components/bottom-nav";
import { ENABLED_NAV_ITEMS } from "@/lib/nav";

/** Tabs of the user app. Only tabs whose feature exists are shown (see `src/lib/nav.ts`). */
export function UserBottomNav() {
  const t = useTranslations("nav");
  return (
    <BottomNav
      label={t("label")}
      items={ENABLED_NAV_ITEMS.map((item) => ({
        href: item.href,
        label: t(item.key),
        icon: item.icon,
        exact: item.href === "/",
      }))}
    />
  );
}
