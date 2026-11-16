import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LanguageSetting } from "@/components/language-setting";
import { PageHeader } from "@/components/page-header";
import { SecuritySetting } from "@/components/security-setting";
import { requireUser } from "@/lib/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

/** Everything about the account lives here: language, password... */
export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title={t("title")} backHref="/profile" />
      <LanguageSetting />
      <SecuritySetting hasPassword={user.hasPassword} />
    </div>
  );
}
