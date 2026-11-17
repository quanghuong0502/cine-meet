/**
 * Fills the app with SAMPLE movies and a week of showtimes so the user screens can be tried right away.
 * Needs the Catalog sample data first (`npm run seed:catalog`: genres, formats, age ratings, rooms) and one admin account.
 * Every movie title ends with "(mẫu)"; delete or edit them in Admin > Phim. Safe to run again: movies that exist (by title) are kept,
 * and showtimes that would overlap an existing one in the same room are skipped.
 * Refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1.
 *
 * Usage: npm run seed:movies   (reads .env.local if present)
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { vietnamToday } from "@/lib/movie/status";
import { datesBetween } from "@/lib/showtime/time";
import { AgeRating } from "@/models/age-rating";
import { Auditorium } from "@/models/auditorium";
import { Format } from "@/models/format";
import { Genre } from "@/models/genre";
import { Movie } from "@/models/movie";
import { User } from "@/models/user";
import { createShowtimesBulk } from "@/services/showtime.service";

const ENV_FILE = ".env.local";

const SAMPLES = [
  { title: "Hành Trình Cuối Cùng (mẫu)", durationMin: 128, genres: ["Hành động"], rating: "T16", startOffset: -10, endOffset: 30, director: "Đạo diễn mẫu", cast: "Diễn viên A, Diễn viên B", synopsis: "Phim mẫu để thử giao diện." },
  { title: "Mùa Hè Của Chúng Ta (mẫu)", durationMin: 105, genres: ["Tình cảm", "Hài"], rating: "T13", startOffset: -3, endOffset: 25, director: "Đạo diễn mẫu", cast: "Diễn viên C, Diễn viên D", synopsis: "Phim mẫu để thử giao diện." },
  { title: "Bóng Tối Dưới Nhà (mẫu)", durationMin: 96, genres: ["Kinh dị"], rating: "T18", startOffset: -1, endOffset: 14, director: "Đạo diễn mẫu", cast: "Diễn viên E", synopsis: "Phim mẫu để thử giao diện." },
  { title: "Vũ Trụ Nhỏ (mẫu)", durationMin: 92, genres: ["Hoạt hình"], rating: "P", startOffset: 12, endOffset: 50, director: "Đạo diễn mẫu", cast: "", synopsis: "Phim sắp chiếu mẫu." },
];

function shiftDays(days: number): string {
  return new Date(Date.parse(`${vietnamToday()}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

async function seed(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error("Từ chối chạy ở production. Nếu thật sự muốn, đặt SEED_ALLOW_PRODUCTION=1.");
  }
  await connectToDatabase();

  const admin = await User.findOne({ role: "admin" }).lean();
  if (!admin) throw new Error("Chưa có tài khoản admin. Chạy `npm run seed` trước.");
  const [genres, formats, ratings, rooms] = await Promise.all([Genre.find({}).lean(), Format.find({}).lean(), AgeRating.find({}).lean(), Auditorium.find({ currentLayoutId: { $exists: true } }).lean()]);
  if (formats.length === 0 || rooms.length === 0) throw new Error("Chưa có định dạng hoặc phòng chiếu. Chạy `npm run seed:catalog` trước.");

  const movieIds: string[] = [];
  for (const sample of SAMPLES) {
    const existing = await Movie.findOne({ title: sample.title }).lean();
    if (existing) {
      movieIds.push(existing._id.toString());
      continue;
    }
    const created = await Movie.create({
      title: sample.title,
      durationMin: sample.durationMin,
      genreIds: genres.filter((g) => sample.genres.includes(g.name)).map((g) => g._id),
      ageRatingId: ratings.find((r) => r.code === sample.rating)?._id,
      formatIds: formats.slice(0, 2).map((f) => f._id),
      director: sample.director,
      cast: sample.cast || undefined,
      synopsis: sample.synopsis,
      language: "Phụ đề tiếng Việt",
      releaseDate: shiftDays(sample.startOffset),
      endDate: shiftDays(sample.endOffset),
    });
    movieIds.push(created._id.toString());
    console.log(`Đã thêm phim: ${sample.title}`);
  }

  // The three movies already out get showtimes for a week, spread over the rooms.
  const today = vietnamToday();
  const dates = datesBetween(today, shiftDays(6));
  const times = [["10:00", "15:30"], ["12:45", "18:15"], ["20:30", "22:45"]];
  let created = 0;
  let skipped = 0;
  for (const [index, movieId] of movieIds.slice(0, 3).entries()) {
    const result = await createShowtimesBulk(
      { movieId, formatId: formats[0]._id.toString(), auditoriumIds: rooms.map((r) => r._id.toString()), dates, times: times[index] },
      admin._id.toString(),
    );
    if (result.ok) {
      created += result.data.created;
      skipped += result.data.skipped;
    } else console.warn(`Không tạo được suất cho phim ${index + 1}: ${result.error}`);
  }
  console.log(`Suất chiếu: tạo ${created}, bỏ qua ${skipped} (trùng giờ).`);
}

seed()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
