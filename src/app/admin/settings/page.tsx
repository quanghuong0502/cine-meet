import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { LanguageSetting } from "@/components/language-setting";
import { SecuritySetting } from "@/components/security-setting";
import { requireAdmin } from "@/lib/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("placeholders.admin.settings");
  return { title: t("title") };
}

export default async function AdminSettingsPage() {
  const t = await getTranslations("placeholders.admin.settings");
  const states = await getTranslations("states");
  const admin = await requireAdmin();
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <LanguageSetting />
      <SecuritySetting hasPassword={admin.hasPassword} />
      <EmptyState
        title={states("comingSoon")}
        description={t("description")}
        mascot="bubu-sleepy"
      />
    </div>
  );
}
