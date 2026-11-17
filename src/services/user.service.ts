import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import {
  applyFailedAttempt,
  isLocked,
  MAX_FAILED_ATTEMPTS,
  remainingLockMinutes,
} from "@/lib/login-lockout";
import type { Locale } from "@/i18n/config";
import { MIN_PASSWORD_LENGTH, type UserRole } from "@/lib/user-constants";
import { LoginAttempt } from "@/models/login-attempt";
import { User } from "@/models/user";

export interface SessionUser {
  id: string;
  name: string;
  email?: string;
  image?: string;
  role: UserRole;
}

/** What server-side guards need: fresh data read from the database, never from the JWT. */
export interface ActiveUser {
  userId: string;
  role: UserRole;
  name: string;
  email?: string;
  username?: string;
  image?: string;
  mustChangePassword: boolean;
  /** False for accounts that only sign in with Google: there is no password to change. */
  hasPassword: boolean;
  /** The language chosen in Settings; undefined until the user picks one. */
  locale?: Locale;
}

export type AuthFailureReason =
  | "invalid"
  | "locked"
  | "throttled"
  | "email_unverified"
  | "not_registered";

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: Exclude<AuthFailureReason, "throttled"> }
  | { ok: false; reason: "throttled"; retryAfterMinutes: number };


// Valid bcrypt hash compared against when the account is unknown, so that response
// time does not reveal whether an account exists.
const TIMING_DUMMY_HASH =
  "$2b$10$CXpWORRw8Ev3CQSQf09T7.OKE1BmT8hos2yDJ.4lnEYfX1E8HOkAe";

const PASSWORD_HASH_ROUNDS = 12;

interface UserLike {
  _id: { toString(): string };
  name: string;
  email?: string | null;
  username?: string | null;
  avatar?: string | null;
  role: UserRole;
  mustChangePassword?: boolean | null;
  locale?: Locale | null;
}

function toSessionUser(doc: UserLike): SessionUser {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email ?? undefined,
    image: doc.avatar ?? undefined,
    role: doc.role,
  };
}

function toActiveUser(doc: UserLike, hasPassword: boolean): ActiveUser {
  return {
    userId: doc._id.toString(),
    role: doc.role,
    name: doc.name,
    email: doc.email ?? undefined,
    username: doc.username ?? undefined,
    image: doc.avatar ?? undefined,
    mustChangePassword: doc.mustChangePassword === true,
    hasPassword,
    locale: doc.locale ?? undefined,
  };
}

/** Login identifiers are case-insensitive: an email contains "@", anything else is a username. */
function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function identifierFilter(identifier: string): { email: string } | { username: string } {
  return identifier.includes("@") ? { email: identifier } : { username: identifier };
}

async function recordFailedAttempt(key: string, now: Date): Promise<number> {
  // Atomic increment first, so two simultaneous wrong guesses are both counted.
  const counted = await LoginAttempt.findOneAndUpdate(
    { key },
    {
      $inc: { failCount: 1 },
      $setOnInsert: { lockLevel: 0 },
      $set: { expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
    },
    { upsert: true, returnDocument: "after" },
  ).lean();

  if (counted.failCount < MAX_FAILED_ATTEMPTS) return 0;

  const outcome = applyFailedAttempt(
    { failCount: counted.failCount - 1, lockLevel: counted.lockLevel },
    now,
  );
  // Only the request that still sees this failCount applies the lock (compare-and-set).
  const locked = await LoginAttempt.findOneAndUpdate(
    { key, failCount: counted.failCount },
    {
      $set: {
        failCount: outcome.failCount,
        lockLevel: outcome.lockLevel,
        lockedUntil: outcome.lockedUntil,
        expiresAt: outcome.expiresAt,
      },
    },
    { returnDocument: "after" },
  ).lean();
  const state = locked ?? { ...outcome };
  return remainingLockMinutes(
    { failCount: state.failCount, lockLevel: state.lockLevel, lockedUntil: state.lockedUntil },
    now,
  );
}

/**
 * Verifies an email-or-username and password pair, with progressive lockout after repeated failures.
 * While a lock is active even the correct password is refused. A locked account (status) only reports
 * "locked" after the password is correct.
 */
export async function authenticateWithPassword(
  identifierInput: string,
  password: string,
  now: Date = new Date(),
): Promise<AuthResult> {
  await connectToDatabase();
  const identifier = normalizeIdentifier(identifierInput);

  const attempt = await LoginAttempt.findOne({ key: identifier }).lean();
  if (attempt && isLocked(attempt, now)) {
    return {
      ok: false,
      reason: "throttled",
      retryAfterMinutes: remainingLockMinutes(attempt, now),
    };
  }

  const user = await User.findOne(identifierFilter(identifier))
    .select("+passwordHash")
    .lean();

  const hash = user?.passwordHash ?? TIMING_DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(password, hash);
  if (!user || !user.passwordHash || !passwordMatches) {
    const lockMinutes = await recordFailedAttempt(identifier, now);
    if (lockMinutes > 0) {
      return { ok: false, reason: "throttled", retryAfterMinutes: lockMinutes };
    }
    return { ok: false, reason: "invalid" };
  }

  await LoginAttempt.deleteOne({ key: identifier });
  if (user.status === "locked") return { ok: false, reason: "locked" };

  return { ok: true, user: toSessionUser(user) };
}

export interface GoogleProfileInput {
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  emailVerified?: boolean | null;
}

/**
 * Google sign-in only works for emails an admin has already created (thiết kế mục 6.1):
 * there is no public sign-up. The first Google login links the "google" provider to the account.
 */
export async function signInWithGoogleProfile(
  profile: GoogleProfileInput,
): Promise<AuthResult> {
  const email = profile.email?.trim().toLowerCase();
  if (!email || profile.emailVerified !== true) {
    return { ok: false, reason: "email_unverified" };
  }

  await connectToDatabase();
  const user = await User.findOne({ email }).lean();
  if (!user) return { ok: false, reason: "not_registered" };
  if (user.status === "locked") return { ok: false, reason: "locked" };

  const update: Record<string, unknown> = { $addToSet: { authProviders: "google" } };
  if (!user.avatar && profile.picture) update.$set = { avatar: profile.picture };
  await User.updateOne({ _id: user._id }, update);

  return { ok: true, user: toSessionUser(user) };
}

/** Loads the session payload for an existing user, or null when the user is missing or locked. */
export async function findActiveSessionUserByEmail(
  email: string,
): Promise<SessionUser | null> {
  await connectToDatabase();
  const user = await User.findOne({ email: email.trim().toLowerCase() }).lean();
  if (!user || user.status === "locked") return null;
  return toSessionUser(user);
}

/** Fresh read for guards: null when the user no longer exists or has been locked. */
export async function findActiveUserById(id: string): Promise<ActiveUser | null> {
  await connectToDatabase();
  // The hash is read only to tell whether one exists; it is never returned.
  const user = await User.findById(id).select("+passwordHash").lean().catch(() => null);
  if (!user || user.status === "locked") return null;
  return toActiveUser(user, Boolean(user.passwordHash));
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "wrong_current" | "same_password" | "too_short" | "no_password" };

/** Lets a signed-in user replace their password (also clears the "must change" flag). */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "too_short" };
  if (newPassword === currentPassword) return { ok: false, reason: "same_password" };

  await connectToDatabase();
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) return { ok: false, reason: "wrong_current" };
  if (!user.passwordHash) return { ok: false, reason: "no_password" };

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) return { ok: false, reason: "wrong_current" };

  user.passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
  user.mustChangePassword = false;
  await user.save();
  return { ok: true };
}

/** The language the user chose in Settings, or null when they never chose one. */
export async function getUserLocale(userId: string): Promise<Locale | null> {
  await connectToDatabase();
  const user = await User.findById(userId).select("locale").lean().catch(() => null);
  return user?.locale ?? null;
}

/** Saves the user's interface language. */
export async function setUserLocale(userId: string, locale: Locale): Promise<void> {
  await connectToDatabase();
  await User.updateOne({ _id: userId }, { locale }).catch(() => undefined);
}

/** Clears the failed-login counter for an account (used when an admin resets a password). */
export async function clearLoginAttempts(identifiers: string[]): Promise<void> {
  await connectToDatabase();
  const keys = identifiers.map(normalizeIdentifier).filter(Boolean);
  if (keys.length > 0) await LoginAttempt.deleteMany({ key: { $in: keys } });
}
