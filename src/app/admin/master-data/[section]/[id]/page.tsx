import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { sectionFromSlug } from "@/lib/master-data-sections";
import { SectionFormScreen } from "../../_sections/form-screen";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const definition = sectionFromSlug(section);
  if (!definition) return {};
  const t = await getTranslations("admin.masterData.sections");
  return { title: t(`${definition.key}.title` as `${typeof definition.key}.title`) };
}

export default async function EditRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { section, id } = await params;
  const { back } = await searchParams;
  return <SectionFormScreen section={section} id={id} back={back} />;
}
