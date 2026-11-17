import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuditoriumEditorScreen } from "../editor-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.auditoriums");
  return { title: t("title") };
}

export default async function EditAuditoriumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string; from?: string; back?: string }>;
}) {
  const { id } = await params;
  const { version, from, back } = await searchParams;
  return <AuditoriumEditorScreen id={id} version={version} from={from} back={back} />;
}
