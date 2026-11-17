import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

const ACTOR = new Types.ObjectId().toString();
let svc: typeof import("./brand-color.service");
let SystemSetting: typeof import("@/models/system-setting").SystemSetting;
let AuditLog: typeof import("@/models/audit-log").AuditLog;

beforeAll(async () => {
  await startTestDatabase();
  svc = await import("./brand-color.service");
  ({ SystemSetting } = await import("@/models/system-setting"));
  ({ AuditLog } = await import("@/models/audit-log"));
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase();
  await SystemSetting.init();
}, 120_000);

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await Promise.all([SystemSetting.deleteMany({}), AuditLog.deleteMany({})]);
});

describe("brand colour", () => {
  it("is the default raspberry until an admin saves one", async () => {
    expect(await svc.getBrandColor()).toBe("#C61583");
  });

  it("saves a usable colour, upper-cased, and audits the change", async () => {
    expect(await svc.saveBrandColor("#0a84ff", ACTOR)).toEqual({ ok: true, hex: "#0A84FF" });
    expect(await svc.getBrandColor()).toBe("#0A84FF");
    expect(await AuditLog.countDocuments({ entity: "systemSetting" })).toBe(1);
    // Saving the same colour again changes nothing.
    await svc.saveBrandColor("#0A84FF", ACTOR);
    expect(await AuditLog.countDocuments({ entity: "systemSetting" })).toBe(1);
  });

  it("refuses an unusable colour and keeps the old one", async () => {
    await svc.saveBrandColor("#0A84FF", ACTOR);
    expect(await svc.saveBrandColor("#808080", ACTOR)).toEqual({ ok: false, error: "too_gray" });
    expect(await svc.saveBrandColor("#2A0A1A", ACTOR)).toEqual({ ok: false, error: "too_dark" });
    expect(await svc.saveBrandColor("blue", ACTOR)).toEqual({ ok: false, error: "invalid_color" });
    expect(await svc.getBrandColor()).toBe("#0A84FF");
  });

  it("falls back to the default when the stored value is broken, and can be reset", async () => {
    await SystemSetting.create({ key: "brandColor", value: "not a colour" });
    expect(await svc.getBrandColor()).toBe("#C61583");

    await svc.saveBrandColor("#0A84FF", ACTOR);
    await svc.resetBrandColor(ACTOR);
    expect(await svc.getBrandColor()).toBe("#C61583");
  });
});
