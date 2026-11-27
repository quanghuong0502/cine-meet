import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

const ACTOR = new Types.ObjectId().toString();
const BRAND = new Types.ObjectId().toString();
const ITEM = new Types.ObjectId().toString();

let s: {
  brand: typeof import("./brand.service");
  branch: typeof import("./branch.service");
  genre: typeof import("./genre.service");
  ageRating: typeof import("./age-rating.service");
  seatType: typeof import("./seat-type.service");
  holiday: typeof import("./holiday.service");
  fnbItem: typeof import("./fnb-item.service");
  fnbCombo: typeof import("./fnb-combo.service");
};
let models: { names: string[]; clear(): Promise<void> };

beforeAll(async () => {
  await startTestDatabase();
  s = {
    brand: await import("./brand.service"),
    branch: await import("./branch.service"),
    genre: await import("./genre.service"),
    ageRating: await import("./age-rating.service"),
    seatType: await import("./seat-type.service"),
    holiday: await import("./holiday.service"),
    fnbItem: await import("./fnb-item.service"),
    fnbCombo: await import("./fnb-combo.service"),
  };
  const mongoose = (await import("mongoose")).default;
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  models = {
    names: Object.keys(mongoose.models),
    clear: async () => {
      await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
    },
  };
}, 120_000);

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await models.clear();
});

/** Error codes by field for an input the schema rejects. */
function codes(schema: { safeParse(input: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, input: object) {
  const result = schema.safeParse(input);
  return result.success ? {} : Object.fromEntries((result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]));
}

describe("brand protection", () => {
  it("does not delete a brand that still has branches or food", async () => {
    const brand = await s.brand.brandService.create({ name: "CGV" }, ACTOR);
    if (!brand.ok) throw new Error("setup failed");
    const brandId = brand.data._id.toString();

    const branch = await s.branch.branchService.create({ brandId, name: "CGV Vincom" }, ACTOR);
    if (!branch.ok) throw new Error("setup failed");
    expect(await s.brand.brandService.remove(brandId, ACTOR)).toEqual({ ok: false, error: "in_use" });

    await s.branch.branchService.remove(branch.data._id.toString(), ACTOR);
    const item = await s.fnbItem.fnbItemService.create({ brandId, name: "Bắp", price: 59000 }, ACTOR);
    if (!item.ok) throw new Error("setup failed");
    expect(await s.brand.brandService.remove(brandId, ACTOR)).toEqual({ ok: false, error: "in_use" });
  });
});

describe("branches", () => {
  it("allows the same name under two brands but not twice under one", async () => {
    const other = new Types.ObjectId().toString();
    expect((await s.branch.branchService.create({ brandId: BRAND, name: "Landmark" }, ACTOR)).ok).toBe(true);
    expect((await s.branch.branchService.create({ brandId: other, name: "Landmark" }, ACTOR)).ok).toBe(true);
    expect(await s.branch.branchService.create({ brandId: BRAND, name: "LANDMARK" }, ACTOR)).toEqual({
      ok: false,
      error: "duplicate",
    });
  });

  it("checks the brand and takes one Google Maps link and one photo link", () => {
    const schema = s.branch.branchInputSchema;
    expect(codes(schema, { brandId: BRAND, name: "A" })).toEqual({});
    expect(
      codes(schema, { brandId: BRAND, name: "A", mapsUrl: "https://maps.app.goo.gl/abc", imageUrl: "https://res.cloudinary.com/x/a.jpg" }),
    ).toEqual({});
    expect(codes(schema, { brandId: BRAND, name: "A", mapsUrl: "not a link" })).toEqual({ mapsUrl: "invalid_url" });
    expect(codes(schema, { name: "A" })).toHaveProperty("brandId");
    expect(codes(schema, { brandId: "nope", name: "A" })).toEqual({ brandId: "invalid" });
  });

  it("keeps a whole-dong parking fee", () => {
    const schema = s.branch.branchInputSchema;
    expect(schema.parse({ brandId: BRAND, name: "A", parkingFee: "5000" }).parkingFee).toBe(5000);
    expect(codes(schema, { brandId: BRAND, name: "A", parkingFee: "5.5" })).toEqual({ parkingFee: "invalid_number" });
    expect(codes(schema, { brandId: BRAND, name: "A", parkingFee: "-1" })).toEqual({ parkingFee: "out_of_range" });
  });

  it("refuses to delete a branch that still has auditoriums", async () => {
    const { Auditorium } = await import("@/models/auditorium");
    const branch = await s.branch.branchService.create({ brandId: BRAND, name: "With Room" }, ACTOR);
    if (!branch.ok) throw new Error("setup failed");
    await Auditorium.create({ branchId: branch.data._id.toString(), name: "Phòng 1" });
    expect(await s.branch.branchService.remove(branch.data._id.toString(), ACTOR)).toEqual({ ok: false, error: "in_use" });
  });
});

describe("simple types", () => {
  it("genres are unique ignoring accents and case", async () => {
    await s.genre.genreService.create({ name: "Hành động" }, ACTOR);
    // "đ" counts as its own letter in Vietnamese, so only case and tone marks are ignored.
    expect(await s.genre.genreService.create({ name: "HANH ĐỘNG" }, ACTOR)).toEqual({ ok: false, error: "duplicate" });
  });

  it("age ratings are found by code, sorted by minimum age", async () => {
    await s.ageRating.ageRatingService.create({ code: "T18", description: "18+", minAge: 18 }, ACTOR);
    await s.ageRating.ageRatingService.create({ code: "P", description: "Mọi lứa tuổi", minAge: 0 }, ACTOR);
    expect((await s.ageRating.ageRatingService.list()).map((r) => r.code)).toEqual(["P", "T18"]);
    expect((await s.ageRating.ageRatingService.list({ q: "t1" })).map((r) => r.code)).toEqual(["T18"]);
    expect(codes(s.ageRating.ageRatingInputSchema, { code: "X", description: "d", minAge: "30" })).toEqual({ minAge: "out_of_range" });
  });

  it("seat types accept capacity 1 or 2 only", () => {
    const schema = s.seatType.seatTypeInputSchema;
    expect(schema.parse({ name: "Đôi", capacity: "2" }).capacity).toBe(2);
    expect(codes(schema, { name: "Lạ", capacity: "3" })).toEqual({ capacity: "invalid" });
    expect(codes(schema, { name: "Lạ" })).toHaveProperty("capacity");
  });

  it("holidays need a real calendar date and are unique per day", async () => {
    const schema = s.holiday.holidayInputSchema;
    expect(codes(schema, { name: "Tết", date: "2026-02-30" })).toEqual({ date: "invalid_date" });
    expect(codes(schema, { name: "Tết", date: "20/02/2026" })).toEqual({ date: "invalid_date" });
    expect(codes(schema, { name: "Tết", date: "2026-02-17" })).toEqual({});

    await s.holiday.holidayService.create({ name: "Tết", date: "2026-02-17" }, ACTOR);
    expect(await s.holiday.holidayService.create({ name: "Mùng 1", date: "2026-02-17" }, ACTOR)).toEqual({
      ok: false,
      error: "duplicate",
    });
  });
});

describe("food and drinks", () => {
  it("rejects a validity window that ends before it starts", () => {
    for (const schema of [s.fnbItem.fnbItemInputSchema, s.fnbCombo.fnbComboInputSchema]) {
      const base = { brandId: BRAND, name: "Bắp", price: "59000", items: JSON.stringify([{ itemId: ITEM, quantity: 1 }]) };
      expect(codes(schema, { ...base, validFrom: "2026-03-10", validTo: "2026-03-01" })).toEqual({ validTo: "out_of_range" });
      expect(codes(schema, { ...base, validFrom: "2026-03-01", validTo: "2026-03-01" })).toEqual({});
      expect(codes(schema, { ...base, validFrom: "2026-03-01" })).toEqual({});
    }
  });

  it("stores the price as a whole number of dong", async () => {
    expect(s.fnbItem.fnbItemInputSchema.parse({ brandId: BRAND, name: "Bắp", price: "59000" }).price).toBe(59000);
    expect(codes(s.fnbItem.fnbItemInputSchema, { brandId: BRAND, name: "Bắp", price: "59.5" })).toEqual({ price: "invalid_number" });
    expect(codes(s.fnbItem.fnbItemInputSchema, { brandId: BRAND, name: "Bắp" })).toHaveProperty("price");
  });

  it("allows one item in two sizes, not the same size twice", async () => {
    const make = (size: string) => s.fnbItem.fnbItemService.create({ brandId: BRAND, name: "Bắp", size, price: 50000 }, ACTOR);
    expect((await make("M")).ok).toBe(true);
    expect((await make("L")).ok).toBe(true);
    expect(await make("m")).toEqual({ ok: false, error: "duplicate" });
  });

  it("clears a validity date that the form left empty", async () => {
    const item = await s.fnbItem.fnbItemService.create({ brandId: BRAND, name: "Bắp", price: 59000 }, ACTOR);
    if (!item.ok) throw new Error("setup failed");
    const lines = [{ itemId: item.data._id.toString(), quantity: 1 }];
    const created = await s.fnbCombo.fnbComboService.create(
      { brandId: BRAND, name: "Combo 1", items: lines, validFrom: "2026-01-01", validTo: "2026-02-01" },
      ACTOR,
    );
    if (!created.ok) throw new Error("setup failed");
    const id = created.data._id.toString();
    await s.fnbCombo.fnbComboService.update(id, { brandId: BRAND, name: "Combo 1", items: lines, validFrom: "2026-01-01" }, ACTOR);
    const saved = await s.fnbCombo.fnbComboService.getById(id);
    expect(saved?.validTo).toBeUndefined();
    expect(saved?.validFrom).toBe("2026-01-01");
  });
});

describe("combos", () => {
  const lines = (...entries: Array<[string, number]>) => JSON.stringify(entries.map(([itemId, quantity]) => ({ itemId, quantity })));

  async function twoItems(brandId = BRAND) {
    const popcorn = await s.fnbItem.fnbItemService.create({ brandId, name: "Bắp", price: 69000 }, ACTOR);
    const drink = await s.fnbItem.fnbItemService.create({ brandId, name: "Nước", price: 35000 }, ACTOR);
    if (!popcorn.ok || !drink.ok) throw new Error("setup failed");
    return { popcorn: popcorn.data._id.toString(), drink: drink.data._id.toString() };
  }

  it("needs at least one item and reads the items and the discount from the form", () => {
    const schema = s.fnbCombo.fnbComboInputSchema;
    expect(codes(schema, { brandId: BRAND, name: "C", items: "[]" })).toEqual({ items: "no_items" });
    expect(codes(schema, { brandId: BRAND, name: "C" })).toHaveProperty("items");
    expect(codes(schema, { brandId: BRAND, name: "C", items: "not json" })).toHaveProperty("items");
    expect(codes(schema, { brandId: BRAND, name: "C", items: lines([ITEM, 0]) })).toHaveProperty("items");
    expect(codes(schema, { brandId: BRAND, name: "C", items: lines([ITEM, 1], [ITEM, 2]) })).toHaveProperty("items");

    const parsed = schema.parse({ brandId: BRAND, name: "C", items: lines([ITEM, 2]), discountType: "percent", discountValue: "10" });
    expect(parsed).toMatchObject({ items: [{ itemId: ITEM, quantity: 2 }], discountType: "percent", discountValue: 10 });
    // No discount typed means none.
    expect(schema.parse({ brandId: BRAND, name: "C", items: lines([ITEM, 1]) })).toMatchObject({ discountType: "amount", discountValue: 0 });
    expect(codes(schema, { brandId: BRAND, name: "C", items: lines([ITEM, 1]), discountType: "percent", discountValue: "101" })).toEqual({ discountValue: "out_of_range" });
  });

  it("saves a combo whose items belong to its brand and prices it from them", async () => {
    const { popcorn, drink } = await twoItems();
    const input = { brandId: BRAND, name: "Combo 1", items: [{ itemId: popcorn, quantity: 1 }, { itemId: drink, quantity: 2 }], discountType: "amount", discountValue: 19000 };
    const created = await s.fnbCombo.fnbComboService.create(input, ACTOR);
    if (!created.ok) throw new Error("setup failed");

    const prices = new Map([[popcorn, 69000], [drink, 35000]]);
    expect(s.fnbCombo.priceOfCombo(created.data, prices)).toEqual({ subtotal: 139000, discount: 19000, price: 120000 });
    // The item price moves, the combo follows.
    expect(s.fnbCombo.priceOfCombo(created.data, new Map([[popcorn, 79000], [drink, 35000]]))?.price).toBe(130000);
  });

  it("refuses an item of another brand or one that does not exist", async () => {
    const other = await twoItems(new Types.ObjectId().toString());
    const mine = await twoItems();
    expect(await s.fnbCombo.fnbComboService.create({ brandId: BRAND, name: "A", items: [{ itemId: other.popcorn, quantity: 1 }] }, ACTOR)).toEqual({ ok: false, error: "item_invalid" });
    expect(await s.fnbCombo.fnbComboService.create({ brandId: BRAND, name: "B", items: [{ itemId: new Types.ObjectId().toString(), quantity: 1 }] }, ACTOR)).toEqual({ ok: false, error: "item_invalid" });
    expect((await s.fnbCombo.fnbComboService.create({ brandId: BRAND, name: "C", items: [{ itemId: mine.popcorn, quantity: 1 }] }, ACTOR)).ok).toBe(true);
  });

  it("refuses a discount in dong that is more than the items cost", async () => {
    const { drink } = await twoItems();
    const items = [{ itemId: drink, quantity: 1 }];
    expect(await s.fnbCombo.fnbComboService.create({ brandId: BRAND, name: "A", items, discountType: "amount", discountValue: 35001 }, ACTOR)).toEqual({ ok: false, error: "discount_too_high" });
    expect((await s.fnbCombo.fnbComboService.create({ brandId: BRAND, name: "B", items, discountType: "amount", discountValue: 35000 }, ACTOR)).ok).toBe(true);
  });

  it("does not delete an item that a combo contains", async () => {
    const { popcorn, drink } = await twoItems();
    await s.fnbCombo.fnbComboService.create({ brandId: BRAND, name: "Combo", items: [{ itemId: popcorn, quantity: 1 }] }, ACTOR);
    expect(await s.fnbItem.fnbItemService.remove(popcorn, ACTOR)).toEqual({ ok: false, error: "in_use" });
    expect((await s.fnbItem.fnbItemService.remove(drink, ACTOR)).ok).toBe(true);
  });
});
