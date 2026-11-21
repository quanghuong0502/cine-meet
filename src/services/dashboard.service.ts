import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import type { Period } from "@/lib/dashboard/period";
import { Appointment } from "@/models/appointment";
import { Branch } from "@/models/branch";
import { Expense } from "@/models/expense";
import { Genre } from "@/models/genre";
import { Movie } from "@/models/movie";
import { User } from "@/models/user";
import { getBudgetProgress, type BudgetProgress } from "@/services/budget.service";
import { getSpendingTimeline, type SpendingBucket } from "@/services/expense.service";
import { listViewingSessions, rankFrequentBranches } from "@/services/viewing-history.service";

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
  const [spending, budget, completed, sessions] = await Promise.all([
    getSpendingTimeline(userId, period, now),
    getBudgetProgress(userId, now),
    Appointment.find(
      { status: "COMPLETED", $or: [{ creatorId: userId }, { "participants.userId": userId, "participants.status": "accepted" }] },
      "movieId participants creatorId",
    ).lean(),
    listViewingSessions(userId),
  ]);

  // Genres of the movies this person has actually watched, most-watched genre first.
  const movieIds = [...new Set(completed.map((a) => a.movieId.toString()))];
  const movies = movieIds.length ? await Movie.find({ _id: { $in: movieIds } }, "genreIds").lean() : [];
  const movieById = new Map(movies.map((m) => [m._id.toString(), m]));
  const genreCounts = new Map<string, number>();
  for (const a of completed) {
    for (const g of movieById.get(a.movieId.toString())?.genreIds ?? []) {
      genreCounts.set(g.toString(), (genreCounts.get(g.toString()) ?? 0) + 1);
    }
  }
  const genres = genreCounts.size ? await Genre.find({ _id: { $in: [...genreCounts.keys()] } }, "name").lean() : [];
  const topGenres = genres
    .map((g) => ({ id: g._id.toString(), name: g.name, count: genreCounts.get(g._id.toString()) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Branches this person has actually been to, from the same source as "frequently visited" and sitting history.
  const frequentBranches = rankFrequentBranches(sessions).slice(0, 5);
  const branches = frequentBranches.length ? await Branch.find({ _id: { $in: frequentBranches.map((b) => b.branchId) } }, "name").lean() : [];
  const branchById = new Map(branches.map((b) => [b._id.toString(), b.name]));
  const topBranches: NamedCount[] = frequentBranches.map((b) => ({ id: b.branchId, name: branchById.get(b.branchId) ?? "?", count: b.count }));

  // Who this person has gone with most (the other side of every completed appointment they were part of).
  const companionCounts = new Map<string, number>();
  for (const a of completed) {
    const others = [a.creatorId.toString(), ...a.participants.filter((p) => p.status === "accepted").map((p) => p.userId.toString())].filter((id) => id !== userId);
    for (const id of new Set(others)) companionCounts.set(id, (companionCounts.get(id) ?? 0) + 1);
  }
  const companionPeople = companionCounts.size ? await User.find({ _id: { $in: [...companionCounts.keys()] } }, "name avatar").lean() : [];
  const companions = companionPeople
    .map((p) => ({ id: p._id.toString(), name: p.name, avatar: p.avatar ?? undefined, count: companionCounts.get(p._id.toString()) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const [totalAgg] = await Expense.aggregate<{ total: number }>([
    { $match: { userId: new Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
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
