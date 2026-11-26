import { isValidObjectId } from "mongoose";
import { cache } from "react";
import { z } from "zod";
import { CATALOG_MOVIES_TAG, safeCache } from "@/lib/cache";
import { connectToDatabase } from "@/lib/db";
import { isOfferedInFilter, movieStatus, vietnamToday, type MovieStatus } from "@/lib/movie/status";
import { parseYoutubeId } from "@/lib/movie/youtube";
import {
  idList, objectIdField, optionalText, optionalUrl, requiredDate, requiredInt, requiredText,
} from "@/lib/validation/fields";
import { Movie, type MovieDoc } from "@/models/movie";
import { Showtime } from "@/models/showtime";
import { createMasterDataService, type WithId } from "@/services/master-data/crud";
import { getSystemSettings } from "@/services/settings.service";

/** The admin pastes any YouTube link; only the 11-character id is stored. */
const trailerLink = z
  .string()
  .refine((value) => parseYoutubeId(value) !== null, { error: "invalid_url" })
  .optional();

export const movieInputSchema = z
  .object({
    title: requiredText(120),
    originalTitle: optionalText(120),
    synopsis: optionalText(2000),
    posterUrl: optionalUrl,
    trailerUrl: trailerLink,
    durationMin: requiredInt(1, 600),
    genreIds: idList,
    // The form's "none" choice clears the rating.
    ageRatingId: z.string().optional().transform((v) => (v === "none" ? undefined : v)).pipe(objectIdField.optional()),
    director: optionalText(120),
    cast: optionalText(300),
    language: optionalText(60),
    formatIds: idList,
    releaseDate: requiredDate,
    endDate: requiredDate.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.releaseDate && value.endDate < value.releaseDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "out_of_range" });
    }
  })
  .transform(({ trailerUrl, ...rest }) => ({
    ...rest,
    trailer: trailerUrl ? { provider: "youtube" as const, videoId: parseYoutubeId(trailerUrl) as string } : undefined,
  }));

export type MovieInput = z.infer<typeof movieInputSchema>;

export const movieService = createMasterDataService<MovieDoc>({
  entity: "movie",
  model: Movie,
  searchFields: ["title", "originalTitle"],
  sort: { releaseDate: -1, title: 1 },
  editableFields: [
    "title", "originalTitle", "synopsis", "posterUrl", "trailer", "durationMin", "genreIds", "ageRatingId",
    "director", "cast", "language", "formatIds", "releaseDate", "endDate",
  ],
  dependents: () => [{ model: Showtime, field: "movieId" }],
});

export type MovieWithStatus = WithId<MovieDoc> & { status: MovieStatus };

export function withStatus<T extends { releaseDate: string; endDate?: string | null }>(movie: T, today = vietnamToday()): T & { status: MovieStatus } {
  return { ...movie, status: movieStatus(movie, today) };
}

/** Movies for a list: search by title, optionally only one status. Showing first, then upcoming, then ended. */
export async function listMovies(options: { q?: string; status?: MovieStatus } = {}): Promise<MovieWithStatus[]> {
  const today = vietnamToday();
  const movies = (await movieService.list({ q: options.q, limit: 500 })).map((movie) => withStatus(movie, today));
  const rank: Record<MovieStatus, number> = { showing: 0, upcoming: 1, ended: 2 };
  return movies
    .filter((movie) => !options.status || movie.status === options.status)
    .sort((a, b) => rank[a.status] - rank[b.status]);
}

export interface FilterMovieItem {
  _id: string;
  title: string;
  posterUrl?: string | null;
  ageRatingId?: string | null;
  releaseDate: string;
  endDate?: string | null;
  status: MovieStatus;
}

const loadFilterMoviesCached = safeCache(
  async (today: string, upcomingDays: number): Promise<FilterMovieItem[]> => {
    await connectToDatabase();
    const docs = await Movie.find({}, "title posterUrl ageRatingId releaseDate endDate")
      .sort({ releaseDate: -1, title: 1 })
      .limit(500)
      .lean();
    const rank: Record<MovieStatus, number> = { showing: 0, upcoming: 1, ended: 2 };
    return docs
      .map((m) => {
        const item = {
          _id: m._id.toString(),
          title: m.title,
          posterUrl: m.posterUrl ?? null,
          ageRatingId: m.ageRatingId ? m.ageRatingId.toString() : null,
          releaseDate: m.releaseDate,
          endDate: m.endDate ?? null,
        };
        return withStatus(item, today);
      })
      .filter((movie) => isOfferedInFilter(movie, today, upcomingDays))
      .sort((a, b) => rank[a.status] - rank[b.status]);
  },
  ["catalog-filter-movies"],
  { tags: [CATALOG_MOVIES_TAG], revalidate: 300 },
);

/** Movies for the user's filter and poster strip: showing now, plus coming soon inside the window the admin set in the system settings. */
export async function listFilterMovies(): Promise<FilterMovieItem[]> {
  const settings = await getSystemSettings();
  return loadFilterMoviesCached(vietnamToday(), settings.movieUpcomingDays);
}

/** Cached minimal movie list (`{ id, title }`) for pick-lists like manual viewing logs (skips synopsis/cast/etc.). */
export const listMovieTitles = safeCache(
  async (): Promise<{ id: string; title: string }[]> => {
    await connectToDatabase();
    const docs = await Movie.find({}, "title").sort({ releaseDate: -1, title: 1 }).limit(500).lean();
    return docs.map((m) => ({ id: m._id.toString(), title: m.title }));
  },
  ["catalog-movie-titles"],
  { tags: [CATALOG_MOVIES_TAG], revalidate: 300 },
);

/** Deduplicated per render via React `cache()` so `generateMetadata` and `MovieDetailPage` share one DB read. */
export const getMovie = cache(async (id: string): Promise<MovieWithStatus | null> => {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const movie = await movieService.getById(id);
  return movie ? withStatus(movie) : null;
});
