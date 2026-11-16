import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

type Service = typeof import("@/services/user.service");
type UserModel = typeof import("@/models/user").User;
type AttemptModel = typeof import("@/models/login-attempt").LoginAttempt;

let service: Service;
let User: UserModel;
let LoginAttempt: AttemptModel;

const PASSWORD = "correct-horse-1";
const NOW = new Date("2026-11-16T10:00:00.000Z");

beforeAll(async () => {
  await startTestDatabase();
  service = await import("@/services/user.service");
  ({ User } = await import("@/models/user"));
  ({ LoginAttempt } = await import("@/models/login-attempt"));
  // Models can only build their indexes once connected (bufferCommands is off).
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase();
  await Promise.all([User.init(), LoginAttempt.init()]);
}, 120_000);

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), LoginAttempt.deleteMany({})]);
  await User.create({
    name: "An",
    username: "an",
    email: "an@example.com",
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    authProviders: ["credentials"],
  });
});

async function wrongGuesses(identifier: string, times: number, now = NOW) {
  let last;
  for (let i = 0; i < times; i += 1) {
    last = await service.authenticateWithPassword(identifier, "wrong", now);
  }
  return last;
}

describe("authenticateWithPassword", () => {
  it("signs in with username or email, case-insensitively", async () => {
    const byUsername = await service.authenticateWithPassword("AN", PASSWORD, NOW);
    const byEmail = await service.authenticateWithPassword("An@Example.com", PASSWORD, NOW);
    expect(byUsername.ok).toBe(true);
    expect(byEmail.ok).toBe(true);
  });

  it("rejects a wrong password and an unknown account the same way", async () => {
    const wrong = await service.authenticateWithPassword("an", "nope", NOW);
    const unknown = await service.authenticateWithPassword("ghost", "nope", NOW);
    expect(wrong).toEqual({ ok: false, reason: "invalid" });
    expect(unknown).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks for 15 minutes after 5 wrong guesses, even for the right password", async () => {
    const fifth = await wrongGuesses("an", 5);
    expect(fifth).toEqual({ ok: false, reason: "throttled", retryAfterMinutes: 15 });

    const withRightPassword = await service.authenticateWithPassword("an", PASSWORD, NOW);
    expect(withRightPassword).toMatchObject({ ok: false, reason: "throttled" });
  });

  it("allows signing in again once the lock has expired", async () => {
    await wrongGuesses("an", 5);
    const later = new Date(NOW.getTime() + 16 * 60 * 1000);
    const result = await service.authenticateWithPassword("an", PASSWORD, later);
    expect(result.ok).toBe(true);
  });

  it("doubles the next lock to 30 minutes", async () => {
    await wrongGuesses("an", 5);
    const later = new Date(NOW.getTime() + 16 * 60 * 1000);
    const secondLock = await wrongGuesses("an", 5, later);
    expect(secondLock).toEqual({ ok: false, reason: "throttled", retryAfterMinutes: 30 });
  });

  it("clears the counter after a successful sign-in", async () => {
    await wrongGuesses("an", 4);
    await service.authenticateWithPassword("an", PASSWORD, NOW);
    const afterReset = await wrongGuesses("an", 4);
    expect(afterReset).toEqual({ ok: false, reason: "invalid" });
  });

  it("clearLoginAttempts removes a lock (used when an admin resets a password)", async () => {
    await wrongGuesses("an", 5);
    await service.clearLoginAttempts(["an", "an@example.com"]);
    const result = await service.authenticateWithPassword("an", PASSWORD, NOW);
    expect(result.ok).toBe(true);
  });

  it("reports a locked account only when the password is right", async () => {
    await User.updateOne({ username: "an" }, { status: "locked" });
    const wrong = await service.authenticateWithPassword("an", "nope", NOW);
    const right = await service.authenticateWithPassword("an", PASSWORD, NOW);
    expect(wrong).toEqual({ ok: false, reason: "invalid" });
    expect(right).toEqual({ ok: false, reason: "locked" });
  });
});

describe("signInWithGoogleProfile", () => {
  it("rejects an email nobody created, and creates nothing", async () => {
    const result = await service.signInWithGoogleProfile({
      email: "stranger@example.com",
      name: "Stranger",
      emailVerified: true,
    });
    expect(result).toEqual({ ok: false, reason: "not_registered" });
    expect(await User.countDocuments({ email: "stranger@example.com" })).toBe(0);
  });

  it("rejects an unverified Google email", async () => {
    const result = await service.signInWithGoogleProfile({
      email: "an@example.com",
      emailVerified: false,
    });
    expect(result).toEqual({ ok: false, reason: "email_unverified" });
  });

  it("links Google to an existing account without creating a second one", async () => {
    const result = await service.signInWithGoogleProfile({
      email: "AN@example.com",
      name: "An G",
      picture: "https://example.com/a.png",
      emailVerified: true,
    });
    expect(result.ok).toBe(true);
    const users = await User.find({ email: "an@example.com" }).lean();
    expect(users).toHaveLength(1);
    expect(users[0]?.authProviders).toContain("google");
    expect(users[0]?.authProviders).toContain("credentials");
  });

  it("refuses a locked account", async () => {
    await User.updateOne({ username: "an" }, { status: "locked" });
    const result = await service.signInWithGoogleProfile({
      email: "an@example.com",
      emailVerified: true,
    });
    expect(result).toEqual({ ok: false, reason: "locked" });
  });
});

describe("findActiveUserById", () => {
  it("returns null for a locked or missing account", async () => {
    const user = await User.findOne({ username: "an" });
    const id = user?._id.toString() ?? "";
    expect((await service.findActiveUserById(id))?.name).toBe("An");

    await User.updateOne({ _id: id }, { status: "locked" });
    expect(await service.findActiveUserById(id)).toBeNull();
    expect(await service.findActiveUserById("not-an-id")).toBeNull();
  });
});

describe("changePassword", () => {
  it("changes the password and clears mustChangePassword", async () => {
    await User.updateOne({ username: "an" }, { mustChangePassword: true });
    const user = await User.findOne({ username: "an" });
    const id = user?._id.toString() ?? "";

    expect(await service.changePassword(id, PASSWORD, "brand-new-pass")).toEqual({ ok: true });
    const after = await service.authenticateWithPassword("an", "brand-new-pass", NOW);
    expect(after.ok).toBe(true);
    expect((await service.findActiveUserById(id))?.mustChangePassword).toBe(false);
  });

  it("rejects a wrong current password, a same password and a short one", async () => {
    const user = await User.findOne({ username: "an" });
    const id = user?._id.toString() ?? "";
    expect(await service.changePassword(id, "wrong", "brand-new-pass")).toEqual({
      ok: false,
      reason: "wrong_current",
    });
    expect(await service.changePassword(id, PASSWORD, PASSWORD)).toEqual({
      ok: false,
      reason: "same_password",
    });
    expect(await service.changePassword(id, PASSWORD, "short")).toEqual({
      ok: false,
      reason: "too_short",
    });
  });
});

describe("saved language", () => {
  it("is null until the user chooses, then returns the choice", async () => {
    const user = await User.findOne({ username: "an" });
    const id = user?._id.toString() ?? "";
    expect(await service.getUserLocale(id)).toBeNull();

    await service.setUserLocale(id, "en");
    expect(await service.getUserLocale(id)).toBe("en");

    await service.setUserLocale(id, "vi");
    expect(await service.getUserLocale(id)).toBe("vi");
  });

  it("returns null for an unknown id", async () => {
    expect(await service.getUserLocale("not-an-id")).toBeNull();
  });
});

describe("User model", () => {
  it("requires a username or an email", async () => {
    await expect(User.create({ name: "No login id" })).rejects.toThrow();
  });

  it("allows several users without a username (sparse unique index)", async () => {
    await User.create({ name: "B", email: "b@example.com" });
    await User.create({ name: "C", email: "c@example.com" });
    expect(await User.countDocuments({ username: { $exists: false } })).toBeGreaterThanOrEqual(2);
  });
});
