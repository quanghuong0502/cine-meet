"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import {
  auditoriumReviewInputSchema,
  movieRatingInputSchema,
  rateMovie,
  rateSeat,
  reviewAuditorium,
  seatRatingInputSchema,
} from "@/services/rating.service";

export type RatingResult = { ok: true } | { ok: false; error: "invalid" | "forbidden" };

export async function rateMovieAction(input: unknown): Promise<RatingResult> {
  const user = await requireUser();
  const parsed = movieRatingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const result = await rateMovie(user.userId, parsed.data);
  if (result.ok) revalidatePath("/appointments", "layout");
  return result;
}

export async function rateSeatAction(input: unknown): Promise<RatingResult> {
  const user = await requireUser();
  const parsed = seatRatingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const result = await rateSeat(user.userId, parsed.data);
  if (result.ok) {
    revalidatePath("/appointments", "layout");
    revalidatePath("/cinemas", "layout");
  }
  return result;
}

export async function reviewAuditoriumAction(input: unknown): Promise<RatingResult> {
  const user = await requireUser();
  const parsed = auditoriumReviewInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const result = await reviewAuditorium(user.userId, parsed.data);
  revalidatePath("/cinemas", "layout");
  return result;
}
