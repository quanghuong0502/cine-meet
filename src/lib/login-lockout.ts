/**
 * Progressive lockout for failed password logins (thiết kế mục 6.1).
 * Every 5 consecutive failures start a lock; each new lock lasts twice as long as the previous one:
 * 15 min, 30 min, 1 h, 2 h, ... capped at 24 h. Pure functions so they are easy to test.
 */

export const MAX_FAILED_ATTEMPTS = 5;
export const BASE_LOCK_MINUTES = 15;
export const MAX_LOCK_MINUTES = 24 * 60;
/** The counter forgets everything after this long without a failed attempt. */
export const ATTEMPT_MEMORY_MS = 24 * 60 * 60 * 1000;

const MS_PER_MINUTE = 60 * 1000;

export interface LoginAttemptState {
  /** Consecutive failures since the last lock (or since the start). */
  failCount: number;
  /** How many locks have been applied so far. */
  lockLevel: number;
  lockedUntil?: Date | null;
}

/** Lock length in minutes for the n-th lock (1-based): 15, 30, 60, ... capped at 24 h. */
export function lockDurationMinutes(lockLevel: number): number {
  if (lockLevel < 1) return 0;
  const minutes = BASE_LOCK_MINUTES * 2 ** (lockLevel - 1);
  return Math.min(minutes, MAX_LOCK_MINUTES);
}

export function isLocked(state: LoginAttemptState | null | undefined, now: Date): boolean {
  return Boolean(state?.lockedUntil && state.lockedUntil.getTime() > now.getTime());
}

/** Whole minutes left on the lock, rounded up so the UI never says "0 minutes" while still locked. */
export function remainingLockMinutes(state: LoginAttemptState, now: Date): number {
  if (!isLocked(state, now) || !state.lockedUntil) return 0;
  return Math.ceil((state.lockedUntil.getTime() - now.getTime()) / MS_PER_MINUTE);
}

export interface FailureOutcome extends LoginAttemptState {
  /** When the stored record can be deleted (TTL) if nothing else happens. */
  expiresAt: Date;
}

/** State after one more failed attempt. */
export function applyFailedAttempt(
  state: LoginAttemptState | null | undefined,
  now: Date,
): FailureOutcome {
  let failCount = (state?.failCount ?? 0) + 1;
  let lockLevel = state?.lockLevel ?? 0;
  let lockedUntil = state?.lockedUntil ?? null;

  if (failCount >= MAX_FAILED_ATTEMPTS) {
    lockLevel += 1;
    failCount = 0;
    lockedUntil = new Date(now.getTime() + lockDurationMinutes(lockLevel) * MS_PER_MINUTE);
  }

  const memoryStart = lockedUntil && lockedUntil.getTime() > now.getTime() ? lockedUntil : now;
  return {
    failCount,
    lockLevel,
    lockedUntil,
    expiresAt: new Date(memoryStart.getTime() + ATTEMPT_MEMORY_MS),
  };
}
