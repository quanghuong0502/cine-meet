import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getMoviePosterUploadTicket } from "@/actions/uploads";
import { ResourceForm } from "@/components/admin/resource-form";
import type { ResourceField } from "@/components/admin/resource-types";
import { PageHeader } from "@/components/page-header";
import { resolveBackHref } from "@/lib/admin/back-href";
import { youtubeWatchUrl } from "@/lib/movie/youtube";
import { ageRatingService } from "@/services/master-data/age-rating.service";
import { formatService } from "@/services/master-data/format.service";
import { genreService } from "@/services/master-data/genre.service";
import { getMovie } from "@/services/movie.service";
import { removeMovie, saveMovie } from "./actions";

/** The entry screen of a movie (add when `id` is null, edit otherwise). */
export async function MovieFormScreen({ id, back }: { id: string | null; back?: string }) {
  const t = await getTranslations("admin.movies");
  const locale = await getLocale();
  const [movie, genres, formats, ratings] = await Promise.all([
    id ? getMovie(id) : Promise.resolve(null),
    genreService.list({}),
    formatService.list({}),
    ageRatingService.list({}),
  ]);
  if (id && !movie) notFound();
  const backHref = resolveBackHref(back, "/admin/movies");
  // Switched-off genres and formats are not offered for new choices, but a movie that already has one keeps showing it.
  const keep = new Set([...(movie?.genreIds ?? []), ...(movie?.formatIds ?? [])].map(String));
  const offered = <T extends { _id: { toString(): string }; active?: boolean | null }>(items: T[]) => items.filter((item) => item.active !== false || keep.has(item._id.toString()));

  const fields: ResourceField[] = [
    { name: "title", kind: "text", label: t("fields.title"), required: true, maxLength: 120 },
    { name: "originalTitle", kind: "text", label: t("fields.originalTitle"), maxLength: 120 },
    { name: "posterUrl", kind: "image", imageShape: "poster", label: t("fields.posterUrl"), uploadTicket: getMoviePosterUploadTicket },
    { name: "trailerUrl", kind: "url", label: t("fields.trailerUrl"), placeholder: "https://youtu.be/...", maxLength: 300 },
    { name: "durationMin", kind: "number", label: t("fields.durationMin"), required: true, step: "1", min: 1, max: 600, placeholder: "120" },
    { name: "releaseDate", kind: "date", label: t("fields.releaseDate"), required: true },
    { name: "endDate", kind: "date", label: t("fields.endDate") },
    { name: "genreIds", kind: "multiSelect", label: t("fields.genreIds"), options: offered(genres).map((g) => ({ value: g._id.toString(), label: locale === "en" && g.nameEn ? g.nameEn : g.name })) },
    {
      name: "ageRatingId",
      kind: "select",
      label: t("fields.ageRatingId"),
      placeholder: t("fields.ageRatingPlaceholder"),
      options: [{ value: "none", label: t("fields.noAgeRating") }, ...ratings.map((r) => ({ value: r._id.toString(), label: `${r.code} · ${locale === "en" && r.descriptionEn ? r.descriptionEn : r.description}` }))],
    },
    { name: "formatIds", kind: "multiSelect", label: t("fields.formatIds"), options: offered(formats).map((f) => ({ value: f._id.toString(), label: f.name })) },
    { name: "language", kind: "text", label: t("fields.language"), maxLength: 60 },
    { name: "director", kind: "text", label: t("fields.director"), maxLength: 120 },
    { name: "cast", kind: "textarea", label: t("fields.cast"), maxLength: 300 },
    { name: "synopsis", kind: "textarea", label: t("fields.synopsis"), maxLength: 2000 },
  ];

  const values: Record<string, string> = movie
    ? {
        title: movie.title,
        originalTitle: movie.originalTitle ?? "",
        posterUrl: movie.posterUrl ?? "",
        trailerUrl: movie.trailer ? youtubeWatchUrl(movie.trailer.videoId) : "",
        durationMin: String(movie.durationMin),
        releaseDate: movie.releaseDate,
        endDate: movie.endDate ?? "",
        genreIds: (movie.genreIds ?? []).map(String).join(","),
        ageRatingId: movie.ageRatingId?.toString() ?? "",
        formatIds: (movie.formatIds ?? []).map(String).join(","),
        language: movie.language ?? "",
        director: movie.director ?? "",
        cast: movie.cast ?? "",
        synopsis: movie.synopsis ?? "",
      }
    : {};

  const title = t(movie ? "editTitle" : "createTitle");
  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={title} backHref={backHref} />
      <ResourceForm
        itemId={id}
        fields={fields}
        values={values}
        backHref={backHref}
        saveAction={saveMovie}
        deleteItem={movie ? { id: movie._id.toString(), name: movie.title, removeAction: removeMovie } : undefined}
      />
    </div>
  );
}
