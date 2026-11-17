import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MovieFormScreen } from "../movie-form-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.movies");
  return { title: t("title") };
}

export default async function NewMoviePage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const { back } = await searchParams;
  return <MovieFormScreen id={null} back={back} />;
}
