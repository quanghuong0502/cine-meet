import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { PlaceholderPage } from "@/components/placeholder-page";
import { ENABLED_ADMIN_NAV_ITEMS } from "@/lib/admin-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("placeholders.admin.overview");
  return { title: t("title") };
}

export default async function AdminDashboardPage() {
  // Until the dashboard exists, /admin forwards to the first page that is ready.
  const dashboardEnabled = ENABLED_ADMIN_NAV_ITEMS.some((item) => item.key === "overview");
  const first = ENABLED_ADMIN_NAV_ITEMS.find((item) => item.key !== "overview");
  if (!dashboardEnabled && first) redirect(first.href);

  const t = await getTranslations("placeholders.admin.overview");
  return <PlaceholderPage title={t("title")} description={t("description")} />;
}
