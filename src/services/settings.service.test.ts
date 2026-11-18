import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_TIME_SLOTS } from "@/lib/showtime/slots";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

const ACTOR = new Types.ObjectId().toString();
let svc: typeof import("./settings.service");
let SystemSetting: typeof import("@/models/system-setting").SystemSetting;
let AuditLog: typeof import("@/models/audit-log").AuditLog;

beforeAll(async () => {
  await startTestDatabase();
  svc = await import("./settings.service");
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

const parse = (input: Record<string, string>) => svc.systemSettingsInputSchema.safeParse(input);
const codes = (input: Record<string, string>) => {
  const result = parse(input);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
};
const base = { reminderMinutesBefore: "1440, 20", responseDeadlineHours: "24", adMinutes: "15", movieUpcomingDays: "30", timeSlots: JSON.stringify(DEFAULT_TIME_SLOTS), pushTtlHours: "24" };

describe("settings input", () => {
  it("reads the reminders as a list, largest first, without repeats", () => {
    const result = parse({ ...base, reminderMinutesBefore: "20, 1440 20;60" });
    expect(result.success && result.data.reminderMinutesBefore).toEqual([1440, 60, 20]);
  });

  it("rejects bad reminders, hours and ad minutes with codes", () => {
    expect(codes({ ...base, reminderMinutesBefore: "" })).toHaveProperty("reminderMinutesBefore");
    expect(codes({ ...base, reminderMinutesBefore: "20, abc" })).toEqual({ reminderMinutesBefore: "invalid_number" });
    expect(codes({ ...base, reminderMinutesBefore: "0" })).toEqual({ reminderMinutesBefore: "out_of_range" });
    expect(codes({ ...base, reminderMinutesBefore: "20000" })).toEqual({ reminderMinutesBefore: "out_of_range" });
    expect(codes({ ...base, reminderMinutesBefore: "1,2,3,4,5,6" })).toEqual({ reminderMinutesBefore: "out_of_range" });
    expect(codes({ ...base, responseDeadlineHours: "0" })).toEqual({ responseDeadlineHours: "out_of_range" });
    expect(codes({ ...base, adMinutes: "61" })).toEqual({ adMinutes: "out_of_range" });
    expect(codes({ ...base, adMinutes: "1.5" })).toEqual({ adMinutes: "invalid_number" });
    expect(codes({ ...base })).toEqual({});
  });

  it("keeps push for an offline phone between 1 hour and 4 weeks", () => {
    expect(codes({ ...base, pushTtlHours: "1" })).toEqual({});
    expect(codes({ ...base, pushTtlHours: "672" })).toEqual({});
    expect(codes({ ...base, pushTtlHours: "0" })).toEqual({ pushTtlHours: "out_of_range" });
    expect(codes({ ...base, pushTtlHours: "673" })).toEqual({ pushTtlHours: "out_of_range" });
    expect(codes({ ...base, pushTtlHours: "2.5" })).toEqual({ pushTtlHours: "invalid_number" });
  });

  it("checks the days a movie may be announced ahead", () => {
    expect(codes({ ...base, movieUpcomingDays: "0" })).toEqual({});
    expect(codes({ ...base, movieUpcomingDays: "365" })).toEqual({});
    expect(codes({ ...base, movieUpcomingDays: "366" })).toEqual({ movieUpcomingDays: "out_of_range" });
    expect(codes({ ...base, movieUpcomingDays: "-1" })).toEqual({ movieUpcomingDays: "out_of_range" });
    expect(codes({ ...base, movieUpcomingDays: "abc" })).toEqual({ movieUpcomingDays: "invalid_number" });
  });

  it("checks the time slots with codes", () => {
    const slots = (value: unknown) => ({ ...base, timeSlots: JSON.stringify(value) });
    expect(codes(slots([]))).toEqual({});
    expect(codes(slots([{ id: "a", name: "Sáng", from: "08:00", to: "12:00" }, { id: "b", name: "Tối", from: "11:00", to: "15:00" }]))).toEqual({ timeSlots: "out_of_range" });
    expect(codes(slots([{ id: "a", name: "Sáng", from: "12:00", to: "08:00" }]))).toEqual({ timeSlots: "invalid" });
    expect(codes({ ...base, timeSlots: "oops" })).toEqual({ timeSlots: "invalid" });
  });

  it("accepts zero ad minutes", () => {
    expect(codes({ ...base, adMinutes: "0" })).toEqual({});
  });
});

describe("settings storage", () => {
  it("returns the defaults before anything is saved", async () => {
    expect(await svc.getSystemSettings()).toEqual(svc.SETTING_DEFAULTS);
  });

  it("saves, reads back and audits only what changed", async () => {
    const parsed = parse({ ...base, adMinutes: "20" });
    if (!parsed.success) throw new Error("setup failed");
    const saved = await svc.updateSystemSettings(parsed.data, ACTOR);
    expect(saved).toEqual({ reminderMinutesBefore: [1440, 20], responseDeadlineHours: 24, adMinutes: 20, movieUpcomingDays: 30, timeSlots: DEFAULT_TIME_SLOTS, pushTtlHours: 24 });
    expect(await svc.getSystemSettings()).toEqual(saved);
    // reminders and ads differ from the defaults; the 24 hours is the default and unchanged.
    expect(await AuditLog.countDocuments({ entity: "systemSetting" })).toBe(2);

    await svc.updateSystemSettings(parsed.data, ACTOR);
    expect(await AuditLog.countDocuments({ entity: "systemSetting" })).toBe(2);
  });

  it("falls back to the default for a damaged stored value", async () => {
    await SystemSetting.create({ key: "adMinutes", value: "lots" });
    await SystemSetting.create({ key: "reminderMinutesBefore", value: [10] });
    expect(await svc.getSystemSettings()).toMatchObject({ adMinutes: 15, reminderMinutesBefore: [10] });
  });
});
