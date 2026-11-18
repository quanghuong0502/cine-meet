/**
 * Fills the app with SAMPLE movies and a week of showtimes so the user screens can be tried right away.
 * Needs the Catalog sample data first (`npm run seed:catalog`: genres, formats, age ratings, rooms) and one admin account.
 * Every movie title ends with "(mẫu)"; delete or edit them in Admin > Phim. Safe to run again: movies that exist (by title) are kept,
 * and showtimes that would overlap an existing one in the same room are skipped.
 * Refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1.
 *
 * Usage: npm run seed:movies   (reads .env.local if present)
 *        npm run seed:movies -- --posters-only   (only gives the sample movies without a poster one: no showtimes are added)
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { cloudinaryConfig, createMoviePosterUploadTicket } from "@/lib/cloudinary";
import { vietnamToday } from "@/lib/movie/status";
import { datesBetween } from "@/lib/showtime/time";
import { AgeRating } from "@/models/age-rating";
import { Auditorium } from "@/models/auditorium";
import { Format } from "@/models/format";
import { Genre } from "@/models/genre";
import { Movie } from "@/models/movie";
import { User } from "@/models/user";
import { createShowtimesBulk } from "@/services/showtime.service";
import { makePoster, SAMPLE_POSTERS } from "./sample-posters";

const ENV_FILE = ".env.local";

const SAMPLES = [
  { title: "Hành Trình Cuối Cùng (mẫu)", durationMin: 128, genres: ["Hành động"], rating: "T16", startOffset: -10, endOffset: 30, director: "Trần Minh Khôi", cast: "Lê Hoàng Nam, Phạm Ngọc Anh, Võ Thanh Tùng", synopsis: "Một cựu đặc nhiệm nhận nhiệm vụ cuối cùng: đưa một nhân chứng băng qua thành phố trong một đêm, khi cả hai phía đều muốn bắt họ." },
  { title: "Mùa Hè Của Chúng Ta (mẫu)", durationMin: 105, genres: ["Tình cảm", "Hài"], rating: "T13", startOffset: -3, endOffset: 25, director: "Nguyễn Thu Hà", cast: "Đỗ Khánh Linh, Bùi Quang Huy", synopsis: "Hai người bạn thân thời cấp ba gặp lại trong một mùa hè ở biển, và phải thú nhận điều họ giấu nhau suốt mười năm." },
  { title: "Bóng Tối Dưới Nhà (mẫu)", durationMin: 96, genres: ["Kinh dị"], rating: "T18", startOffset: -1, endOffset: 14, director: "Phạm Đức Long", cast: "Hoàng Mai Chi, Ngô Văn Sơn", synopsis: "Cả gia đình chuyển vào căn nhà mới và nghe tiếng động mỗi đêm từ tầng hầm, nơi chủ nhà cũ dặn đừng bao giờ mở cửa." },
  { title: "Vũ Trụ Nhỏ (mẫu)", durationMin: 92, genres: ["Hoạt hình"], rating: "P", startOffset: 12, endOffset: 50, director: "Lý Bảo Châu", cast: "", synopsis: "Một chú robot nhỏ lạc trên con tàu vũ trụ bỏ hoang, đi tìm đường về nhà và kết bạn với những ngôi sao biết nói." },
];

/** What the first version of this seed wrote; a sample movie still holding it counts as not yet filled in. */
const OLD_MOVIE_TEXT = { director: "Đạo diễn mẫu", synopsis: ["Phim mẫu để thử giao diện.", "Phim sắp chiếu mẫu."] } as const;

/** Gives a sample movie made earlier its director, cast and story when they are empty or still the old placeholder; never an admin's own text. */
async function fillMissingDetails(): Promise<void> {
  const empty = (field: string) => [{ [field]: { $exists: false } }, { [field]: null }, { [field]: "" }];
  for (const sample of SAMPLES) {
    await Movie.updateOne({ title: sample.title, $or: [...empty("director"), { director: OLD_MOVIE_TEXT.director }] }, { director: sample.director });
    await Movie.updateOne({ title: sample.title, $or: [...empty("synopsis"), { synopsis: { $in: [...OLD_MOVIE_TEXT.synopsis] } }] }, { synopsis: sample.synopsis });
    if (sample.cast) await Movie.updateOne({ title: sample.title, $or: [...empty("cast"), { cast: /^Diễn viên [A-Z]/ }] }, { cast: sample.cast });
  }
}

/**
 * Gives every sample movie that has no poster one drawn poster (`sample-posters.ts`), uploaded to Cloudinary the way the admin form does
 * (a signed ticket from `createMoviePosterUploadTicket`). Movies that already have a poster are left alone; without Cloudinary
 * settings it only says so.
 */
async function addMissingPosters(): Promise<void> {
  const config = cloudinaryConfig();
  if (!config) {
    console.log("Chưa cấu hình Cloudinary: bỏ qua poster phim mẫu.");
    return;
  }
  const movies = await Movie.find({ title: /\(mẫu\)$/, $or: [{ posterUrl: { $exists: false } }, { posterUrl: null }, { posterUrl: "" }] }).lean();
  for (const movie of movies) {
    const spec = SAMPLE_POSTERS[movie.title.replace(/\s*\(mẫu\)$/, "")];
    if (!spec) continue;
    const ticket = createMoviePosterUploadTicket(config);
    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
    form.append("file", new Blob([new Uint8Array(await makePoster(spec))], { type: "image/jpeg" }), "poster.jpg");
    const response = await fetch(ticket.uploadUrl, { method: "POST", body: form });
    const body = (await response.json()) as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !body.secure_url) {
      console.warn(`Không tải được poster cho ${movie.title}: ${body.error?.message ?? response.status}`);
      continue;
    }
    await Movie.updateOne({ _id: movie._id }, { posterUrl: body.secure_url });
    console.log(`Đã thêm poster: ${movie.title}`);
  }
}

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

  await fillMissingDetails();
  await addMissingPosters();
  if (process.argv.includes("--posters-only")) return;

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
