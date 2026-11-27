import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { EXPENSE_CATEGORIES } from "@/lib/appointment/cost";
import { periodBuckets, type Period } from "@/lib/dashboard/period";
import { vietnamToday } from "@/lib/movie/status";
import { isCalendarDate, objectIdField, optionalText } from "@/lib/validation/fields";
import { Auditorium } from "@/models/auditorium";
import { Branch } from "@/models/branch";
import { Brand } from "@/models/brand";
import { Expense } from "@/models/expense";
import { ManualViewing } from "@/models/manual-viewing";
import { Movie } from "@/models/movie";
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
  const boundaries = [...buckets.map((b) => b.start), buckets[buckets.length - 1].end];
  // Aggregate directly in MongoDB using the exact bucket Date boundaries (transfers <= 12 rows instead of up to 12 years of raw Expense docs).
  const grouped = await Expense.aggregate<{ _id: Date; ticket: number; fnb: number; other: number }>([
    { $match: { userId: new Types.ObjectId(userId), date: { $gte: boundaries[0], $lt: boundaries[boundaries.length - 1] } } },
    {
      $bucket: {
        groupBy: "$date",
        boundaries,
        output: {
          ticket: { $sum: { $cond: [{ $eq: ["$category", "ticket"] }, "$amount", 0] } },
          fnb: { $sum: { $cond: [{ $eq: ["$category", "fnb"] }, "$amount", 0] } },
          other: { $sum: { $cond: [{ $eq: ["$category", "other"] }, "$amount", 0] } },
        },
      },
    },
  ]);
  const indexByStart = new Map(buckets.map((b, i) => [b.start.getTime(), i]));
  for (const g of grouped) {
    const index = indexByStart.get(new Date(g._id).getTime());
    if (index === undefined) continue;
    rows[index].ticket = g.ticket;
    rows[index].fnb = g.fnb;
    rows[index].other = g.other;
    rows[index].total = g.ticket + g.fnb + g.other;
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
  const expenseDocs = EXPENSE_CATEGORIES.filter((category) => input[category] > 0).map((category) => ({
    userId,
    manualViewingId: viewing._id,
    category,
    amount: input[category],
    date,
  }));
  if (expenseDocs.length > 0) await Expense.insertMany(expenseDocs);
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

export interface ManualViewingRow {
  id: string;
  date: string;
  movieTitle?: string;
  roomLabel?: string;
  ticket: number;
  fnb: number;
  other: number;
  total: number;
  note?: string;
}

/** Recent manually logged viewings of the signed-in person, newest first, so they can review or remove mistakes. */
export async function listRecentManualViewings(userId: string, limit = 15): Promise<ManualViewingRow[]> {
  await connectToDatabase();
  const docs = await ManualViewing.find({ userId }, "movieId auditoriumId date note")
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  if (docs.length === 0) return [];
  const ids = docs.map((d) => d._id);
  const movieIds = [...new Set(docs.flatMap((d) => (d.movieId ? [d.movieId] : [])))];
  const roomIds = [...new Set(docs.flatMap((d) => (d.auditoriumId ? [d.auditoriumId] : [])))];
  const [expenses, movies, rooms] = await Promise.all([
    Expense.find({ userId, manualViewingId: { $in: ids } }, "manualViewingId category amount").lean(),
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }, "title").lean() : Promise.resolve([]),
    roomIds.length ? Auditorium.find({ _id: { $in: roomIds } }, "name branchId").lean() : Promise.resolve([]),
  ]);
  const branchIds = [...new Set(rooms.map((r) => r.branchId))];
  const branches = branchIds.length ? await Branch.find({ _id: { $in: branchIds } }, "name brandId").lean() : [];
  const brandIds = [...new Set(branches.map((b) => b.brandId))];
  const brands = brandIds.length ? await Brand.find({ _id: { $in: brandIds } }, "name").lean() : [];

  const brandName = new Map(brands.map((b) => [b._id.toString(), b.name]));
  const branchLabel = new Map(
    branches.map((b) => [b._id.toString(), [brandName.get(b.brandId.toString()), b.name].filter(Boolean).join(" · ")]),
  );
  const roomLabel = new Map(
    rooms.map((r) => [r._id.toString(), [branchLabel.get(r.branchId.toString()), r.name].filter(Boolean).join(" · ")]),
  );
  const movieTitle = new Map(movies.map((m) => [m._id.toString(), m.title]));
  const costByViewing = new Map<string, { ticket: number; fnb: number; other: number }>();
  for (const e of expenses) {
    const key = e.manualViewingId?.toString();
    if (!key) continue;
    const row = costByViewing.get(key) ?? { ticket: 0, fnb: 0, other: 0 };
    row[e.category] += e.amount;
    costByViewing.set(key, row);
  }
  return docs.map((d) => {
    const id = d._id.toString();
    const cost = costByViewing.get(id) ?? { ticket: 0, fnb: 0, other: 0 };
    return {
      id,
      date: d.date,
      movieTitle: d.movieId ? movieTitle.get(d.movieId.toString()) : undefined,
      roomLabel: d.auditoriumId ? roomLabel.get(d.auditoriumId.toString()) : undefined,
      ticket: cost.ticket,
      fnb: cost.fnb,
      other: cost.other,
      total: cost.ticket + cost.fnb + cost.other,
      note: d.note ?? undefined,
    };
  });
}
