import { TicketIcon } from "@solar-icons/react/line-duotone";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { BudgetCard } from "@/components/dashboard/budget-card";
import { CompanionsCard } from "@/components/dashboard/companions-card";
import { SpendingCard } from "@/components/dashboard/spending-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { SPENDING_PERIODS, type Period } from "@/lib/dashboard/period";
import { getDashboard } from "@/services/dashboard.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("overview") };
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [user, t, params] = await Promise.all([requireUser(), getTranslations("dashboard"), searchParams]);
  const requested = Array.isArray(params.period) ? params.period[0] : params.period;
  const period: Period = (SPENDING_PERIODS as readonly string[]).includes(requested ?? "") ? (requested as Period) : "month";

  return (
    <ScopedIntlProvider namespaces={["dashboard"]}>
      <div className="flex flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} />
        <Suspense key={period} fallback={<LoadingState compact />}>
          <DashboardBody userId={user.userId} period={period} />
        </Suspense>
      </div>
    </ScopedIntlProvider>
  );
}

async function DashboardBody({ userId, period }: { userId: string; period: Period }) {
  const [t, data] = await Promise.all([getTranslations("dashboard"), getDashboard(userId, period)]);
  const totalSpent = data.spending.reduce((sum, b) => sum + b.total, 0);
  const isNewUser = data.viewingCount === 0 && totalSpent === 0 && data.budget.length === 0;

  if (isNewUser) {
    return (
      <EmptyState
        mascot="dudu-happy"
        title={t("stats.empty")}
        description={t("budget.notSet")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-stack">
            <Button asChild size="pill">
              <Link href="/log-viewing">
                <TicketIcon aria-hidden />
                {t("logViewing.action")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="pill">
              <Link href="/settings">{t("budget.configure")}</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <>
      <SpendingCard period={period} buckets={data.spending} />
      <Button asChild variant="outline" size="cta-sm">
        <Link href="/log-viewing">
          <TicketIcon aria-hidden />
          {t("logViewing.action")}
        </Link>
      </Button>
      <BudgetCard progress={data.budget} />
      <StatsCard viewingCount={data.viewingCount} averageCostPerViewing={data.averageCostPerViewing} topGenres={data.topGenres} topBranches={data.topBranches} />
      <CompanionsCard companions={data.companions} />
    </>
  );
}
