import { describe, expect, it } from "vitest";
import {
  applyFailedAttempt,
  isLocked,
  lockDurationMinutes,
  MAX_LOCK_MINUTES,
  remainingLockMinutes,
  type LoginAttemptState,
} from "./login-lockout";

const NOW = new Date("2026-11-16T10:00:00.000Z");

function failTimes(times: number, start?: LoginAttemptState): ReturnType<typeof applyFailedAttempt> {
  let state: LoginAttemptState | undefined = start;
  let outcome = applyFailedAttempt(state, NOW);
  for (let i = 1; i < times; i += 1) {
    state = outcome;
    outcome = applyFailedAttempt(state, NOW);
  }
  return outcome;
}

describe("lockDurationMinutes", () => {
  it("doubles with every lock: 15, 30, 60, 120", () => {
    expect([1, 2, 3, 4].map(lockDurationMinutes)).toEqual([15, 30, 60, 120]);
  });

  it("is capped at 24 hours", () => {
    expect(lockDurationMinutes(20)).toBe(MAX_LOCK_MINUTES);
  });

  it("is zero before any lock", () => {
    expect(lockDurationMinutes(0)).toBe(0);
  });
});

describe("applyFailedAttempt", () => {
  it("does not lock before the 5th consecutive failure", () => {
    const outcome = failTimes(4);
    expect(outcome.failCount).toBe(4);
    expect(outcome.lockLevel).toBe(0);
    expect(isLocked(outcome, NOW)).toBe(false);
  });

  it("locks for 15 minutes on the 5th failure and resets the counter", () => {
    const outcome = failTimes(5);
    expect(outcome.lockLevel).toBe(1);
    expect(outcome.failCount).toBe(0);
    expect(isLocked(outcome, NOW)).toBe(true);
    expect(remainingLockMinutes(outcome, NOW)).toBe(15);
  });

  it("makes the second lock twice as long", () => {
    const afterFirstLock = failTimes(5);
    const later = new Date(NOW.getTime() + 16 * 60 * 1000);
    expect(isLocked(afterFirstLock, later)).toBe(false);

    let state: LoginAttemptState = afterFirstLock;
    let outcome = applyFailedAttempt(state, later);
    for (let i = 1; i < 5; i += 1) {
      state = outcome;
      outcome = applyFailedAttempt(state, later);
    }
    expect(outcome.lockLevel).toBe(2);
    expect(remainingLockMinutes(outcome, later)).toBe(30);
  });

  it("keeps the record at least 24 hours after the lock ends", () => {
    const outcome = failTimes(5);
    const lockEnd = outcome.lockedUntil?.getTime() ?? 0;
    expect(outcome.expiresAt.getTime()).toBeGreaterThanOrEqual(lockEnd + 24 * 60 * 60 * 1000);
  });
});

describe("isLocked", () => {
  it("is false for a missing state or an expired lock", () => {
    expect(isLocked(null, NOW)).toBe(false);
    expect(
      isLocked({ failCount: 0, lockLevel: 1, lockedUntil: new Date(NOW.getTime() - 1) }, NOW),
    ).toBe(false);
  });
});
