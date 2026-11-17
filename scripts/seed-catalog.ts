/**
 * Fills the Catalog with SAMPLE master data so the app can be tried right away: brands, genres, formats, age ratings,
 * seat types, fixed-date holidays, one sample branch per brand, sample food and ticket prices.
 * Everything that is invented (branches, addresses, prices) says "(mẫu)" in its name or note: edit or delete it in
 * Admin > Danh mục before real use. Safe to run repeatedly: a record that already exists (by name) is left untouched.
 * Refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1.
 *
 * Usage: npm run seed:catalog   (reads .env.local if present)
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { AgeRating } from "@/models/age-rating";
import { Branch } from "@/models/branch";
import { Brand } from "@/models/brand";
import { FnbCombo } from "@/models/fnb-combo";
import { FnbItem } from "@/models/fnb-item";
import { Format } from "@/models/format";
import { Genre } from "@/models/genre";
import { Holiday } from "@/models/holiday";
import { PriceRule } from "@/models/price-rule";
import { SeatType } from "@/models/seat-type";

const ENV_FILE = ".env.local";
const SAMPLE = "(mẫu)";

const BRANDS = [
  { name: "CGV", color: "#e71a0f", websiteUrl: "https://www.cgv.vn" },
  { name: "BHD Star", color: "#f5a300", websiteUrl: "https://bhdstar.vn" },
  { name: "Beta Cinemas", color: "#1d6fd1", websiteUrl: "https://betacinemas.vn" },
  { name: "Lotte Cinema", color: "#d3122f", websiteUrl: "https://lottecinemavn.com" },
  { name: "Galaxy Cinema", color: "#ff7a00", websiteUrl: "https://www.galaxycine.vn" },
];

const GENRES = [
  ["Hành động", "Action"], ["Hài", "Comedy"], ["Tình cảm", "Romance"], ["Kinh dị", "Horror"], ["Hoạt hình", "Animation"],
  ["Khoa học viễn tưởng", "Sci-fi"], ["Phiêu lưu", "Adventure"], ["Tâm lý", "Drama"], ["Hình sự", "Crime"], ["Gia đình", "Family"],
] as const;

const FORMATS = ["2D", "3D", "IMAX", "4DX", "ScreenX"];

const AGE_RATINGS = [
  { code: "P", description: "Mọi lứa tuổi", descriptionEn: "All ages", minAge: 0 },
  { code: "K", description: "Dưới 13 tuổi cần có người giám hộ", descriptionEn: "Under 13 with a guardian", minAge: 0 },
  { code: "T13", description: "Từ 13 tuổi trở lên", descriptionEn: "13 and over", minAge: 13 },
  { code: "T16", description: "Từ 16 tuổi trở lên", descriptionEn: "16 and over", minAge: 16 },
  { code: "T18", description: "Từ 18 tuổi trở lên", descriptionEn: "18 and over", minAge: 18 },
];

const SEAT_TYPES = [
  { name: "Thường", nameEn: "Standard", capacity: 1, color: "#5b6b8c" },
  { name: "VIP", nameEn: "VIP", capacity: 1, color: "#d9a441" },
  { name: "Ghế đôi", nameEn: "Couple seat", capacity: 2, color: "#c61583" },
  { name: "Giường nằm", nameEn: "Recliner bed", capacity: 1, color: "#3a9d8f" },
];

// Fixed-date holidays only; lunar ones (Tết, Hùng Vương) move every year, so the admin adds them.
const HOLIDAYS = [
  { date: "2026-01-01", name: "Tết Dương lịch", nameEn: "New Year's Day" },
  { date: "2026-04-30", name: "Ngày Giải phóng miền Nam", nameEn: "Reunification Day" },
  { date: "2026-05-01", name: "Quốc tế Lao động", nameEn: "Labour Day" },
  { date: "2026-09-02", name: "Quốc khánh", nameEn: "National Day" },
];

async function insertIfMissing<T>(label: string, model: { exists(filter: Record<string, unknown>): PromiseLike<unknown>; create(doc: T): PromiseLike<unknown> }, filter: Record<string, unknown>, doc: T, counter: Record<string, number>) {
  if (await model.exists(filter)) return;
  await model.create(doc);
  counter[label] = (counter[label] ?? 0) + 1;
}

async function seedCatalog(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error("Từ chối chạy seed ở production. Nếu thật sự muốn, đặt SEED_ALLOW_PRODUCTION=1.");
  }

  await connectToDatabase();
  const models = [Brand, Branch, Genre, Format, AgeRating, SeatType, Holiday, FnbItem, FnbCombo, PriceRule];
  await Promise.all(models.map((model) => model.init()));

  const added: Record<string, number> = {};
  const collation = { locale: "vi", strength: 1 } as const;
  const byName = (name: string) => ({ name });

  for (const brand of BRANDS) {
    if (!(await Brand.exists(byName(brand.name)).collation(collation))) {
      await Brand.create(brand);
      added.brands = (added.brands ?? 0) + 1;
    }
  }
  for (const [name, nameEn] of GENRES) {
    if (!(await Genre.exists(byName(name)).collation(collation))) {
      await Genre.create({ name, nameEn });
      added.genres = (added.genres ?? 0) + 1;
    }
  }
  for (const name of FORMATS) {
    if (!(await Format.exists(byName(name)).collation(collation))) {
      await Format.create({ name });
      added.formats = (added.formats ?? 0) + 1;
    }
  }
  for (const rating of AGE_RATINGS) {
    if (!(await AgeRating.exists({ code: rating.code }).collation(collation))) {
      await AgeRating.create(rating);
      added.ageRatings = (added.ageRatings ?? 0) + 1;
    }
  }
  for (const type of SEAT_TYPES) {
    if (!(await SeatType.exists(byName(type.name)).collation(collation))) {
      await SeatType.create(type);
      added.seatTypes = (added.seatTypes ?? 0) + 1;
    }
  }
  for (const holiday of HOLIDAYS) await insertIfMissing("holidays", Holiday, { date: holiday.date }, holiday, added);

  const standard = await SeatType.findOne(byName("Thường")).collation(collation).lean();
  const twoD = await Format.findOne(byName("2D")).collation(collation).lean();

  for (const brandDoc of await Brand.find({ name: { $in: BRANDS.map((brand) => brand.name) } }).lean()) {
    const brandId = brandDoc._id;
    const branchName = `${brandDoc.name} ${SAMPLE}`;
    if (!(await Branch.exists({ brandId, name: branchName }).collation(collation))) {
      await Branch.create({
        brandId,
        name: branchName,
        address: `Địa chỉ ${SAMPLE}`,
        openingHours: "09:00 – 23:00",
        parkingFee: 5000,
        parkingLocation: `Hầm gửi xe ${SAMPLE}`,
      });
      added.branches = (added.branches ?? 0) + 1;
    }

    const itemName = `Bắp ngọt ${SAMPLE}`;
    if (!(await FnbItem.exists({ brandId, name: itemName, size: "Lớn" }).collation(collation))) {
      await FnbItem.create({ brandId, name: itemName, nameEn: `Sweet popcorn ${SAMPLE}`, size: "Lớn", price: 59000 });
      added.fnbItems = (added.fnbItems ?? 0) + 1;
    }
    const comboName = `Combo 1 ${SAMPLE}`;
    if (!(await FnbCombo.exists({ brandId, name: comboName }).collation(collation))) {
      await FnbCombo.create({ brandId, name: comboName, description: "1 bắp lớn + 1 nước", price: 89000 });
      added.fnbCombos = (added.fnbCombos ?? 0) + 1;
    }

    // Sample ticket prices, one set per brand: normal, weekend, holiday and a Wednesday promotion (2D, standard seat).
    const rules = [
      { note: `Ngày thường ${SAMPLE}`, dayType: "normal", price: 80000 },
      { note: `Cuối tuần ${SAMPLE}`, dayType: "weekend", price: 100000 },
      { note: `Ngày lễ ${SAMPLE}`, dayType: "holiday", price: 120000 },
      { note: `Thứ tư ưu đãi ${SAMPLE}`, dayType: "promo", weekday: 3, price: 60000 },
    ] as const;
    for (const rule of rules) {
      if (await PriceRule.exists({ brandId, note: rule.note })) continue;
      await PriceRule.create({ brandId, formatId: twoD?._id, seatTypeId: standard?._id, priority: 0, ...rule });
      added.priceRules = (added.priceRules ?? 0) + 1;
    }
  }

  const summary = Object.entries(added).map(([label, count]) => `${count} ${label}`);
  console.log(summary.length ? `Đã thêm: ${summary.join(", ")}.` : "Danh mục mẫu đã có đủ. Không có thay đổi.");
}

seedCatalog()
  .catch((error: unknown) => {
    console.error("Seed danh mục thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
