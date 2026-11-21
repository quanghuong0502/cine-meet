import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BudgetCard } from "@/components/dashboard/budget-card";
import { CompanionsCard } from "@/components/dashboard/companions-card";
import { SpendingCard } from "@/components/dashboard/spending-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { SPENDING_PERIODS, type Period } from "@/lib/dashboard/period";
import { getDashboard } from "@/services/dashboard.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("overview") };
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const t = await getTranslations("dashboard");
  const params = await searchParams;
  const requested = Array.isArray(params.period) ? params.period[0] : params.period;
  const period: Period = (SPENDING_PERIODS as readonly string[]).includes(requested ?? "") ? (requested as Period) : "month";
  const data = await getDashboard(user.userId, period);

  return (
    <div className="flex flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} />
      <SpendingCard period={period} buckets={data.spending} />
      <BudgetCard progress={data.budget} />
      <StatsCard viewingCount={data.viewingCount} averageCostPerViewing={data.averageCostPerViewing} topGenres={data.topGenres} topBranches={data.topBranches} />
      <CompanionsCard companions={data.companions} />
    </div>
  );
}
