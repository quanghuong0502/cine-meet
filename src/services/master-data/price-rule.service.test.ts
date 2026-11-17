import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

const ACTOR = new Types.ObjectId().toString();
const id = () => new Types.ObjectId().toString();
const BRAND = id();

let rules: typeof import("./price-rule.service");
let brands: typeof import("./brand.service");
let branches: typeof import("./branch.service");
let formats: typeof import("./format.service");
let seatTypes: typeof import("./seat-type.service");
let pricing: typeof import("@/services/pricing/ticket-price");
let clear: () => Promise<void>;

beforeAll(async () => {
  await startTestDatabase();
  rules = await import("./price-rule.service");
  brands = await import("./brand.service");
  branches = await import("./branch.service");
  formats = await import("./format.service");
  seatTypes = await import("./seat-type.service");
  pricing = await import("@/services/pricing/ticket-price");
  const mongoose = (await import("mongoose")).default;
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase();
  clear = async () => {
    await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
  };
}, 120_000);

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await clear();
});

const parse = (input: Record<string, string | undefined>) => rules.priceRuleInputSchema.safeParse(input);
const codes = (input: Record<string, string | undefined>) => {
  const result = parse(input);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe("price rule input", () => {
  it("turns the scope into a brand or a branch, and 'any' into no condition", () => {
    const branchId = id();
    const brandRule = parse({ scope: `brand:${BRAND}`, price: "90000", formatId: "any", dayType: "any" });
    expect(brandRule.success && brandRule.data).toMatchObject({ brandId: BRAND, branchId: undefined, formatId: undefined, dayType: undefined, priority: 0 });

    const branchRule = parse({ scope: `branch:${branchId}`, price: "99000", seatTypeId: BRAND, dayType: "weekend", priority: "3" });
    expect(branchRule.success && branchRule.data).toMatchObject({ branchId, brandId: undefined, seatTypeId: BRAND, dayType: "weekend", priority: 3 });
  });

  it("requires a scope and a whole-dong price", () => {
    expect(codes({ price: "90000" })).toHaveProperty("scope");
    expect(codes({ scope: "everything", price: "90000" })).toEqual({ scope: "invalid" });
    expect(codes({ scope: `brand:${BRAND}` })).toHaveProperty("price");
    expect(codes({ scope: `brand:${BRAND}`, price: "90000.5" })).toEqual({ price: "invalid_number" });
  });

  it("a promo day needs its weekday; other day types drop it", () => {
    expect(codes({ scope: `brand:${BRAND}`, price: "60000", dayType: "promo" })).toEqual({ weekday: "required" });
    const promo = parse({ scope: `brand:${BRAND}`, price: "60000", dayType: "promo", weekday: "3" });
    expect(promo.success && promo.data.weekday).toBe(3);
    const normal = parse({ scope: `brand:${BRAND}`, price: "60000", dayType: "normal", weekday: "3" });
    expect(normal.success && normal.data.weekday).toBeUndefined();
    expect(codes({ scope: `brand:${BRAND}`, price: "1", dayType: "promo", weekday: "7" })).toEqual({ weekday: "out_of_range" });
    expect(codes({ scope: `brand:${BRAND}`, price: "1", dayType: "someday" })).toEqual({ dayType: "invalid" });
  });

  it("a time window needs both ends, in order", () => {
    const base = { scope: `brand:${BRAND}`, price: "60000" };
    expect(codes({ ...base, timeFrom: "08:00" })).toEqual({ timeTo: "required" });
    expect(codes({ ...base, timeTo: "12:00" })).toEqual({ timeFrom: "required" });
    expect(codes({ ...base, timeFrom: "12:00", timeTo: "08:00" })).toEqual({ timeTo: "out_of_range" });
    expect(codes({ ...base, timeFrom: "8:00", timeTo: "12:00" })).toEqual({ timeFrom: "invalid" });
    expect(codes({ ...base, timeFrom: "08:00", timeTo: "12:00" })).toEqual({});
  });

  it("checks validity dates and priority range", () => {
    const base = { scope: `brand:${BRAND}`, price: "60000" };
    expect(codes({ ...base, validFrom: "2026-05-01", validTo: "2026-04-01" })).toEqual({ validTo: "out_of_range" });
    expect(codes({ ...base, priority: "101" })).toEqual({ priority: "out_of_range" });
  });
});

describe("price rule storage", () => {
  it("saves a rule and feeds the pricing function", async () => {
    const parsed = parse({ scope: `brand:${BRAND}`, price: "90000", dayType: "weekend" });
    if (!parsed.success) throw new Error("setup failed");
    const created = await rules.priceRuleService.create(parsed.data, ACTOR);
    if (!created.ok) throw new Error("setup failed");

    const stored = await rules.priceRuleService.list();
    const rule = stored[0]!;
    const result = pricing.resolveTicketPrice({
      showtime: {
        startAt: new Date("2026-03-07T19:30:00+07:00"),
        brandId: BRAND,
        branchId: id(),
        formatId: id(),
        seatTypeId: id(),
      },
      rules: [
        {
          id: rule._id.toString(),
          brandId: rule.brandId?.toString(),
          dayType: rule.dayType ?? undefined,
          price: rule.price,
          priority: rule.priority,
          createdAt: rule.createdAt,
        },
      ],
      holidays: new Set(),
    });
    expect(result).toEqual({ price: 90000, source: "rule", ruleId: rule._id.toString() });
  });

  it("switching a rule from a brand to a branch clears the brand", async () => {
    const branchId = id();
    const first = parse({ scope: `brand:${BRAND}`, price: "90000" });
    if (!first.success) throw new Error("setup failed");
    const created = await rules.priceRuleService.create(first.data, ACTOR);
    if (!created.ok) throw new Error("setup failed");
    const ruleId = created.data._id.toString();

    const next = parse({ scope: `branch:${branchId}`, price: "90000" });
    if (!next.success) throw new Error("setup failed");
    await rules.priceRuleService.update(ruleId, next.data, ACTOR);
    const saved = await rules.priceRuleService.getById(ruleId);
    expect(saved?.branchId?.toString()).toBe(branchId);
    expect(saved?.brandId).toBeUndefined();
  });

  it("blocks deleting a brand, branch, format or seat type that a rule uses", async () => {
    const brand = await brands.brandService.create({ name: "CGV" }, ACTOR);
    const format = await formats.formatService.create({ name: "2D" }, ACTOR);
    const seat = await seatTypes.seatTypeService.create({ name: "Thường", capacity: 1 }, ACTOR);
    if (!brand.ok || !format.ok || !seat.ok) throw new Error("setup failed");
    const branch = await branches.branchService.create({ brandId: brand.data._id.toString(), name: "Vincom" }, ACTOR);
    if (!branch.ok) throw new Error("setup failed");

    const brandRule = parse({ scope: `brand:${brand.data._id}`, price: "90000", formatId: format.data._id.toString(), seatTypeId: seat.data._id.toString() });
    const branchRule = parse({ scope: `branch:${branch.data._id}`, price: "99000" });
    if (!brandRule.success || !branchRule.success) throw new Error("setup failed");
    await rules.priceRuleService.create(brandRule.data, ACTOR);
    const created = await rules.priceRuleService.create(branchRule.data, ACTOR);
    if (!created.ok) throw new Error("setup failed");

    expect(await formats.formatService.remove(format.data._id.toString(), ACTOR)).toEqual({ ok: false, error: "in_use" });
    expect(await seatTypes.seatTypeService.remove(seat.data._id.toString(), ACTOR)).toEqual({ ok: false, error: "in_use" });
    expect(await branches.branchService.remove(branch.data._id.toString(), ACTOR)).toEqual({ ok: false, error: "in_use" });
    expect(await brands.brandService.remove(brand.data._id.toString(), ACTOR)).toEqual({ ok: false, error: "in_use" });

    await rules.priceRuleService.remove(created.data._id.toString(), ACTOR);
    expect((await branches.branchService.remove(branch.data._id.toString(), ACTOR)).ok).toBe(true);
  });
});
