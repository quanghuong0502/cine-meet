/**
 * Fills the Catalog with SAMPLE master data so the app can be tried right away: brands, genres, formats, age ratings,
 * seat types, fixed-date holidays, one sample branch per brand, sample food and ticket prices, and sample auditoriums.
 * Everything that is invented (branches, addresses, prices) says "(mẫu)" in its name or note: edit or delete it in
 * Admin > Danh mục before real use. Safe to run repeatedly: a record that already exists (by name) is left untouched.
 * Refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1.
 *
 * Usage: npm run seed:catalog   (reads .env.local if present)
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { cloudinaryConfig, createBranchImageUploadTicket, createBrandLogoUploadTicket, type UploadTicket } from "@/lib/cloudinary";
import { connectToDatabase } from "@/lib/db";
import { defaultRatingColor } from "@/lib/age-rating-color";
import { AgeRating } from "@/models/age-rating";
import { Branch } from "@/models/branch";
import { Brand } from "@/models/brand";
import { FnbCombo } from "@/models/fnb-combo";
import { FnbItem } from "@/models/fnb-item";
import { Format } from "@/models/format";
import { Genre } from "@/models/genre";
import { Holiday } from "@/models/holiday";
import { PriceRule } from "@/models/price-rule";
import { Auditorium } from "@/models/auditorium";
import { SeatType } from "@/models/seat-type";
import { User } from "@/models/user";
import { defaultLayoutConfig } from "@/lib/seat-layout/config";
import { createAuditorium } from "@/services/auditorium.service";
import type { LayoutConfig } from "@/lib/seat-layout/types";

/** Sample rooms (layout configs) for the sample branch of the first brands. */
function sampleRooms(types: { standard: string; vip: string; couple: string }): { brand: string; name: string; config: LayoutConfig }[] {
  const base = defaultLayoutConfig(types.standard);
  return [
    {
      brand: "CGV",
      name: "Phòng 1",
      config: {
        ...base,
        rows: 10,
        cols: 16,
        screen: { positionPct: 55, widthPct: 85, distance: "medium" },
        stadiumFromRow: 3,
        aisles: { verticalAfterCols: [3, 13], horizontalAfterRows: [4] },
        entrances: [{ side: "right", position: "back" }],
        overrides: [
          { row: "A", cols: [1], type: "none" },
          { row: "E", cols: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13], type: types.vip },
          { row: "F", cols: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13], type: types.vip },
          { row: "G", cols: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13], type: types.vip },
          { row: "J", cols: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13], type: types.couple },
          { row: "C", cols: [8], flags: ["broken"] },
        ],
      },
    },
    {
      brand: "CGV",
      name: "Phòng 2",
      config: {
        ...base,
        rows: 6,
        cols: 10,
        stadiumFromRow: 2,
        aisles: { verticalAfterCols: [5], horizontalAfterRows: [] },
        entrances: [{ side: "left", position: "back" }],
        overrides: [{ row: "F", cols: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], type: types.couple }],
      },
    },
    {
      brand: "BHD Star",
      name: "Phòng 1",
      config: {
        ...base,
        rows: 8,
        cols: 12,
        screen: { positionPct: 40, widthPct: 70, distance: "far" },
        stadiumFromRow: 3,
        aisles: { verticalAfterCols: [4, 8], horizontalAfterRows: [3] },
        colNumbering: "right_to_left",
        entrances: [{ side: "center", position: "back" }],
        overrides: [{ row: "H", cols: [1, 2, 3, 4], type: types.couple }],
      },
    },
  ];
}

import { makeBranchImage, makeBrandLogo } from "./sample-images";

const ENV_FILE = ".env.local";
const SAMPLE = "(mẫu)";
/** Google Maps link shared by every sample branch (they are all invented, so one place stands in for all). */
const SAMPLE_MAPS_URL = "https://maps.app.goo.gl/8jhMmuEFsHhUF8Bg7";

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

// Sample food and drinks (the same set for every brand). A combo names its items as "name|size".
const SAMPLE_ITEMS = [
  { name: "Bắp ngọt", nameEn: "Sweet popcorn", size: "Vừa", price: 49000 },
  { name: "Bắp ngọt", nameEn: "Sweet popcorn", size: "Lớn", price: 59000 },
  { name: "Bắp phô mai", nameEn: "Cheese popcorn", size: "Lớn", price: 69000 },
  { name: "Bắp caramel", nameEn: "Caramel popcorn", size: "Lớn", price: 69000 },
  { name: "Nước ngọt", nameEn: "Soft drink", size: "Vừa", price: 35000 },
  { name: "Nước ngọt", nameEn: "Soft drink", size: "Lớn", price: 45000 },
  { name: "Trà đào", nameEn: "Peach tea", size: "Vừa", price: 45000 },
  { name: "Nước suối", nameEn: "Bottled water", size: undefined, price: 25000 },
  { name: "Xúc xích nướng", nameEn: "Grilled sausage", size: undefined, price: 39000 },
] as const;

const SAMPLE_COMBOS = [
  { name: "Combo 1", items: [["Bắp ngọt|Lớn", 1], ["Nước ngọt|Vừa", 2]], discountType: "percent", discountValue: 10 },
  { name: "Combo đôi", items: [["Bắp phô mai|Lớn", 1], ["Nước ngọt|Lớn", 2]], discountType: "amount", discountValue: 20000 },
  { name: "Combo gia đình", items: [["Bắp ngọt|Lớn", 2], ["Nước ngọt|Vừa", 4], ["Xúc xích nướng|", 2]], discountType: "percent", discountValue: 15 },
] as const;

async function insertIfMissing<T>(label: string, model: { exists(filter: Record<string, unknown>): PromiseLike<unknown>; create(doc: T): PromiseLike<unknown> }, filter: Record<string, unknown>, doc: T, counter: Record<string, number>) {
  if (await model.exists(filter)) return;
  await model.create(doc);
  counter[label] = (counter[label] ?? 0) + 1;
}

/** Sends one picture to Cloudinary the way the admin form does (a signed ticket), and returns its address; null when it fails. */
async function uploadImage(ticket: UploadTicket, file: Buffer, type: string, filename: string): Promise<string | null> {
  const form = new FormData();
  for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
  form.append("file", new Blob([new Uint8Array(file)], { type }), filename);
  const response = await fetch(ticket.uploadUrl, { method: "POST", body: form });
  const body = (await response.json()) as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !body.secure_url) {
    console.warn(`Không tải được ${filename}: ${body.error?.message ?? response.status}`);
    return null;
  }
  return body.secure_url;
}

/**
 * Gives every sample brand without a logo, and every sample branch without a photo, one drawn picture (`sample-images.ts`).
 * Ones that already have a picture are left alone; without Cloudinary settings it only says so.
 */
async function addMissingImages(): Promise<void> {
  const config = cloudinaryConfig();
  if (!config) {
    console.log("Chưa cấu hình Cloudinary: bỏ qua logo và ảnh chi nhánh mẫu.");
    return;
  }
  const noImage = (field: string) => ({ $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: "" }] });
  for (const sample of BRANDS) {
    const brandDoc = await Brand.findOne({ name: sample.name, ...noImage("logoUrl") }).collation({ locale: "vi", strength: 1 }).lean();
    if (!brandDoc) continue;
    const url = await uploadImage(createBrandLogoUploadTicket(config), await makeBrandLogo(sample.name, sample.color), "image/png", "logo.png");
    if (!url) continue;
    await Brand.updateOne({ _id: brandDoc._id }, { logoUrl: url });
    console.log(`Đã thêm logo: ${sample.name}`);
  }
  for (const sample of BRANDS) {
    const brandDoc = await Brand.findOne({ name: sample.name }).collation({ locale: "vi", strength: 1 }).lean();
    if (!brandDoc) continue;
    const branch = await Branch.findOne({ brandId: brandDoc._id, name: `${brandDoc.name} ${SAMPLE}`, ...noImage("imageUrl") }).lean();
    if (!branch) continue;
    const url = await uploadImage(createBranchImageUploadTicket(config), await makeBranchImage(sample.name, sample.color), "image/jpeg", "branch.jpg");
    if (!url) continue;
    await Branch.updateOne({ _id: branch._id }, { imageUrl: url });
    console.log(`Đã thêm ảnh chi nhánh: ${branch.name}`);
  }
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
      await AgeRating.create({ ...rating, color: defaultRatingColor(rating.code, rating.minAge) });
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
        mapsUrl: SAMPLE_MAPS_URL,
        openingHours: "09:00 – 23:00",
        parkingFee: 5000,
        parkingLocation: `Hầm gửi xe ${SAMPLE}`,
      });
      added.branches = (added.branches ?? 0) + 1;
    } else {
      // A sample branch made before the link existed gets it too; one with its own link is left alone.
      await Branch.updateOne({ brandId, name: branchName, $or: [{ mapsUrl: { $exists: false } }, { mapsUrl: null }, { mapsUrl: "" }] }, { mapsUrl: SAMPLE_MAPS_URL }).collation(collation);
    }

    // Several items per brand, so a combo has something to pick from.
    const itemIds = new Map<string, mongoose.Types.ObjectId>();
    for (const sample of SAMPLE_ITEMS) {
      const name = `${sample.name} ${SAMPLE}`;
      const filter = { brandId, name, ...(sample.size ? { size: sample.size } : {}) };
      let item = await FnbItem.findOne(filter).collation(collation).lean();
      if (!item) {
        item = (await FnbItem.create({ brandId, name, nameEn: `${sample.nameEn} ${SAMPLE}`, size: sample.size, price: sample.price })).toObject();
        added.fnbItems = (added.fnbItems ?? 0) + 1;
      }
      itemIds.set(`${sample.name}|${sample.size ?? ""}`, item._id);
    }

    // A combo = items with a quantity each, minus a discount (in dong or percent).
    for (const sample of SAMPLE_COMBOS) {
      const name = `${sample.name} ${SAMPLE}`;
      const items = sample.items.flatMap(([key, quantity]) => {
        const itemId = itemIds.get(key);
        return itemId ? [{ itemId, quantity }] : [];
      });
      const existing = await FnbCombo.findOne({ brandId, name }).collation(collation).lean();
      if (existing) {
        // A sample combo made before combos had items (free text and a typed price): give it items, leave the rest.
        if (existing.items?.length) continue;
        await FnbCombo.updateOne(
          { _id: existing._id },
          { $set: { items, discountType: sample.discountType, discountValue: sample.discountValue }, $unset: { description: 1, price: 1 } },
        );
        added.fnbCombosUpdated = (added.fnbCombosUpdated ?? 0) + 1;
        continue;
      }
      await FnbCombo.create({ brandId, name, items, discountType: sample.discountType, discountValue: sample.discountValue });
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

  // Sample auditoriums (a room that exists by name in its branch is left alone).
  const vip = await SeatType.findOne(byName("VIP")).collation(collation).lean();
  const couple = await SeatType.findOne(byName("Ghế đôi")).collation(collation).lean();
  if (standard && vip && couple) {
    const admin = await User.findOne({ role: "admin" }).lean();
    const actorId = (admin?._id ?? new mongoose.Types.ObjectId()).toString();
    const rooms = sampleRooms({ standard: standard._id.toString(), vip: vip._id.toString(), couple: couple._id.toString() });
    for (const room of rooms) {
      const brandDoc = await Brand.findOne(byName(room.brand)).collation(collation).lean();
      const branch = brandDoc ? await Branch.findOne({ brandId: brandDoc._id, name: `${brandDoc.name} ${SAMPLE}` }).collation(collation).lean() : null;
      if (!branch) continue;
      const name = `${room.name} ${SAMPLE}`;
      if (await Auditorium.exists({ branchId: branch._id, name }).collation(collation)) continue;
      const result = await createAuditorium({ branchId: branch._id.toString(), name, config: room.config }, actorId);
      if (result.ok) added.auditoriums = (added.auditoriums ?? 0) + 1;
      else console.warn(`Không tạo được ${name} (${branch.name}): ${result.error}`);
    }
  }

  await addMissingImages();

  const summary = Object.entries(added).map(([label, count]) => `${count} ${label}`);
  console.log(summary.length ? `Đã thêm: ${summary.join(", ")}.` : "Danh mục mẫu đã có đủ. Không có thay đổi.");
}

seedCatalog()
  .catch((error: unknown) => {
    console.error("Seed danh mục thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
