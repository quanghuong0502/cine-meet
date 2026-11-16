import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

type BrandService = typeof import("./brand.service");
type AuditService = typeof import("@/services/audit.service");

let brands: BrandService["brandService"];
let schema: BrandService["brandInputSchema"];
let audit: AuditService;
let Brand: typeof import("@/models/brand").Brand;
let AuditLog: typeof import("@/models/audit-log").AuditLog;

const ACTOR = new Types.ObjectId().toString();

beforeAll(async () => {
  await startTestDatabase();
  ({ brandService: brands, brandInputSchema: schema } = await import("./brand.service"));
  audit = await import("@/services/audit.service");
  ({ Brand } = await import("@/models/brand"));
  ({ AuditLog } = await import("@/models/audit-log"));
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase();
  await Brand.init();
}, 120_000);

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await Promise.all([Brand.deleteMany({}), AuditLog.deleteMany({})]);
});

describe("master-data service (brands)", () => {
  it("creates a record and writes an audit entry", async () => {
    const result = await brands.create({ name: "CGV", color: "#e71a0f" }, ACTOR);
    expect(result.ok).toBe(true);

    const entries = await audit.listAudit({ entity: "brand" });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: "create", actorId: ACTOR });
  });

  it("rejects a duplicate name, ignoring case", async () => {
    await brands.create({ name: "CGV" }, ACTOR);
    const again = await brands.create({ name: "cgv" }, ACTOR);
    expect(again).toEqual({ ok: false, error: "duplicate" });
  });

  it("updates, and removes a field the form left empty", async () => {
    const created = await brands.create({ name: "BHD", websiteUrl: "https://bhdstar.vn" }, ACTOR);
    if (!created.ok) throw new Error("setup failed");
    const id = created.data._id.toString();

    const updated = await brands.update(id, { name: "BHD Star" }, ACTOR);
    expect(updated.ok).toBe(true);
    const saved = await Brand.findById(id).lean();
    expect(saved?.name).toBe("BHD Star");
    expect(saved?.websiteUrl).toBeUndefined();

    const entries = await audit.listAudit({ entity: "brand" });
    expect(entries.map((entry) => entry.action)).toEqual(["update", "create"]);
  });

  it("reports duplicates and unknown ids on update", async () => {
    await brands.create({ name: "Beta" }, ACTOR);
    const other = await brands.create({ name: "Lotte" }, ACTOR);
    if (!other.ok) throw new Error("setup failed");

    expect(await brands.update(other.data._id.toString(), { name: "BETA" }, ACTOR)).toEqual({
      ok: false,
      error: "duplicate",
    });
    expect(await brands.update(new Types.ObjectId().toString(), { name: "X" }, ACTOR)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await brands.update("not-an-id", { name: "X" }, ACTOR)).toEqual({ ok: false, error: "not_found" });
  });

  it("removes a record and audits it", async () => {
    const created = await brands.create({ name: "Galaxy" }, ACTOR);
    if (!created.ok) throw new Error("setup failed");
    const id = created.data._id.toString();

    expect(await brands.remove(id, ACTOR)).toEqual({ ok: true, data: null });
    expect(await Brand.countDocuments({})).toBe(0);
    expect(await brands.remove(id, ACTOR)).toEqual({ ok: false, error: "not_found" });

    const entries = await audit.listAudit({ entity: "brand" });
    expect(entries[0]?.action).toBe("delete");
  });

  it("searches by name, ignoring case", async () => {
    await brands.create({ name: "CGV Cinemas" }, ACTOR);
    await brands.create({ name: "Lotte Cinema" }, ACTOR);
    await brands.create({ name: "Beta" }, ACTOR);

    expect((await brands.list({ q: "cinema" })).map((b) => b.name)).toEqual(["CGV Cinemas", "Lotte Cinema"]);
    expect(await brands.list({ q: "zzz" })).toEqual([]);
    expect(await brands.list()).toHaveLength(3);
  });

  it("escapes special characters in the search box", async () => {
    await brands.create({ name: "Beta (HN)" }, ACTOR);
    expect(await brands.list({ q: "(" })).toHaveLength(1);
    expect(await brands.list({ q: ".*" })).toHaveLength(0);
  });
});

describe("brand input schema", () => {
  const codes = (input: Record<string, string | undefined>) => {
    const result = schema.safeParse(input);
    return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
  };

  it("accepts a minimal brand", () => {
    expect(schema.safeParse({ name: "CGV" }).success).toBe(true);
  });

  it("returns codes, not sentences", () => {
    expect(codes({})).toMatchObject({ name: expect.stringMatching(/required|Invalid/) });
    expect(codes({ name: "x".repeat(61) })).toEqual({ name: "too_long" });
    expect(codes({ name: "CGV", websiteUrl: "not a url" })).toEqual({ websiteUrl: "invalid_url" });
    expect(codes({ name: "CGV", websiteUrl: "javascript:alert(1)" })).toEqual({ websiteUrl: "invalid_url" });
    expect(codes({ name: "CGV", color: "red" })).toEqual({ color: "invalid_color" });
  });
});
