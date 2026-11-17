import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShowtimeImportForm } from "@/components/admin/showtime-import-form";
import { PageHeader } from "@/components/page-header";
import { resolveBackHref } from "@/lib/admin/back-href";
import { importShowtimesAction } from "../../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.movies.import");
  return { title: t("title") };
}

export default async function ImportShowtimesPage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const t = await getTranslations("admin.movies.import");
  const { back } = await searchParams;
  const backHref = resolveBackHref(back, "/admin/movies/showtimes");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={t("title")} backHref={backHref} />
      <ShowtimeImportForm backHref={backHref} action={importShowtimesAction} />
    </div>
  );
}
