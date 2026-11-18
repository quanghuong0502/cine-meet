import { describe, expect, it } from "vitest";
import { APPOINTMENT_STATUSES, canTransition, canWithdraw, isOverdue, yesVoterIds, type AppointmentStatus } from "./state";

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
