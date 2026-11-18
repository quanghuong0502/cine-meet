import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppointmentDetail } from "@/components/appointment/appointment-detail";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getAppointment } from "@/services/appointment.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments.detail");
  return { title: t("title") };
}

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const t = await getTranslations("appointments.detail");
  const view = await getAppointment(user.userId, id);
  if (!view) notFound();
  return (
    <div className="flex w-full flex-col gap-section p-inset">
      <PageHeader title={t("title")} backHref="/appointments" />
      <AppointmentDetail view={view} />
    </div>
  );
}
