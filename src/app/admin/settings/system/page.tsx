import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResourceForm } from "@/components/admin/resource-form";
import type { ResourceField } from "@/components/admin/resource-types";
import { PageHeader } from "@/components/page-header";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireAdmin } from "@/lib/auth/guards";
import { getSystemSettings, MAX_DEADLINE_MINUTES, MAX_PUSH_TTL_HOURS } from "@/services/settings.service";
import { saveSystemSettings } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.systemSettings");
  return { title: t("title") };
}

export default async function SystemSettingsPage() {
  await requireAdmin();
  const [t, settings] = await Promise.all([getTranslations("admin.systemSettings"), getSystemSettings()]);

  const fields: ResourceField[] = [
    { name: "reminderMinutesBefore", kind: "text", plain: true, label: t("fields.reminderMinutesBefore.label"), placeholder: t("fields.reminderMinutesBefore.placeholder"), required: true, maxLength: 60 },
    { name: "responseDeadlineMinutes", kind: "number", label: t("fields.responseDeadlineMinutes.label"), required: true, step: "1", min: 0, max: MAX_DEADLINE_MINUTES },
    { name: "adMinutes", kind: "number", label: t("fields.adMinutes.label"), required: true, step: "1", min: 0, max: 60 },
    { name: "timeSlots", kind: "timeSlots", label: t("fields.timeSlots.label") },
    { name: "pushTtlHours", kind: "number", label: t("fields.pushTtlHours.label"), required: true, step: "1", min: 1, max: MAX_PUSH_TTL_HOURS },
    { name: "movieUpcomingDays", kind: "number", label: t("fields.movieUpcomingDays.label"), required: true, step: "1", min: 0, max: 365 },
  ];

  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.systemSettings.slots"]}>
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/admin/settings" />
        <ResourceForm
          itemId={null}
          fields={fields}
          values={{
            reminderMinutesBefore: settings.reminderMinutesBefore.join(", "),
            responseDeadlineMinutes: String(settings.responseDeadlineMinutes),
            adMinutes: String(settings.adMinutes),
            movieUpcomingDays: String(settings.movieUpcomingDays),
            pushTtlHours: String(settings.pushTtlHours),
            timeSlots: JSON.stringify(settings.timeSlots),
          }}
          backHref="/admin/settings"
          saveAction={saveSystemSettings}
        />
      </div>
    </ScopedIntlProvider>
  );
}
