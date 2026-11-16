import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LanguageSetting } from "@/components/language-setting";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <LanguageSetting />
    </div>
  );
}
