import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { movieStatus, vietnamToday, type MovieStatus } from "@/lib/movie/status";
import { parseYoutubeId } from "@/lib/movie/youtube";
import {
  idList, objectIdField, optionalText, optionalUrl, requiredDate, requiredInt, requiredText,
} from "@/lib/validation/fields";
import { Movie, type MovieDoc } from "@/models/movie";
import { Showtime } from "@/models/showtime";
import { createMasterDataService, type WithId } from "@/services/master-data/crud";

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
    ageRatingId: objectIdField.optional(),
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

export async function getMovie(id: string): Promise<MovieWithStatus | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const movie = await movieService.getById(id);
  return movie ? withStatus(movie) : null;
}
