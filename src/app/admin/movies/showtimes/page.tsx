import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CalendarPlus, FileUp } from "lucide-react";
import { AdminShowtimeList } from "@/components/admin/showtime-list";
import { MoviesTabs } from "@/components/admin/movies-tabs";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { searchShowtimes } from "@/services/showtime.service";
import { removeShowtimeAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.movies");
  return { title: t("title") };
}

export default async function AdminShowtimesPage() {
  const t = await getTranslations("admin.movies");
  const rows = await searchShowtimes({ admin: true, limit: 300 });

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} description={t("description")} />
      <MoviesTabs active="showtimes" />
      {rows.length === 0 ? (
        <EmptyState mascot="bubu-sleepy" title={t("showtimes.emptyTitle")} description={t("showtimes.emptyDescription")} />
      ) : (
        <AdminShowtimeList rows={rows} removeAction={removeShowtimeAction} />
      )}

      <div aria-hidden className="h-action-clear shrink-0" />
      <div data-bottom-fixed className="pointer-events-none fixed inset-x-0 bottom-[var(--bottom-nav-h,0px)] z-30 px-inset md:left-sidebar">
        <div className="mx-auto flex max-w-menu gap-stack">
          <Button asChild size="cta" className="pointer-events-auto min-w-0 flex-1">
            <Link href="/admin/movies/showtimes/bulk?back=/admin/movies/showtimes">
              <CalendarPlus aria-hidden />
              {t("showtimes.bulkButton")}
            </Link>
          </Button>
          <Button asChild size="cta" variant="secondary" className="pointer-events-auto min-w-0 flex-1">
            <Link href="/admin/movies/showtimes/import?back=/admin/movies/showtimes">
              <FileUp aria-hidden />
              {t("showtimes.importButton")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
