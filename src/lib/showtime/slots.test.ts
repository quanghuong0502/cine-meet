import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_SLOTS, slotName, timeInSlot, timeSlotsFieldSchema, timeSlotsSchema } from "./slots";

const slot = (id: string, from: string, to: string, name = id) => ({ id, name, from, to });
const codes = (value: unknown) => {
  const result = timeSlotsSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("timeInSlot", () => {
  it("includes the start and excludes the end; 00:00 as the end means end of day", () => {
    const [morning, , , late] = DEFAULT_TIME_SLOTS;
    expect(timeInSlot(morning, "00:00")).toBe(true);
    expect(timeInSlot(morning, "11:59")).toBe(true);
    expect(timeInSlot(morning, "12:00")).toBe(false);
    expect(timeInSlot(late, "22:00")).toBe(true);
    expect(timeInSlot(late, "23:59")).toBe(true);
  });
  it("the default slots cover the whole day with no gap or overlap", () => {
    expect(codes(DEFAULT_TIME_SLOTS)).toEqual([]);
    for (const time of ["00:00", "06:30", "11:59", "12:00", "16:59", "17:00", "21:59", "22:00", "23:59"]) {
      expect(DEFAULT_TIME_SLOTS.filter((s) => timeInSlot(s, time))).toHaveLength(1);
    }
  });
});

describe("timeSlotsSchema", () => {
  it("accepts good slots (also none at all) and back-to-back slots", () => {
    expect(codes([])).toEqual([]);
    expect(codes([slot("a", "08:00", "12:00"), slot("b", "12:00", "18:00")])).toEqual([]);
  });
  it("rejects a slot that ends before it starts, bad times, empty names and repeated ids", () => {
    expect(codes([slot("a", "12:00", "08:00")])).toEqual(["invalid"]);
    expect(codes([slot("a", "12:00", "12:00")])).toEqual(["invalid"]);
    expect(codes([slot("a", "8:00", "12:00")])).toContain("invalid");
    expect(codes([slot("a", "08:00", "12:00", "")])).toContain("required");
    expect(codes([slot("a", "08:00", "10:00"), slot("a", "10:00", "12:00")])).toContain("invalid");
  });
  it("rejects overlapping slots whatever their order", () => {
    expect(codes([slot("b", "11:00", "15:00"), slot("a", "08:00", "12:00")])).toEqual(["out_of_range"]);
  });
  it("allows at most eight", () => {
    const many = Array.from({ length: 9 }, (_, i) => slot(`s${i}`, `${String(i * 2).padStart(2, "0")}:00`, `${String(i * 2 + 1).padStart(2, "0")}:00`));
    expect(codes(many)).toContain("out_of_range");
  });
});

describe("timeSlotsFieldSchema", () => {
  it("reads JSON text and reports broken JSON as invalid", () => {
    expect(timeSlotsFieldSchema.safeParse(JSON.stringify(DEFAULT_TIME_SLOTS)).success).toBe(true);
    const bad = timeSlotsFieldSchema.safeParse("{not json");
    expect(!bad.success && bad.error.issues[0].message).toBe("invalid");
  });
  it("drops an empty English name", () => {
    const parsed = timeSlotsFieldSchema.safeParse(JSON.stringify([{ id: "a", name: "Sáng", nameEn: "  ", from: "08:00", to: "12:00" }]));
    expect(parsed.success && parsed.data[0].nameEn).toBeUndefined();
  });
});

describe("slotName", () => {
  it("uses the English name in English and falls back to the Vietnamese one", () => {
    expect(slotName({ id: "a", name: "Sáng", nameEn: "Morning", from: "06:00", to: "12:00" }, "en")).toBe("Morning");
    expect(slotName({ id: "a", name: "Sáng", from: "06:00", to: "12:00" }, "en")).toBe("Sáng");
    expect(slotName({ id: "a", name: "Sáng", nameEn: "Morning", from: "06:00", to: "12:00" }, "vi")).toBe("Sáng");
  });
});
