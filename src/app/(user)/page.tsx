import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ENABLED_NAV_ITEMS } from "@/lib/nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("overview") };
}

export default async function HomePage() {
  // Until the dashboard (Sprint 6) is on, "/" forwards to the first tab that already has a feature.
  const dashboardEnabled = ENABLED_NAV_ITEMS.some((item) => item.href === "/");
  const firstAvailable = ENABLED_NAV_ITEMS.find((item) => item.href !== "/");
  if (!dashboardEnabled && firstAvailable) redirect(firstAvailable.href);

  const t = await getTranslations("states.welcome");
  return (
    <EmptyState
      mascot="dudu-happy"
      title={t("title")}
      description={t("description")}
      className="min-h-[60dvh] justify-center"
    />
  );
}
