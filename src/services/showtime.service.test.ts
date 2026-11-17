import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

type Svc = typeof import("./showtime.service");
let svc: Svc;
let models: {
  Movie: typeof import("@/models/movie").Movie;
  Showtime: typeof import("@/models/showtime").Showtime;
  Auditorium: typeof import("@/models/auditorium").Auditorium;
  Branch: typeof import("@/models/branch").Branch;
  Brand: typeof import("@/models/brand").Brand;
  Format: typeof import("@/models/format").Format;
  PriceRule: typeof import("@/models/price-rule").PriceRule;
  SystemSetting: typeof import("@/models/system-setting").SystemSetting;
};
const ACTOR = new Types.ObjectId().toString();
let movieId: string;
let formatId: string;
let roomId: string;
let layoutId: string;

beforeAll(async () => {
  await startTestDatabase();
  svc = await import("./showtime.service");
  models = {
    Movie: (await import("@/models/movie")).Movie,
    Showtime: (await import("@/models/showtime")).Showtime,
    Auditorium: (await import("@/models/auditorium")).Auditorium,
    Branch: (await import("@/models/branch")).Branch,
    Brand: (await import("@/models/brand")).Brand,
    Format: (await import("@/models/format")).Format,
    PriceRule: (await import("@/models/price-rule")).PriceRule,
    SystemSetting: (await import("@/models/system-setting")).SystemSetting,
  };
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase();
}, 120_000);
afterAll(stopTestDatabase);

beforeEach(async () => {
  await Promise.all(Object.values(models).map((m) => (m as { deleteMany(f: object): Promise<unknown> }).deleteMany({})));
  const brand = await models.Brand.create({ name: "CGV" });
  const branch = await models.Branch.create({ brandId: brand._id, name: "CGV Vincom" });
  layoutId = new Types.ObjectId().toString();
  roomId = (await models.Auditorium.create({ branchId: branch._id, name: "Phòng 1", currentLayoutId: layoutId }))._id.toString();
  formatId = (await models.Format.create({ name: "2D" }))._id.toString();
  movieId = (await models.Movie.create({ title: "Mai", durationMin: 120, releaseDate: "2026-11-01" }))._id.toString();
  await models.SystemSetting.create({ key: "adMinutes", value: 10 });
});

const bulk = (patch: Partial<import("./showtime.service").BulkShowtimeInput> = {}) => ({
  movieId, formatId, auditoriumIds: [roomId], dates: ["2026-12-01", "2026-12-02"], times: ["10:00", "19:30"], ...patch,
});

describe("bulk showtimes", () => {
  it("creates days x times, with the end = movie + ads, and the room's current layout", async () => {
    const result = await svc.createShowtimesBulk(bulk(), ACTOR);
    expect(result).toEqual({ ok: true, data: { created: 4, skipped: 0 } });
    const first = await models.Showtime.findOne({}).sort({ startAt: 1 }).lean();
    expect(first?.startAt.toISOString()).toBe("2026-12-01T03:00:00.000Z"); // 10:00 Vietnam
    expect(first?.endAt.toISOString()).toBe("2026-12-01T05:10:00.000Z"); // + 120 + 10
    expect(first?.layoutId.toString()).toBe(layoutId);
  });

  it("skips starts that overlap, and running the same form again creates nothing", async () => {
    await svc.createShowtimesBulk(bulk({ dates: ["2026-12-01"], times: ["10:00"] }), ACTOR);
    const again = await svc.createShowtimesBulk(bulk({ dates: ["2026-12-01"], times: ["10:00", "11:00", "13:00"] }), ACTOR);
    // 10:00 is taken, 11:00 starts before the 12:10 end, 13:00 fits.
    expect(again).toEqual({ ok: true, data: { created: 1, skipped: 2 } });
  });

  it("refuses unknown movie, room without layout and oversized batches", async () => {
    expect(await svc.createShowtimesBulk(bulk({ movieId: new Types.ObjectId().toString() }), ACTOR)).toEqual({ ok: false, error: "movie_not_found" });
    await models.Auditorium.updateOne({ _id: roomId }, { $unset: { currentLayoutId: 1 } });
    expect(await svc.createShowtimesBulk(bulk(), ACTOR)).toEqual({ ok: false, error: "no_layout" });
    await models.Auditorium.updateOne({ _id: roomId }, { currentLayoutId: layoutId });
    const dates = Array.from({ length: 30 }, (_, i) => `2027-01-${String(i + 1).padStart(2, "0")}`);
    const times = Array.from({ length: 20 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
    expect(await svc.createShowtimesBulk(bulk({ dates, times }), ACTOR)).toEqual({ ok: false, error: "too_many" });
  });
});

describe("CSV import", () => {
  const header = "movie,branch,auditorium,start,format,price\n";
  it("imports good rows and reports nothing created when a line is wrong", async () => {
    const bad = await svc.importShowtimesCsv(`${header}Mai,CGV Vincom,Phòng 1,2026-12-01 10:00,2D,\nMai,CGV Vincom,Phòng 9,2026-12-01 14:00,2D,`, ACTOR);
    expect(bad).toEqual({ ok: false, errors: [{ line: 3, code: "auditorium_not_found", value: "Phòng 9" }] });
    expect(await models.Showtime.countDocuments({})).toBe(0);

    const good = await svc.importShowtimesCsv(`${header}Mai,CGV Vincom,Phòng 1,2026-12-01 10:00,2D,95000\nMai,CGV Vincom,Phòng 1,2026-12-01 14:00,2D,`, ACTOR);
    expect(good).toEqual({ ok: true, data: { created: 2 } });
    expect((await models.Showtime.findOne({}).sort({ startAt: 1 }).lean())?.priceOverride).toBe(95000);
  });

  it("flags overlaps inside the file and against stored showtimes", async () => {
    const inFile = await svc.importShowtimesCsv(`${header}Mai,CGV Vincom,Phòng 1,2026-12-01 10:00,2D,\nMai,CGV Vincom,Phòng 1,2026-12-01 11:00,2D,`, ACTOR);
    expect(inFile).toEqual({ ok: false, errors: [{ line: 3, code: "overlap" }] });
    await svc.importShowtimesCsv(`${header}Mai,CGV Vincom,Phòng 1,2026-12-01 10:00,2D,`, ACTOR);
    const stored = await svc.importShowtimesCsv(`${header}Mai,CGV Vincom,Phòng 1,2026-12-01 10:30,2D,`, ACTOR);
    expect(stored).toEqual({ ok: false, errors: [{ line: 2, code: "overlap" }] });
  });
});

describe("searchShowtimes", () => {
  it("filters by day, slot and movie, and estimates the price from the rules", async () => {
    const branch = await models.Branch.findOne({});
    await models.PriceRule.create({ brandId: branch?.brandId, price: 80000 });
    await svc.createShowtimesBulk(bulk({ dates: ["2099-12-01"], times: ["10:00", "19:30"] }), ACTOR);
    await svc.createShowtimesBulk(bulk({ dates: ["2099-12-01"], times: ["15:00"], priceOverride: 60000 }), ACTOR);
    const all = await svc.searchShowtimes({ date: "2099-12-01" });
    expect(all.map((r) => r.price)).toEqual([80000, 60000, 80000]);
    expect((await svc.searchShowtimes({ date: "2099-12-01", slot: "evening" })).map((r) => r.startAt)).toEqual(["2099-12-01T12:30:00.000Z"]);
    expect(await svc.searchShowtimes({ date: "2099-12-02" })).toEqual([]);
    expect(await svc.searchShowtimes({ movieId: "bad" })).toEqual([]);
  });
});
