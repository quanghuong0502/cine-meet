/**
 * Sample data for Sprint 6 (dashboard, budget, ratings, manual viewing, room report): a COMPLETED appointment with real
 * costs, a manually logged viewing, ratings, a room review, a monthly budget that is already past 80%, and one open room
 * report for the admin screen. Run after `npm run seed:users` and `npm run seed:movies`.
 * Refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1.
 *
 * Usage: npm run seed:sprint6   (reads .env.local if present)
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Appointment } from "@/models/appointment";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { AuditoriumReview } from "@/models/auditorium-review";
import { Expense } from "@/models/expense";
import { ManualViewing } from "@/models/manual-viewing";
import { vietnamToday } from "@/lib/movie/status";
import { Genre } from "@/models/genre";
import { Movie } from "@/models/movie";
import { MovieRating } from "@/models/movie-rating";
import { RoomReport } from "@/models/room-report";
import { SeatRating } from "@/models/seat-rating";
import { Showtime } from "@/models/showtime";
import { User } from "@/models/user";
import { checkBudgetWarnings } from "@/services/budget.service";
import { scheduleExpenseReminder } from "@/services/scheduled-notification.service";

const ENV_FILE = ".env.local";
const DAY_MS = 24 * 60 * 60 * 1000;

async function seedSprint6(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error("Từ chối chạy ở production. Nếu thật sự muốn, đặt SEED_ALLOW_PRODUCTION=1.");
  }
  await connectToDatabase();

  // Prefer the sample accounts (an, binh) so whoever seeds this can sign in with the known sample password; otherwise the
  // two earliest regular accounts.
  const sampleUsers = await User.find({ username: { $in: ["an", "binh"] } }, "_id name").lean();
  const fallbackUsers = sampleUsers.length < 2 ? await User.find({ role: "user", status: { $ne: "locked" } }, "_id name").sort({ createdAt: 1 }).limit(3).lean() : [];
  const users = sampleUsers.length >= 2 ? sampleUsers : fallbackUsers;
  if (users.length < 2) throw new Error("Cần ít nhất 2 tài khoản người dùng (chạy npm run seed:users).");
  const creator = users.find((u) => u.name.startsWith("An")) ?? users[0]!;
  const companion = users.find((u) => u._id.toString() !== creator._id.toString()) ?? users[1]!;

  const showtimes = await Showtime.find({}, "movieId auditoriumId layoutId").sort({ startAt: 1 }).limit(2).lean();
  if (showtimes.length === 0) throw new Error("Chưa có suất chiếu nào (chạy npm run seed:movies hoặc tạo suất ở Admin).");
  const [showtimeA, showtimeB] = [showtimes[0]!, showtimes[showtimes.length > 1 ? 1 : 0]!];

  const layout = await AuditoriumLayout.findById(showtimeA.layoutId, "seats").lean();
  const seatCodes = (layout?.seats ?? []).slice(0, 2).map((s) => s.code);
  const [seatA, seatB] = [seatCodes[0] ?? "A1", seatCodes[1] ?? "A2"];

  const now = new Date();
  const completedAt = new Date(now.getTime() - 2 * DAY_MS);

  // --- Clean up prior Sprint 6 data for creator and companion to guarantee idempotent baseline ---
  const oldAppts = await Appointment.find({ creatorId: creator!._id, status: "COMPLETED" }).lean();
  for (const old of oldAppts) {
    await Expense.deleteMany({ appointmentId: old._id });
    await Appointment.deleteOne({ _id: old._id });
  }

  const oldManuals = await ManualViewing.find({ userId: creator!._id }).lean();
  for (const old of oldManuals) {
    await Expense.deleteMany({ manualViewingId: old._id });
    await ManualViewing.deleteOne({ _id: old._id });
  }

  // Ensure Chi is clean as a fresh account (as expected by Step 1.6 / 6.1)
  const chi = await User.findOne({ username: "chi" }, "_id").lean();
  if (chi) {
    const chiAppts = await Appointment.find({ creatorId: chi._id }).lean();
    for (const ca of chiAppts) {
      await Expense.deleteMany({ appointmentId: ca._id });
      await Appointment.deleteOne({ _id: ca._id });
    }
    const chiManuals = await ManualViewing.find({ userId: chi._id }).lean();
    for (const cm of chiManuals) {
      await Expense.deleteMany({ manualViewingId: cm._id });
      await ManualViewing.deleteOne({ _id: cm._id });
    }
  }

  const estimate = [
    { userId: creator!._id, ticket: 110_000, fnb: 40_000, other: 0 },
    { userId: companion!._id, ticket: 110_000, fnb: 0, other: 0 },
  ];
  const appointment = await Appointment.create({
    creatorId: creator!._id,
    movieId: showtimeA.movieId,
    status: "COMPLETED",
    timeOptions: [{ startAt: completedAt, showtimeId: showtimeA._id, proposedBy: creator!._id, votes: [{ userId: companion!._id, vote: "yes" }] }],
    participants: [{ userId: companion!._id, status: "accepted" }],
    showtimeId: showtimeA._id,
    seats: [{ userId: creator!._id, seatCode: seatA }, { userId: companion!._id, seatCode: seatB }],
    estimate,
    completedAt,
    actualCost: { ticket: 220_000, fnb: 40_000, other: 0, total: 260_000 },
  });
  appointment.chosenOptionId = appointment.timeOptions[0]!._id;
  appointment.lockedStartAt = completedAt;
  appointment.showtimeFromPoll = true;
  await appointment.save();
  await scheduleExpenseReminder(appointment._id.toString(), new Date(completedAt.getTime() + 2 * 60 * 60 * 1000));

  await Expense.deleteMany({ appointmentId: appointment._id });
  await Expense.insertMany([
    { userId: creator!._id, appointmentId: appointment._id, category: "ticket", amount: 110_000, date: completedAt },
    { userId: creator!._id, appointmentId: appointment._id, category: "fnb", amount: 40_000, date: completedAt },
    { userId: companion!._id, appointmentId: appointment._id, category: "ticket", amount: 110_000, date: completedAt },
  ]);

  // --- A viewing logged by hand: same person, a different movie, no room noted. ---
  const otherMovie = await Movie.findOne({ _id: { $ne: showtimeA.movieId } }, "_id").lean();
  const manual = await ManualViewing.create({
    userId: creator!._id,
    movieId: otherMovie?._id ?? showtimeB.movieId,
    date: completedAt.toISOString().slice(0, 10),
    note: "Gieo bởi seed-sprint6",
  });
  await Expense.deleteMany({ manualViewingId: manual._id });
  await Expense.insertMany([
    { userId: creator!._id, manualViewingId: manual._id, category: "ticket", amount: 100_000, date: completedAt },
    { userId: creator!._id, manualViewingId: manual._id, category: "fnb", amount: 20_000, date: completedAt },
  ]);

  // --- Ratings and a room review for the creator. ---
  await MovieRating.updateOne({ userId: creator!._id, movieId: showtimeA.movieId }, { $set: { rating: 5, comment: "Hay nè!" } }, { upsert: true });
  await SeatRating.updateOne(
    { userId: creator!._id, appointmentId: appointment._id, seatCode: seatA },
    { $set: { auditoriumId: showtimeA.auditoriumId, layoutId: showtimeA.layoutId, rating: 4 } },
    { upsert: true },
  );
  await AuditoriumReview.updateOne(
    { userId: creator!._id, auditoriumId: showtimeA.auditoriumId },
    { $set: { sound: 5, ac: 4, cleanliness: 4, comment: "Phòng ổn, hơi lạnh." } },
    { upsert: true },
  );

  // --- A monthly budget already past 80% of ticket spending (the appointment + the manual log together). ---
  await User.updateOne({ _id: creator!._id }, { $set: { monthlyBudget: { ticket: 250_000, fnb: 100_000 } } });
  await checkBudgetWarnings([creator!._id.toString()]);

  // --- Ensure an upcoming movie matches creator's top genre so SuggestionsCard appears ---
  const actionGenre = await Genre.findOne({ name: "Hành động" }).lean();
  if (actionGenre) {
    const upcomingMovie = await Movie.findOne({ releaseDate: { $gt: vietnamToday() } });
    if (upcomingMovie && !upcomingMovie.genreIds.some((g) => g.toString() === actionGenre._id.toString())) {
      upcomingMovie.genreIds.push(actionGenre._id);
      await upcomingMovie.save();
    }
  }

  // --- One open report for the admin screen. ---
  await RoomReport.deleteMany({ note: /^Gieo bởi seed-sprint6/ });
  await RoomReport.create({ userId: creator!._id, auditoriumId: showtimeA.auditoriumId, note: "Gieo bởi seed-sprint6: ghế A1 hình như bị lệch trên sơ đồ." });

  console.log(
    `Đã gieo dữ liệu Sprint 6: lịch hẹn ${appointment._id.toString()} (COMPLETED), 1 buổi ghi tay, đánh giá phim/ghế/phòng, ngân sách của ${creator!.name} (${creator!._id.toString()}) đã qua 80%, 1 báo cáo phòng đang chờ.`,
  );
}

seedSprint6()
  .catch((error: unknown) => {
    console.error("Seed thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
