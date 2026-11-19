import { describe, expect, it } from "vitest";
import { APPOINTMENT_STATUSES, canTransition, compareForList, canWithdraw, isOverdue, yesVoterIds, type AppointmentStatus } from "./state";

describe("appointment state machine", () => {
  const forward: [AppointmentStatus, AppointmentStatus][] = [
    ["DRAFT", "INVITING"],
    ["INVITING", "PARTICIPANTS_LOCKED"],
    ["PARTICIPANTS_LOCKED", "PLANNING"],
    ["PLANNING", "CONFIRMED"],
    ["CONFIRMED", "COMPLETED"],
  ];

  it("allows exactly one step forward", () => {
    for (const [from, to] of forward) expect(canTransition(from, to), `${from} -> ${to}`).toBe(true);
    const allowed = new Set(forward.map(([f, t]) => `${f}>${t}`));
    for (const from of APPOINTMENT_STATUSES) {
      for (const to of APPOINTMENT_STATUSES) {
        if (to === "CANCELLED" || allowed.has(`${from}>${to}`)) continue;
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(false);
      }
    }
  });

  it("can be cancelled at every step before it is over, and not after", () => {
    for (const from of ["DRAFT", "INVITING", "PARTICIPANTS_LOCKED", "PLANNING", "CONFIRMED"] as const) {
      expect(canTransition(from, "CANCELLED")).toBe(true);
    }
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "CANCELLED")).toBe(false);
  });

  it("nothing leaves a finished appointment", () => {
    for (const to of APPOINTMENT_STATUSES) {
      expect(canTransition("COMPLETED", to)).toBe(false);
      expect(canTransition("CANCELLED", to)).toBe(false);
    }
  });

  it("attendees may leave only from locked to confirmed", () => {
    expect(APPOINTMENT_STATUSES.filter(canWithdraw)).toEqual(["PARTICIPANTS_LOCKED", "PLANNING", "CONFIRMED"]);
  });

  it("yes voters are the default attendees", () => {
    expect(yesVoterIds([{ userId: "a", vote: "yes" }, { userId: "b", vote: "no" }, { userId: "c", vote: "yes" }])).toEqual(["a", "c"]);
  });

  it("overdue only for someone who has not answered after the deadline", () => {
    const now = new Date("2026-11-20T10:00:00Z");
    const past = new Date("2026-11-19T10:00:00Z");
    expect(isOverdue(past, "invited", now)).toBe(true);
    expect(isOverdue(past, "accepted", now)).toBe(false);
    expect(isOverdue(past, "declined", now)).toBe(false);
    expect(isOverdue(new Date("2026-11-21T10:00:00Z"), "invited", now)).toBe(false);
    expect(isOverdue(undefined, "invited", now)).toBe(false);
  });
});

describe("compareForList", () => {
  const row = (status: AppointmentStatus, extra: Partial<{ needsReply: boolean; startAt: string; createdAt: string }> = {}) => ({ status, needsReply: false, startAt: "2026-11-20T10:00:00Z", createdAt: "2026-11-01T00:00:00Z", ...extra });
  it("puts waiting-for-me first, then confirmed, planning, locked, inviting, draft", () => {
    const list = [row("DRAFT"), row("INVITING"), row("PARTICIPANTS_LOCKED"), row("PLANNING"), row("CONFIRMED"), row("INVITING", { needsReply: true })];
    expect(list.sort(compareForList).map((r) => `${r.status}${r.needsReply ? "!" : ""}`)).toEqual(["INVITING!", "CONFIRMED", "PLANNING", "PARTICIPANTS_LOCKED", "INVITING", "DRAFT"]);
  });
  it("orders confirmed ones by showtime and the rest by when they were made, earliest first", () => {
    const confirmed = [row("CONFIRMED", { startAt: "2026-11-22T10:00:00Z" }), row("CONFIRMED", { startAt: "2026-11-19T10:00:00Z" })];
    expect(confirmed.sort(compareForList).map((r) => r.startAt)).toEqual(["2026-11-19T10:00:00Z", "2026-11-22T10:00:00Z"]);
    const planning = [row("PLANNING", { createdAt: "2026-11-05T00:00:00Z" }), row("PLANNING", { createdAt: "2026-11-02T00:00:00Z" })];
    expect(planning.sort(compareForList).map((r) => r.createdAt)).toEqual(["2026-11-02T00:00:00Z", "2026-11-05T00:00:00Z"]);
  });
});
