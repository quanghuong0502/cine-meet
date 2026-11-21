import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { objectIdField, optionalText } from "@/lib/validation/fields";
import { Appointment } from "@/models/appointment";
import { AuditoriumReview } from "@/models/auditorium-review";
import { MovieRating } from "@/models/movie-rating";
import { SeatRating } from "@/models/seat-rating";

const stars = z
  .string()
  .transform((v) => Number(v))
  .pipe(z.number().int().min(1).max(5));

export const movieRatingInputSchema = z.object({ movieId: objectIdField, rating: stars, comment: optionalText(500) });
export type MovieRatingInput = z.infer<typeof movieRatingInputSchema>;

/** The person's own rating of a movie, no community score (design 3.4). Rating again replaces the old one. */
export async function rateMovie(userId: string, input: MovieRatingInput): Promise<{ ok: true }> {
  await connectToDatabase();
  await MovieRating.updateOne(
    { userId, movieId: input.movieId },
    { $set: { rating: input.rating, comment: input.comment } },
    { upsert: true },
  );
  return { ok: true };
}

export async function getMyMovieRating(userId: string, movieId: string): Promise<{ rating: number; comment?: string } | null> {
  if (!isValidObjectId(movieId)) return null;
  await connectToDatabase();
  const row = await MovieRating.findOne({ userId, movieId }).lean();
  return row ? { rating: row.rating, comment: row.comment ?? undefined } : null;
}

export const seatRatingInputSchema = z.object({
  auditoriumId: objectIdField,
  layoutId: objectIdField,
  seatCode: z.string().trim().min(1).max(10),
  rating: stars,
  appointmentId: objectIdField.optional(),
});
export type SeatRatingInput = z.infer<typeof seatRatingInputSchema>;

/**
 * Rates a seat the person actually sat in. When it is tied to an appointment, only someone who really sat there (the
 * appointment says so) may rate it, and rating again replaces the old rating for that viewing.
 */
export async function rateSeat(userId: string, input: SeatRatingInput): Promise<{ ok: true } | { ok: false; error: "forbidden" }> {
  await connectToDatabase();
  if (input.appointmentId) {
    const doc = await Appointment.findById(input.appointmentId, "status seats").lean();
    const sat = doc?.seats?.some((s) => s.userId.toString() === userId && s.seatCode === input.seatCode);
    if (!doc || doc.status !== "COMPLETED" || !sat) return { ok: false, error: "forbidden" };
    await SeatRating.updateOne(
      { userId, appointmentId: input.appointmentId, seatCode: input.seatCode },
      { $set: { auditoriumId: input.auditoriumId, layoutId: input.layoutId, rating: input.rating } },
      { upsert: true },
    );
  } else {
    await SeatRating.create({ userId, auditoriumId: input.auditoriumId, layoutId: input.layoutId, seatCode: input.seatCode, rating: input.rating });
  }
  return { ok: true };
}

/** Every seat this person has already rated for one appointment, keyed by seat code. */
export async function getMySeatRatings(userId: string, appointmentId: string): Promise<Record<string, number>> {
  if (!isValidObjectId(appointmentId)) return {};
  await connectToDatabase();
  const rows = await SeatRating.find({ userId, appointmentId }, "seatCode rating").lean();
  return Object.fromEntries(rows.map((r) => [r.seatCode, r.rating]));
}

export const auditoriumReviewInputSchema = z.object({
  auditoriumId: objectIdField,
  sound: stars,
  ac: stars,
  cleanliness: stars,
  comment: optionalText(500),
});
export type AuditoriumReviewInput = z.infer<typeof auditoriumReviewInputSchema>;

/** The person's own review of a room (design 3.2): sound, air conditioning, cleanliness. Reviewing again replaces it. */
export async function reviewAuditorium(userId: string, input: AuditoriumReviewInput): Promise<{ ok: true }> {
  await connectToDatabase();
  await AuditoriumReview.updateOne(
    { userId, auditoriumId: input.auditoriumId },
    { $set: { sound: input.sound, ac: input.ac, cleanliness: input.cleanliness, comment: input.comment } },
    { upsert: true },
  );
  return { ok: true };
}

export async function getMyAuditoriumReview(userId: string, auditoriumId: string): Promise<AuditoriumReviewInput | null> {
  if (!isValidObjectId(auditoriumId)) return null;
  await connectToDatabase();
  const row = await AuditoriumReview.findOne({ userId, auditoriumId }).lean();
  return row ? { auditoriumId, sound: row.sound, ac: row.ac, cleanliness: row.cleanliness, comment: row.comment ?? undefined } : null;
}

/** This person's own latest rating of each seat in one room (any viewing), keyed by seat code: what their sitting history shows next to each seat. */
export async function getMySeatRatingsForRoom(userId: string, auditoriumId: string): Promise<Record<string, number>> {
  if (!isValidObjectId(auditoriumId)) return {};
  await connectToDatabase();
  const rows = await SeatRating.find({ userId, auditoriumId }, "seatCode rating").sort({ updatedAt: 1 }).lean();
  return Object.fromEntries(rows.map((r) => [r.seatCode, r.rating]));
}
