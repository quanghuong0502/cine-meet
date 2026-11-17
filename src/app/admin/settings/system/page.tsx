import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResourceForm } from "@/components/admin/resource-form";
import type { ResourceField } from "@/components/admin/resource-types";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth/guards";
import { getSystemSettings } from "@/services/settings.service";
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
    { name: "responseDeadlineHours", kind: "number", label: t("fields.responseDeadlineHours.label"), required: true, step: "1", min: 1, max: 168 },
    { name: "adMinutes", kind: "number", label: t("fields.adMinutes.label"), required: true, step: "1", min: 0, max: 60 },
    { name: "movieUpcomingDays", kind: "number", label: t("fields.movieUpcomingDays.label"), required: true, step: "1", min: 0, max: 365 },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={t("title")} backHref="/admin/settings" />
      <ResourceForm
        itemId={null}
        fields={fields}
        values={{
          reminderMinutesBefore: settings.reminderMinutesBefore.join(", "),
          responseDeadlineHours: String(settings.responseDeadlineHours),
          adMinutes: String(settings.adMinutes),
          movieUpcomingDays: String(settings.movieUpcomingDays),
        }}
        backHref="/admin/settings"
        saveAction={saveSystemSettings}
      />
    </div>
  );
}
