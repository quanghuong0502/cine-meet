import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/placeholder-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("placeholders.admin.movies");
  return { title: t("title") };
}

export default async function AdminMoviesPage() {
  const t = await getTranslations("placeholders.admin.movies");
  return <PlaceholderPage title={t("title")} description={t("description")} />;
}
