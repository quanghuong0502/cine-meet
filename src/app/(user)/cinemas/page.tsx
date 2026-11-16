import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/placeholder-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("placeholders.user.cinemas");
  return { title: t("title") };
}

export default async function CinemasPage() {
  const t = await getTranslations("placeholders.user.cinemas");
  return <PlaceholderPage title={t("title")} description={t("description")} />;
}
