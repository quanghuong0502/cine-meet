import { describe, expect, it } from "vitest";
import { formatDayCompact } from "./datetime";

// 2026-11-18 12:00 in Vietnam
const now = new Date("2026-11-18T05:00:00Z");

describe("formatDayCompact", () => {
  it("says today and tomorrow in words, by Vietnam's calendar", () => {
    expect(formatDayCompact("2026-11-18T11:30:00Z", "vi", now)).toBe("Hôm nay");
    expect(formatDayCompact("2026-11-19T02:00:00Z", "vi", now)).toBe("Ngày mai");
    expect(formatDayCompact("2026-11-18T11:30:00Z", "en", now)).toBe("Today");
    expect(formatDayCompact("2026-11-19T02:00:00Z", "en", now)).toBe("Tomorrow");
  });
  it("late evening UTC is already the next day in Vietnam", () => {
    // 20:00 UTC on the 18th = 03:00 on the 19th in Vietnam
    expect(formatDayCompact("2026-11-18T20:00:00Z", "vi", now)).toBe("Ngày mai");
  });
  it("other days show the weekday and the date", () => {
    const text = formatDayCompact("2026-11-21T12:00:00Z", "vi", now);
    expect(text).toContain("21/11");
    expect(formatDayCompact("2026-11-21T12:00:00Z", "en", now)).toContain("21/11");
  });
});
