import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MovieFormScreen } from "../movie-form-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.movies");
  return { title: t("title") };
}

export default async function EditMoviePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back } = await searchParams;
  return <MovieFormScreen id={id} back={back} />;
}
