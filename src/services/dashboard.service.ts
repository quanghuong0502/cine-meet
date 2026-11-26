import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import type { Period } from "@/lib/dashboard/period";
import { Appointment } from "@/models/appointment";
import { Auditorium } from "@/models/auditorium";
import { Expense } from "@/models/expense";
import { ManualViewing } from "@/models/manual-viewing";
import { Movie } from "@/models/movie";
import { Showtime } from "@/models/showtime";
import { User } from "@/models/user";
import { getBudgetProgress, type BudgetProgress } from "@/services/budget.service";
import { getSpendingTimeline, type SpendingBucket } from "@/services/expense.service";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { getCachedBranches, getCachedGenres } from "@/services/master-data/catalog-cache";
import { rankFrequentBranches, type ViewingSession } from "@/services/viewing-history.service";

export interface NamedCount {
  id: string;
  name: string;
  count: number;
}

export interface CompanionStat {
  id: string;
  name: string;
  avatar?: string;
  count: number;
}

export interface DashboardData {
  period: Period;
  spending: SpendingBucket[];
  budget: BudgetProgress[];
  viewingCount: number;
  averageCostPerViewing: number;
  topGenres: NamedCount[];
  topBranches: NamedCount[];
  companions: CompanionStat[];
}

/**
 * Everything the dashboard shows (design 3.1): spending for the chosen granularity, this month's budget, who the person
 * watches with most, the branches and genres they go to most. Built only
 * from this person's own `expenses` and completed appointments — never another person's numbers.
 */
export async function getDashboard(userId: string, period: Period, now = new Date()): Promise<DashboardData> {
  await connectToDatabase();
  const [spending, budget, completed, manual, totalAggResult] = await Promise.all([
    getSpendingTimeline(userId, period, now),
    getBudgetProgress(userId, now),
    // Single completed-appointments query shared for genres, companions, and viewing sessions (fixes duplicate read + $elemMatch).
    Appointment.find(
      { status: "COMPLETED", $or: [{ creatorId: userId }, { participants: { $elemMatch: { userId, status: "accepted" } } }] },
      "movieId participants creatorId showtimeId seats completedAt",
    ).lean(),
    ManualViewing.find({ userId }, "movieId auditoriumId layoutId seatCode date").lean(),
    Expense.aggregate<{ total: number }>([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  // Precompute top 5 companion IDs before hitting `User`.
  const companionCounts = new Map<string, number>();
  for (const a of completed) {
    const others = [a.creatorId.toString(), ...a.participants.filter((p) => p.status === "accepted").map((p) => p.userId.toString())].filter((id) => id !== userId);
    for (const id of new Set(others)) companionCounts.set(id, (companionCounts.get(id) ?? 0) + 1);
  }
  const topCompanionIds = [...companionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const movieIds = [...new Set(completed.map((a) => a.movieId.toString()))];
  const showtimeIds = completed.flatMap((a) => (a.showtimeId ? [a.showtimeId] : []));

  // Wave 2: fetch Movies, Showtimes, and top 5 Companion Users in parallel.
  const [movies, showtimes, companionPeople] = await Promise.all([
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }, "genreIds").lean() : Promise.resolve([]),
    showtimeIds.length ? Showtime.find({ _id: { $in: showtimeIds } }, "auditoriumId layoutId").lean() : Promise.resolve([]),
    topCompanionIds.length ? User.find({ _id: { $in: topCompanionIds } }, "name avatar").lean() : Promise.resolve([]),
  ]);

  const movieById = new Map(movies.map((m) => [m._id.toString(), m]));
  const genreCounts = new Map<string, number>();
  for (const a of completed) {
    for (const g of movieById.get(a.movieId.toString())?.genreIds ?? []) {
      genreCounts.set(g.toString(), (genreCounts.get(g.toString()) ?? 0) + 1);
    }
  }
  const topGenreIds = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const showtimeById = new Map(showtimes.map((s) => [s._id.toString(), s]));
  const auditoriumIds = [
    ...new Set([...showtimes.map((s) => s.auditoriumId.toString()), ...manual.flatMap((m) => (m.auditoriumId ? [m.auditoriumId.toString()] : []))]),
  ];

  // Wave 3: fetch Auditoriums + cached Genres/Branches/Brands in parallel.
  const [auditoriums, genres, allBranches, allBrands] = await Promise.all([
    auditoriumIds.length ? Auditorium.find({ _id: { $in: auditoriumIds } }, "branchId").lean() : Promise.resolve([]),
    topGenreIds.length ? getCachedGenres() : Promise.resolve([]),
    getCachedBranches(),
    getBrandOptions(),
  ]);

  const branchByAuditorium = new Map(auditoriums.map((a) => [a._id.toString(), a.branchId.toString()]));
  const sessions: ViewingSession[] = [
    ...completed.flatMap((a): ViewingSession[] => {
      const showtime = a.showtimeId ? showtimeById.get(a.showtimeId.toString()) : undefined;
      if (!showtime) return [];
      const auditoriumId = showtime.auditoriumId.toString();
      const seatCode = a.seats?.find((s) => s.userId.toString() === userId)?.seatCode;
      return [{ at: a.completedAt ?? new Date(0), movieId: a.movieId.toString(), branchId: branchByAuditorium.get(auditoriumId), auditoriumId, layoutId: showtime.layoutId.toString(), seatCode }];
    }),
    ...manual.map((m): ViewingSession => ({
      at: new Date(`${m.date}T12:00:00+07:00`),
      movieId: m.movieId?.toString(),
      branchId: m.auditoriumId ? branchByAuditorium.get(m.auditoriumId.toString()) : undefined,
      auditoriumId: m.auditoriumId?.toString(),
      layoutId: m.layoutId?.toString(),
      seatCode: m.seatCode ?? undefined,
    })),
  ];

  const genreName = new Map(genres.map((g) => [g.id, g.name]));
  const topGenres: NamedCount[] = topGenreIds
    .filter((id) => genreName.has(id))
    .map((id) => ({ id, name: genreName.get(id)!, count: genreCounts.get(id) ?? 0 }));

  const frequentBranches = rankFrequentBranches(sessions).slice(0, 5);
  const brandById = new Map(allBrands.map((b) => [b.id, b.name]));
  const branchLabelById = new Map(
    allBranches.map((b) => [b.id, [brandById.get(b.brandId), b.name].filter(Boolean).join(" · ")]),
  );
  const topBranches: NamedCount[] = frequentBranches.map((b) => ({ id: b.branchId, name: branchLabelById.get(b.branchId) ?? "?", count: b.count }));

  const companions = companionPeople
    .map((p) => ({ id: p._id.toString(), name: p.name, avatar: p.avatar ?? undefined, count: companionCounts.get(p._id.toString()) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const [totalAgg] = totalAggResult;
  const viewingCount = sessions.length;
  const averageCostPerViewing = viewingCount > 0 ? Math.round((totalAgg?.total ?? 0) / viewingCount) : 0;

  return {
    period,
    spending,
    budget,
    viewingCount,
    averageCostPerViewing,
    topGenres,
    topBranches,
    companions,
  };
}
