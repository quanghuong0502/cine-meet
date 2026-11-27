import { describe, expect, it } from "vitest";
import { bucketIndexOf, currentMonthRange, formatPeriodKey, periodBuckets } from "./period";

describe("periodBuckets", () => {
  it("builds daily buckets ending today, in Vietnam time", () => {
    // 2026-11-20 01:00 UTC is 2026-11-20 08:00 in Vietnam: still the same Vietnam day.
    const now = new Date("2026-11-20T01:00:00.000Z");
    const buckets = periodBuckets("day", now, 3);
    expect(buckets.map((b) => b.key)).toEqual(["2026-11-18", "2026-11-19", "2026-11-20"]);
    // The last bucket starts at Vietnam midnight (17:00 UTC the day before) and ends 24h later.
    expect(buckets[2].start.toISOString()).toBe("2026-11-19T17:00:00.000Z");
    expect(buckets[2].end.toISOString()).toBe("2026-11-20T17:00:00.000Z");
  });

  it("a moment just before Vietnam midnight still counts as the earlier day", () => {
    // 2026-11-19 16:59 UTC is 2026-11-19 23:59 in Vietnam.
    const now = new Date("2026-11-19T16:59:00.000Z");
    const [bucket] = periodBuckets("day", now, 1);
    expect(bucket.key).toBe("2026-11-19");
  });

  it("builds weekly buckets starting Monday", () => {
    // 2026-11-20 is a Friday.
    const now = new Date("2026-11-20T10:00:00.000Z");
    const [bucket] = periodBuckets("week", now, 1);
    // Monday 2026-11-16 00:00 Vietnam = 2026-11-15 17:00 UTC.
    expect(bucket.start.toISOString()).toBe("2026-11-15T17:00:00.000Z");
    expect(bucket.end.toISOString()).toBe("2026-11-22T17:00:00.000Z");
  });

  it("builds monthly buckets spanning whole Vietnam calendar months", () => {
    const now = new Date("2026-11-20T10:00:00.000Z");
    const buckets = periodBuckets("month", now, 2);
    expect(buckets.map((b) => b.key)).toEqual(["2026-10", "2026-11"]);
    expect(buckets[1].start.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(buckets[1].end.toISOString()).toBe("2026-11-30T17:00:00.000Z");
  });

  it("builds yearly buckets", () => {
    const now = new Date("2026-11-20T10:00:00.000Z");
    const buckets = periodBuckets("year", now, 2);
    expect(buckets.map((b) => b.key)).toEqual(["2025", "2026"]);
  });
});

describe("bucketIndexOf", () => {
  it("finds the bucket a date falls in, or -1 when outside every bucket", () => {
    const buckets = periodBuckets("day", new Date("2026-11-20T10:00:00.000Z"), 3);
    // 18:00 UTC on 11-19 is already 01:00 Vietnam on 11-20: the last bucket.
    expect(bucketIndexOf(buckets, new Date("2026-11-19T18:00:00.000Z"))).toBe(2);
    expect(bucketIndexOf(buckets, new Date("2026-11-19T10:00:00.000Z"))).toBe(1);
    expect(bucketIndexOf(buckets, new Date("2026-11-10T00:00:00.000Z"))).toBe(-1);
    expect(bucketIndexOf(buckets, new Date("2026-11-20T18:00:00.000Z"))).toBe(-1); // tomorrow, outside the 3-day window
  });
});

describe("currentMonthRange", () => {
  it("is the Vietnam calendar month containing now", () => {
    const { start, end } = currentMonthRange(new Date("2026-11-20T10:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-30T17:00:00.000Z");
  });
});

describe("formatPeriodKey", () => {
  it("formats day, week, month, and year bucket keys cleanly without raw ISO dates", () => {
    expect(formatPeriodKey("day", "2026-11-05", "vi")).toBe("05/11");
    expect(formatPeriodKey("week", "2026-11-02", "vi")).toBe("02/11");
    expect(formatPeriodKey("month", "2026-11", "vi")).toBe("Th11");
    expect(formatPeriodKey("month", "2026-11", "en")).toMatch(/Nov/i);
    expect(formatPeriodKey("year", "2026", "vi")).toBe("2026");
  });
});
