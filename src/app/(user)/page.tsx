import { AltArrowRightIcon, CalendarMarkIcon, TicketIcon } from "@solar-icons/react/line-duotone";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { AppointmentStatusBadge } from "@/components/appointment/status-badge";
import { BudgetCard } from "@/components/dashboard/budget-card";
import { CompanionsCard } from "@/components/dashboard/companions-card";
import { SpendingCard } from "@/components/dashboard/spending-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { requireUser } from "@/lib/auth/guards";
import { SPENDING_PERIODS, type Period } from "@/lib/dashboard/period";
import { formatDayCompact, formatTime } from "@/lib/datetime";
import { listAppointments, type AppointmentSummary } from "@/services/appointment.service";
import { getDashboardOverview } from "@/services/dashboard.service";
import { getSpendingTimeline } from "@/services/expense.service";

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
    <ScopedIntlProvider namespaces={["dashboard", "appointments.status"]}>
      <div className="flex flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} />
        <Suspense fallback={<LoadingState compact />}>
          <DashboardBody userId={user.userId} period={period} />
        </Suspense>
      </div>
    </ScopedIntlProvider>
  );
}

async function SpendingSection({ userId, period }: { userId: string; period: Period }) {
  const buckets = await getSpendingTimeline(userId, period);
  return <SpendingCard period={period} buckets={buckets} />;
}

async function UpcomingAppointmentsCard({ items }: { items: AppointmentSummary[] }) {
  if (items.length === 0) return null;
  const [t, locale] = await Promise.all([getTranslations("dashboard.upcoming"), getLocale()]);
  const top = items.slice(0, 3);
  return (
    <section className="flex flex-col gap-item rounded-xl border bg-card p-inset">
      <div className="flex items-center justify-between gap-stack">
        <div className="flex items-center gap-item">
          <IconBadge tone="primary">
            <CalendarMarkIcon />
          </IconBadge>
          <h2 className="type-heading">{t("title")}</h2>
        </div>
        <Button asChild variant="ghost" size="sm" className="-mr-inset-sm text-primary-text">
          <Link href="/appointments">{t("viewAll")}</Link>
        </Button>
      </div>
      <ul className="flex flex-col gap-stack">
        {top.map((item) => (
          <li key={item.id}>
            <Link
              href={`/appointments/${item.id}?back=/`}
              prefetch={false}
              className="flex min-h-row items-center gap-item rounded-lg border bg-background/60 p-inset-sm transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-tight">
                <span className="truncate type-item-title">{item.movie.title}</span>
                <span className="flex flex-wrap items-center gap-x-stack gap-y-tight type-caption text-muted-foreground tabular-nums">
                  <span>
                    {formatDayCompact(item.startAt, locale)} · {formatTime(item.startAt, locale)}
                  </span>
                  {item.needsReply ? (
                    <Badge variant="accent">{t("needsReply")}</Badge>
                  ) : (
                    <AppointmentStatusBadge status={item.status} />
                  )}
                </span>
              </span>
              <AltArrowRightIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function DashboardBody({ userId, period }: { userId: string; period: Period }) {
  const [t, data, appts] = await Promise.all([
    getTranslations("dashboard"),
    getDashboardOverview(userId),
    listAppointments(userId),
  ]);
  const isNewUser = data.viewingCount === 0 && data.totalSpent === 0 && data.budget.length === 0;

  if (isNewUser) {
    return (
      <>
        <UpcomingAppointmentsCard items={appts.active} />
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
                <Link href="/settings?back=/">{t("budget.configure")}</Link>
              </Button>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <UpcomingAppointmentsCard items={appts.active} />
      <Suspense key={period} fallback={<div className="min-h-area-lg animate-pulse rounded-xl border bg-card" aria-hidden />}>
        <SpendingSection userId={userId} period={period} />
      </Suspense>
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
