import { describe, expect, it } from "vitest";
import { deadlineWarningSendAt, reminderSendTimes } from "./reminders";

describe("reminderSendTimes", () => {
  const start = new Date("2026-01-10T20:00:00.000Z");
  const now = new Date("2026-01-08T00:00:00.000Z");

  it("gives one row per minutesBefore value, earliest lead first as given", () => {
    const rows = reminderSendTimes(start, [1440, 20], now);
    expect(rows).toEqual([
      { minutesBefore: 1440, sendAt: new Date("2026-01-09T20:00:00.000Z") },
      { minutesBefore: 20, sendAt: new Date("2026-01-10T19:40:00.000Z") },
    ]);
  });

  it("drops a lead whose moment has already passed", () => {
    // 1440 minutes before start is before `now`: dropped. 20 minutes before is still ahead: kept.
    const lateNow = new Date("2026-01-10T10:00:00.000Z");
    const rows = reminderSendTimes(start, [1440, 20], lateNow);
    expect(rows).toEqual([{ minutesBefore: 20, sendAt: new Date("2026-01-10T19:40:00.000Z") }]);
  });

  it("is empty once every lead has passed", () => {
    expect(reminderSendTimes(start, [20], new Date("2026-01-10T19:41:00.000Z"))).toEqual([]);
  });
});

describe("deadlineWarningSendAt", () => {
  const deadline = new Date("2026-01-10T20:00:00.000Z");

  it("is 12 hours before the deadline when that is still ahead", () => {
    expect(deadlineWarningSendAt(deadline, new Date("2026-01-01T00:00:00.000Z"))).toEqual(new Date("2026-01-10T08:00:00.000Z"));
  });

  it("is null when the 12-hour mark has already passed", () => {
    expect(deadlineWarningSendAt(deadline, new Date("2026-01-10T09:00:00.000Z"))).toBeNull();
  });
});
