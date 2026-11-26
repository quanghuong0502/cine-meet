import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Room3DAppearanceForm } from "@/components/admin/room-3d-appearance-form";
import { PageHeader } from "@/components/page-header";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireAdmin } from "@/lib/auth/guards";
import { getCinemaDimensions } from "@/services/cinema-dimensions.service";
import { getRoom3DAppearance } from "@/services/room-3d-appearance.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.room3dAppearance");
  return { title: t("title") };
}

export default async function Room3DAppearancePage() {
  await requireAdmin();
  const [t, appearance, dimensionDefaults] = await Promise.all([
    getTranslations("admin.room3dAppearance"),
    getRoom3DAppearance(),
    getCinemaDimensions(),
  ]);

  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.room3dAppearance", "imageUpload", "cinemas.room"]}>
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/admin/settings" />
        <Room3DAppearanceForm initial={appearance} dimensionDefaults={dimensionDefaults} />
      </div>
    </ScopedIntlProvider>
  );
}
