import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/placeholder-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("placeholders.admin.overview");
  return { title: t("title") };
}

export default async function AdminDashboardPage() {
  const t = await getTranslations("placeholders.admin.overview");
  return <PlaceholderPage title={t("title")} description={t("description")} />;
}
