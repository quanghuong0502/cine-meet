import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RoomReportsList } from "@/components/admin/room-reports-list";
import { PageHeader } from "@/components/page-header";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireAdmin } from "@/lib/auth/guards";
import { listRoomReports } from "@/services/room-report.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.roomReports");
  return { title: t("title") };
}

export default async function RoomReportsPage() {
  await requireAdmin();
  const [t, reports] = await Promise.all([getTranslations("admin.roomReports"), listRoomReports()]);
  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.roomReports"]}>
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/admin/settings" />
        <RoomReportsList reports={reports} />
      </div>
    </ScopedIntlProvider>
  );
}
