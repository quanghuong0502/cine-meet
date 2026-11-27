import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarAddIcon, UploadMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { AdminShowtimeList } from "@/components/admin/showtime-list";
import { MoviesTabs } from "@/components/admin/movies-tabs";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { Button } from "@/components/ui/button";
import { isCalendarDate } from "@/lib/validation/fields";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { getCachedBranches } from "@/services/master-data/catalog-cache";
import { listMovies } from "@/services/movie.service";
import { searchShowtimes } from "@/services/showtime.service";
import { removeShowtimeAction, removeShowtimesBulkAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.movies");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminShowtimesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, params] = await Promise.all([getTranslations("admin.movies"), searchParams]);
  const rawDate = first(params.date);
  const date = rawDate && isCalendarDate(rawDate) ? rawDate : undefined;
  const branchId = first(params.branch) || undefined;
  const movieId = first(params.movie) || undefined;

  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.movies.showtimes"]}>
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} description={t("description")} />
        <MoviesTabs active="showtimes" />
        <Suspense key={`${date ?? ""}|${branchId ?? ""}|${movieId ?? ""}`} fallback={<LoadingState compact />}>
          <AdminShowtimesBody date={date} branchId={branchId} movieId={movieId} />
        </Suspense>

        <div aria-hidden className="h-action-clear shrink-0" />
        <div data-bottom-fixed className="pointer-events-none fixed inset-x-0 bottom-[var(--bottom-nav-h,0px)] z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-inset pt-group md:left-sidebar md:pb-inset">
          <div className="mx-auto flex max-w-menu flex-wrap gap-stack">
            <Button asChild size="cta" className="pointer-events-auto w-auto flex-auto px-inset-sm">
              <Link href="/admin/movies/showtimes/bulk?back=/admin/movies/showtimes">
                <CalendarAddIcon aria-hidden />
                {t("showtimes.bulkButton")}
              </Link>
            </Button>
            <Button asChild size="cta" variant="secondary" className="pointer-events-auto w-auto flex-auto px-inset-sm">
              <Link href="/admin/movies/showtimes/import?back=/admin/movies/showtimes">
                <UploadMinimalisticIcon aria-hidden />
                {t("showtimes.importButton")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </ScopedIntlProvider>
  );
}

async function AdminShowtimesBody({ date, branchId, movieId }: { date?: string; branchId?: string; movieId?: string }) {
  const [rows, branches, brands, movies] = await Promise.all([
    searchShowtimes({ admin: true, date, branchId, movieId, limit: 300 }),
    getCachedBranches(),
    getBrandOptions(),
    listMovies({}),
  ]);
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const branchOptions = branches
    .map((b) => ({ value: b.id, label: [brandName.get(b.brandId), b.name].filter(Boolean).join(" · ") }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  const movieOptions = movies
    .map((m) => ({ value: m._id.toString(), label: m.title }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));

  return (
    <AdminShowtimeList
      rows={rows}
      filters={{ date: date ?? "", branch: branchId ?? "", movie: movieId ?? "" }}
      branchOptions={branchOptions}
      movieOptions={movieOptions}
      limit={300}
      removeAction={removeShowtimeAction}
      removeBulkAction={removeShowtimesBulkAction}
    />
  );
}
