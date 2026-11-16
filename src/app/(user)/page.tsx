import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlaceholderPage } from "@/components/placeholder-page";
import { ENABLED_NAV_ITEMS } from "@/lib/nav";

export const metadata: Metadata = { title: "Tổng quan" };

export default function HomePage() {
  // Until the dashboard (Sprint 6) is on, "/" forwards to the first tab that already has a feature.
  const dashboardEnabled = ENABLED_NAV_ITEMS.some((item) => item.href === "/");
  const firstAvailable = ENABLED_NAV_ITEMS.find((item) => item.href !== "/");
  if (!dashboardEnabled && firstAvailable) redirect(firstAvailable.href);

  return (
    <PlaceholderPage
      title="Chào mừng"
      description="Các tính năng sẽ lần lượt xuất hiện ở đây theo từng sprint."
    />
  );
}
