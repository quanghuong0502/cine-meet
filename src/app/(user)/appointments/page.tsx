import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AppointmentFilters } from "@/components/appointment/appointment-filters";
import { AppointmentCard } from "@/components/appointment/appointment-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { applyFilters, FILTER_KEYS, parseFilters } from "@/lib/appointment/filters";
import { requireUser } from "@/lib/auth/guards";
import { listAppointments } from "@/services/appointment.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const t = await getTranslations("appointments");
  const params = await searchParams;
  const values = parseFilters(Object.fromEntries(FILTER_KEYS.map((key) => [key, first(params[key])])));
  const { active: allActive, past: allPast } = await listAppointments(user.userId);
  // One list: current ones first, finished ones after; the status filter is how to narrow it.
  const all = [...allActive, ...allPast];
  const items = applyFilters(all, values);

  return (
    <div className="flex flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} />

      {all.length === 0 ? (
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
      ) : (
        <>
          <AppointmentFilters
            values={values}
            records={all}
            action={
              <Button asChild size="icon" className="size-control shrink-0 rounded-full">
                <Link href="/appointments/new" aria-label={t("add")}>
                  <Plus aria-hidden />
                </Link>
              </Button>
            }
          />
          {items.length === 0 ? (
            <EmptyState mascot="bubu-sleepy" title={t("filteredEmptyTitle")} description={t("filteredEmptyDescription")} />
          ) : (
            <ul className="flex flex-col gap-stack">
              {items.map((item) => (
                <AppointmentCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
