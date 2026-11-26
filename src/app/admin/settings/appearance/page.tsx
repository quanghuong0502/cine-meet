import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrandColorPicker } from "@/components/admin/brand-color-picker";
import { ResourceForm } from "@/components/admin/resource-form";
import { PageHeader } from "@/components/page-header";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireAdmin } from "@/lib/auth/guards";
import { getBrandColor } from "@/services/brand-color.service";
import { resetBrandColorAction, saveBrandColorAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.appearance");
  return { title: t("title") };
}

export default async function AppearanceSettingsPage() {
  await requireAdmin();
  // Read straight from the database (not the cached theme) so the form always starts from what is really saved.
  const [t, hex] = await Promise.all([getTranslations("admin.appearance"), getBrandColor()]);

  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.appearance"]}>
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/admin/settings" />
        <ResourceForm
          itemId={null}
          fields={[]}
          values={{}}
          backHref="/admin/settings"
          saveAction={saveBrandColorAction}
          lead={<BrandColorPicker initialHex={hex} label={t("fields.color.label")} resetAction={resetBrandColorAction} />}
        />
      </div>
    </ScopedIntlProvider>
  );
}
