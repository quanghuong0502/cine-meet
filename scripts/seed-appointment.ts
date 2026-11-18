/**
 * Makes one appointment that is already locked (people chosen), so stage 2 (showtime, seats, food, confirm, costs) can be tried
 * straight away: the first regular account is the creator and the next two are going. It uses the soonest upcoming showtime, so
 * run `npm run seed:users` and add showtimes first. Refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1.
 *
 * Usage: npm run seed:appointment   (reads .env.local if present)
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Appointment } from "@/models/appointment";
import { Showtime } from "@/models/showtime";
import { User } from "@/models/user";

const ENV_FILE = ".env.local";

async function seedAppointment(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error("Từ chối chạy ở production. Nếu thật sự muốn, đặt SEED_ALLOW_PRODUCTION=1.");
  }
  await connectToDatabase();
  const users = await User.find({ role: "user", status: { $ne: "locked" } }, "_id name").sort({ createdAt: 1 }).limit(3).lean();
  if (users.length < 3) throw new Error("Cần ít nhất 3 tài khoản người dùng (chạy npm run seed:users).");
  const showtime = await Showtime.findOne({ startAt: { $gt: new Date() } }).sort({ startAt: 1 }).lean();
  if (!showtime) throw new Error("Chưa có suất chiếu nào chưa chiếu (chạy npm run seed:movies hoặc tạo suất ở Admin).");

  const [creator, ...others] = users;
  const doc = await Appointment.create({
    creatorId: creator!._id,
    movieId: showtime.movieId,
    status: "PARTICIPANTS_LOCKED",
    timeOptions: [{ startAt: showtime.startAt, showtimeId: showtime._id, proposedBy: creator!._id, votes: others.map((u) => ({ userId: u._id, vote: "yes" })) }],
    participants: others.map((u) => ({ userId: u._id, status: "accepted" })),
  });
  doc.chosenOptionId = doc.timeOptions[0]!._id;
  doc.lockedStartAt = showtime.startAt;
  doc.showtimeFromPoll = true;
  await doc.save();
  console.log(`Đã tạo lịch hẹn ${doc._id.toString()}: ${creator!.name} (người tạo) rủ ${others.map((u) => u.name).join(", ")}. Mở /appointments/${doc._id.toString()}.`);
}

seedAppointment()
  .catch((error: unknown) => {
    console.error("Seed thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
