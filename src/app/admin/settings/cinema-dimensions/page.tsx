import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CinemaDimensionsForm } from "@/components/admin/cinema-dimensions-form";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth/guards";
import { getCinemaDimensions } from "@/services/cinema-dimensions.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.cinemaDimensions");
  return { title: t("title") };
}

export default async function CinemaDimensionsPage() {
  await requireAdmin();
  const [t, dimensions] = await Promise.all([
    getTranslations("admin.cinemaDimensions"),
    getCinemaDimensions(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} backHref="/admin/settings" />
      <CinemaDimensionsForm initial={dimensions} />
    </div>
  );
}
