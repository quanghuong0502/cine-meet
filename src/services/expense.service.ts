import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { EXPENSE_CATEGORIES } from "@/lib/appointment/cost";
import { bucketIndexOf, periodBuckets, type Period } from "@/lib/dashboard/period";
import { vietnamToday } from "@/lib/movie/status";
import { isCalendarDate, objectIdField, optionalText } from "@/lib/validation/fields";
import { Expense } from "@/models/expense";
import { ManualViewing } from "@/models/manual-viewing";
import { checkBudgetWarnings } from "@/services/budget.service";

export interface SpendingBucket {
  key: string;
  ticket: number;
  fnb: number;
  other: number;
  total: number;
}

/** `count` buckets of `period`, oldest first, ending with the one `now` falls in: the dashboard's "by day/week/month/year" chart and total (design 3.1). Never double-counts: each expense is in exactly one bucket. */
export async function getSpendingTimeline(userId: string, period: Period, now = new Date(), count = 12): Promise<SpendingBucket[]> {
  await connectToDatabase();
  const buckets = periodBuckets(period, now, count);
  const rows: SpendingBucket[] = buckets.map((b) => ({ key: b.key, ticket: 0, fnb: 0, other: 0, total: 0 }));
  if (buckets.length === 0) return rows;
  const expenses = await Expense.find(
    { userId, date: { $gte: buckets[0].start, $lt: buckets[buckets.length - 1].end } },
    "category amount date",
  ).lean();
  for (const e of expenses) {
    const index = bucketIndexOf(buckets, e.date);
    if (index === -1) continue;
    const row = rows[index];
    row[e.category as "ticket" | "fnb" | "other"] += e.amount;
    row.total += e.amount;
  }
  return rows;
}

/** The form's "none" choice (or leaving it blank) means the person does not know or does not care to say. */
const optionalPickedId = z
  .string()
  .optional()
  .transform((v) => (v && v !== "none" ? v : undefined))
  .pipe(objectIdField.optional());

export const manualViewingInputSchema = z.object({
  movieId: optionalPickedId,
  auditoriumId: optionalPickedId,
  date: z
    .string()
    .refine(isCalendarDate, { error: "invalid_date" })
    .refine((d) => d <= vietnamToday(), { error: "future_date" }),
  ticket: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? Number(v.replace(/\D/g, "")) : 0))
    .pipe(z.number().int().min(0).max(100_000_000)),
  fnb: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? Number(v.replace(/\D/g, "")) : 0))
    .pipe(z.number().int().min(0).max(100_000_000)),
  other: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? Number(v.replace(/\D/g, "")) : 0))
    .pipe(z.number().int().min(0).max(100_000_000)),
  note: optionalText(200),
});
export type ManualViewingInput = z.infer<typeof manualViewingInputSchema>;

/**
 * Logs a viewing that did not go through an appointment (design 3.4 "Bổ sung"): watched alone, or booked outside the app. Only
 * costs actually entered become `expenses`; the viewing itself (for stats and "frequently visited") is kept even with no cost.
 */
export async function logManualViewing(userId: string, input: ManualViewingInput): Promise<{ ok: true; id: string }> {
  await connectToDatabase();
  const viewing = await ManualViewing.create({
    userId,
    movieId: input.movieId,
    auditoriumId: input.auditoriumId,
    date: input.date,
    note: input.note,
  });
  const date = new Date(`${input.date}T12:00:00+07:00`);
  for (const category of EXPENSE_CATEGORIES) {
    const amount = input[category];
    if (amount <= 0) continue;
    await Expense.create({ userId, manualViewingId: viewing._id, category, amount, date });
  }
  await checkBudgetWarnings([userId]);
  return { ok: true, id: viewing._id.toString() };
}

/** Removes a manually logged viewing and whatever cost was recorded for it. Only the person who logged it may remove it. */
export async function removeManualViewing(userId: string, id: string): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  if (!isValidObjectId(id)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const result = await ManualViewing.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) return { ok: false, error: "not_found" };
  await Expense.deleteMany({ manualViewingId: id });
  return { ok: true };
}
