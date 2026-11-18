import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MoviesTabs } from "@/components/admin/movies-tabs";
import { ResourceManager } from "@/components/admin/resource-manager";
import { PageHeader } from "@/components/page-header";
import { formatDay } from "@/app/admin/master-data/_sections/create-section";
import { genreService } from "@/services/master-data/genre.service";
import { listMovies } from "@/services/movie.service";
import { removeMovie } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.movies");
  return { title: t("title") };
}

export default async function AdminMoviesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getTranslations("admin.movies");
  const tm = await getTranslations("movie");
  const locale = await getLocale();
  const { q = "" } = await searchParams;
  const [movies, genres] = await Promise.all([listMovies({ q }), genreService.list({})]);
  const genreName = new Map(genres.map((g) => [g._id.toString(), locale === "en" && g.nameEn ? g.nameEn : g.name]));

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} description={t("description")} />
      <MoviesTabs active="movies" />
      <ResourceManager
        basePath="/admin/movies"
        query={q}
        searchLabels={{ placeholder: t("searchPlaceholder"), label: t("searchLabel") }}
        labels={{ addButton: t("addButton"), emptyTitle: t("emptyTitle"), emptyDescription: t("emptyDescription") }}
        items={movies.map((movie) => ({
          id: movie._id.toString(),
          title: movie.title,
          imageUrl: movie.posterUrl ?? undefined,
          imageShape: "poster" as const,
          subtitle: (movie.genreIds ?? []).map((id) => genreName.get(id.toString())).filter(Boolean).join(", ") || undefined,
          meta: [tm(`status.${movie.status}`), tm("duration", { minutes: movie.durationMin }), formatDay(movie.releaseDate, locale, "short")],
        }))}
        removeAction={removeMovie}
      />
    </div>
  );
}
