import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getActiveUser } from "@/lib/auth/guards";
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
  const user = await getActiveUser();

  return (
    <EmptyState
      mascot="dudu-happy"
      title={t("title")}
      description={t("description")}
      className="min-h-[60dvh] justify-center"
      // The app has no user features yet, so an admin would otherwise have nowhere to go.
      action={
        user?.role === "admin" ? (
          <Button asChild className="h-12 rounded-full px-8 text-base font-semibold">
            <Link href="/admin">{t("adminAction")}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
