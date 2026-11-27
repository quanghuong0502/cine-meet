import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Room3DAppearanceForm } from "@/components/admin/room-3d-appearance-form";
import { PageHeader } from "@/components/page-header";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireAdmin } from "@/lib/auth/guards";
import { getCinemaDimensions } from "@/services/cinema-dimensions.service";
import { getCachedSeatTypes } from "@/services/master-data/catalog-cache";
import { getRoom3DAppearance } from "@/services/room-3d-appearance.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.room3dAppearance");
  return { title: t("title") };
}

export default async function Room3DAppearancePage() {
  await requireAdmin();
  const [t, locale, appearance, dimensionDefaults, rawSeatTypes] = await Promise.all([
    getTranslations("admin.room3dAppearance"),
    getLocale(),
    getRoom3DAppearance(),
    getCinemaDimensions(),
    getCachedSeatTypes(),
  ]);
  const seatTypes = rawSeatTypes.map((st) => ({
    id: st.id,
    name: locale === "en" && st.nameEn ? st.nameEn : st.name,
    capacity: st.capacity,
    style: st.style,
    color: st.color,
    color3d: st.color3d,
  }));

  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.room3dAppearance", "imageUpload", "cinemas.room"]}>
      <div className="mx-auto flex w-full max-w-editor flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/admin/settings" />
        <Room3DAppearanceForm initial={appearance} dimensionDefaults={dimensionDefaults} seatTypes={seatTypes} />
      </div>
    </ScopedIntlProvider>
  );
}
