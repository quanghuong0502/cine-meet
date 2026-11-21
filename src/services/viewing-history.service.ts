import { connectToDatabase } from "@/lib/db";
import { Appointment } from "@/models/appointment";
import { Auditorium } from "@/models/auditorium";
import { ManualViewing } from "@/models/manual-viewing";
import { Showtime } from "@/models/showtime";

/**
 * One viewing a person has actually completed: either a planned appointment that reached COMPLETED, or one they logged by
 * hand (design 3.4 "Bổ sung", 3.2 "Thường tới"/lịch sử ngồi). The single source both the "frequently visited" branch list and
 * the sitting history are built from, so a viewing is never counted in one place but not the other.
 */
export interface ViewingSession {
  at: Date;
  movieId?: string;
  branchId?: string;
  auditoriumId?: string;
  layoutId?: string;
  seatCode?: string;
}

/** Every viewing this person has completed, newest first. Does not include plans still in progress or cancelled ones. */
export async function listViewingSessions(userId: string): Promise<ViewingSession[]> {
  await connectToDatabase();
  const [appointments, manual] = await Promise.all([
    Appointment.find(
      { status: "COMPLETED", $or: [{ creatorId: userId }, { "participants.userId": userId, "participants.status": "accepted" }] },
      "movieId showtimeId seats completedAt",
    ).lean(),
    ManualViewing.find({ userId }).lean(),
  ]);

  const showtimeIds = appointments.flatMap((a) => (a.showtimeId ? [a.showtimeId] : []));
  const showtimes = showtimeIds.length ? await Showtime.find({ _id: { $in: showtimeIds } }, "auditoriumId layoutId").lean() : [];
  const showtimeById = new Map(showtimes.map((s) => [s._id.toString(), s]));
  const auditoriumIds = [
    ...new Set([...showtimes.map((s) => s.auditoriumId.toString()), ...manual.flatMap((m) => (m.auditoriumId ? [m.auditoriumId.toString()] : []))]),
  ];
  const auditoriums = auditoriumIds.length ? await Auditorium.find({ _id: { $in: auditoriumIds } }, "branchId").lean() : [];
  const branchByAuditorium = new Map(auditoriums.map((a) => [a._id.toString(), a.branchId.toString()]));

  const fromAppointments: ViewingSession[] = appointments.flatMap((a): ViewingSession[] => {
    const showtime = a.showtimeId ? showtimeById.get(a.showtimeId.toString()) : undefined;
    if (!showtime) return [];
    const auditoriumId = showtime.auditoriumId.toString();
    const seatCode = a.seats?.find((s) => s.userId.toString() === userId)?.seatCode;
    return [
      {
        at: a.completedAt ?? new Date(0),
        movieId: a.movieId.toString(),
        branchId: branchByAuditorium.get(auditoriumId),
        auditoriumId,
        layoutId: showtime.layoutId.toString(),
        seatCode,
      },
    ];
  });

  const fromManual: ViewingSession[] = manual.map((m) => ({
    at: new Date(`${m.date}T12:00:00+07:00`),
    movieId: m.movieId?.toString(),
    branchId: m.auditoriumId ? branchByAuditorium.get(m.auditoriumId.toString()) : undefined,
    auditoriumId: m.auditoriumId?.toString(),
    layoutId: m.layoutId?.toString(),
    seatCode: m.seatCode ?? undefined,
  }));

  return [...fromAppointments, ...fromManual].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export interface FrequentBranch {
  branchId: string;
  count: number;
  lastAt: Date;
}

/** Branches ranked by how many completed viewings happened there: most viewings first, ties broken by the most recent one. Pure given the sessions. */
export function rankFrequentBranches(sessions: readonly ViewingSession[]): FrequentBranch[] {
  const byBranch = new Map<string, FrequentBranch>();
  for (const s of sessions) {
    if (!s.branchId) continue;
    const row = byBranch.get(s.branchId) ?? { branchId: s.branchId, count: 0, lastAt: new Date(0) };
    row.count++;
    if (s.at.getTime() > row.lastAt.getTime()) row.lastAt = s.at;
    byBranch.set(s.branchId, row);
  }
  return [...byBranch.values()].sort((a, b) => b.count - a.count || b.lastAt.getTime() - a.lastAt.getTime());
}

export interface SittingHistoryRow {
  seatCode: string;
  count: number;
  /** The person's own latest star rating (1 to 5) of this seat, when they gave one. */
  rating?: number;
}

/** How many times this person has sat in each seat of one room, most-sat seat first, with their own rating of that seat when there is one. */
export function sittingHistoryOf(
  sessions: readonly ViewingSession[],
  auditoriumId: string,
  ratings: Readonly<Record<string, number>> = {},
): SittingHistoryRow[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (s.auditoriumId !== auditoriumId || !s.seatCode) continue;
    counts.set(s.seatCode, (counts.get(s.seatCode) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([seatCode, count]): SittingHistoryRow => ({ seatCode, count, ...(ratings[seatCode] ? { rating: ratings[seatCode] } : {}) }))
    .sort((a, b) => b.count - a.count);
}
