import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuditoriumEditorScreen } from "../editor-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.auditoriums");
  return { title: t("newTitle") };
}

export default async function NewAuditoriumPage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const { back } = await searchParams;
  return <AuditoriumEditorScreen id={null} back={back} />;
}
