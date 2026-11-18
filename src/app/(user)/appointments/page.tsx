import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointment/appointment-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { listAppointments } from "@/services/appointment.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments");
  return { title: t("title") };
}

export default async function AppointmentsPage() {
  const user = await requireUser();
  const t = await getTranslations("appointments");
  const { active, past } = await listAppointments(user.userId);

  return (
    <div className="flex flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} />
      <div className="flex items-center justify-between gap-item">
        <h2 className="type-heading">{t("listTitle")}</h2>
        <Button asChild size="icon" className="size-control shrink-0 rounded-full">
          <Link href="/appointments/new" aria-label={t("add")}>
            <Plus aria-hidden />
          </Link>
        </Button>
      </div>

      {active.length === 0 && past.length === 0 ? (
        <EmptyState
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
          {active.length > 0 ? (
            <ul className="flex flex-col gap-stack">
              {active.map((item) => (
                <AppointmentCard key={item.id} item={item} />
              ))}
            </ul>
          ) : null}
          {past.length > 0 ? (
            <section aria-labelledby="appointments-past" className="flex flex-col gap-item">
              <h2 id="appointments-past" className="type-heading">
                {t("pastTitle")}
              </h2>
              <ul className="flex flex-col gap-stack">
                {past.map((item) => (
                  <AppointmentCard key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
