import type { Metadata } from "next";
import { AddIcon } from "@solar-icons/react/line-duotone";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { AppointmentFilters } from "@/components/appointment/appointment-filters";
import { AppointmentCard } from "@/components/appointment/appointment-card";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { applyFilters, FILTER_KEYS, parseFilters, type FilterValues } from "@/lib/appointment/filters";
import { requireUser } from "@/lib/auth/guards";
import { listAppointments } from "@/services/appointment.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [user, t, params] = await Promise.all([requireUser(), getTranslations("appointments"), searchParams]);
  const values = parseFilters(Object.fromEntries(FILTER_KEYS.map((key) => [key, first(params[key])])));

  return (
    <div className="flex flex-1 flex-col gap-section p-inset pb-action-clear">
      <PageHeader title={t("title")} />
      <Suspense key={JSON.stringify(values)} fallback={<LoadingState compact />}>
        <AppointmentsContent userId={user.userId} values={values} />
      </Suspense>
    </div>
  );
}

async function AppointmentsContent({ userId, values }: { userId: string; values: FilterValues }) {
  const [t, { active: allActive, past: allPast }] = await Promise.all([getTranslations("appointments"), listAppointments(userId)]);
  // One list: current ones first, finished ones after; the status filter is how to narrow it.
  const all = [...allActive, ...allPast];
  const items = applyFilters(all, values);

  const hasFilters = FILTER_KEYS.some((key) => Boolean(values[key]));
  const activeItems = applyFilters(allActive, values);
  const pastItems = applyFilters(allPast, values);
  // Only serialize the 3 facet fields needed by AppointmentFilters instead of duplicating every AppointmentSummary across RSC.
  const facetRecords = all.map(({ status, needsReply, isCreator }) => ({ status, needsReply, isCreator }));

  if (all.length === 0) {
    return (
      <EmptyState
        className="flex-1 justify-center"
        mascot="duo-watching"
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          <Button asChild size="pill">
            <Link href="/appointments/new">{t("add")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <AppointmentFilters
        values={values}
        records={facetRecords}
        action={
          <Button asChild size="icon" className="size-control shrink-0 rounded-full">
            <Link href="/appointments/new" aria-label={t("add")}>
              <AddIcon aria-hidden />
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          mascot="bubu-sleepy"
          title={t("filteredEmptyTitle")}
          description={t("filteredEmptyDescription")}
          action={
            hasFilters ? (
              <Button asChild size="pill">
                <Link href="/appointments" replace>
                  {t("filters.clear")}
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : !hasFilters && activeItems.length > 0 && pastItems.length > 0 ? (
        <div className="flex flex-col gap-section">
          <section className="flex flex-col gap-item">
            <h2 className="type-heading">{t("sectionActive")}</h2>
            <ul className="flex flex-col gap-item">
              {activeItems.map((item) => (
                <AppointmentCard key={item.id} item={item} />
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-item">
            <h2 className="type-heading text-muted-foreground">{t("sectionPast")}</h2>
            <ul className="flex flex-col gap-item">
              {pastItems.map((item) => (
                <AppointmentCard key={item.id} item={item} />
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <ul className="flex flex-col gap-item">
          {items.map((item) => (
            <AppointmentCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </>
  );
}
