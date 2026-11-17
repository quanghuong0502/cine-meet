import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

let svc: typeof import("./admin-user.service");
let auth: typeof import("./user.service");
let User: typeof import("@/models/user").User;
let LoginAttempt: typeof import("@/models/login-attempt").LoginAttempt;
let AuditLog: typeof import("@/models/audit-log").AuditLog;

const ADMIN_ID = new Types.ObjectId().toString();

beforeAll(async () => {
  await startTestDatabase();
  svc = await import("./admin-user.service");
  auth = await import("./user.service");
  ({ User } = await import("@/models/user"));
  ({ LoginAttempt } = await import("@/models/login-attempt"));
  ({ AuditLog } = await import("@/models/audit-log"));
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase();
  await Promise.all([User.init(), LoginAttempt.init()]);
}, 120_000);

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), LoginAttempt.deleteMany({}), AuditLog.deleteMany({})]);
});

const newUser = (extra: Partial<Parameters<typeof svc.createUser>[0]> = {}) =>
  svc.createUser({ name: "Lan", username: "lan", role: "user", temporaryPassword: "temp-pass-1", ...extra }, ADMIN_ID);

async function makeAdmin(name: string, status: "active" | "locked" = "active") {
  const doc = await User.create({
    name, username: name.toLowerCase(), role: "admin", status, authProviders: ["credentials"],
    passwordHash: await bcrypt.hash("x-password-1", 4),
  });
  return doc._id.toString();
}

describe("create", () => {
  it("makes a password account that must change its password, and can sign in with the temporary one", async () => {
    const result = await newUser({ email: "lan@example.com" });
    expect(result.ok).toBe(true);
    const signIn = await auth.authenticateWithPassword("lan", "temp-pass-1");
    expect(signIn.ok).toBe(true);
    const active = await auth.findActiveUserById(result.ok ? result.data.id : "");
    expect(active?.mustChangePassword).toBe(true);
    expect(active?.role).toBe("user");
  });

  it("refuses a taken username or email, ignoring case", async () => {
    await newUser({ email: "lan@example.com" });
    expect(await newUser({ username: "LAN" })).toEqual({ ok: false, error: "duplicate" });
    expect(await newUser({ username: "other", email: "LAN@example.com" })).toEqual({ ok: false, error: "duplicate" });
  });

  it("never stores or logs the temporary password in clear", async () => {
    await newUser();
    const logged = JSON.stringify(await AuditLog.find({}).lean());
    expect(logged).not.toContain("temp-pass-1");
    expect(logged).not.toMatch(/passwordHash/i);
  });
});

describe("create input", () => {
  const codes = (input: object) => {
    const result = svc.createUserInputSchema.safeParse(input);
    return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
  };
  const base = { name: "Lan", role: "user", temporaryPassword: "temp-pass-1" };

  it("needs a username or an email", () => {
    expect(codes({ ...base })).toEqual({ username: "required" });
    expect(codes({ ...base, username: "lan" })).toEqual({});
    expect(codes({ ...base, email: "lan@example.com" })).toEqual({});
  });

  it("checks formats and the password length, with codes", () => {
    expect(codes({ ...base, username: "a b" })).toEqual({ username: "invalid" });
    expect(codes({ ...base, email: "nope" })).toEqual({ email: "invalid" });
    expect(codes({ ...base, username: "lan", temporaryPassword: "short" })).toEqual({ temporaryPassword: "too_short" });
    expect(codes({ ...base, username: "lan", temporaryPassword: "has space 1" })).toEqual({ temporaryPassword: "invalid" });
    expect(codes({ ...base, username: "lan", role: "owner" })).toHaveProperty("role");
  });
});

describe("role", () => {
  it("changes the name and role", async () => {
    const created = await newUser();
    if (!created.ok) throw new Error("setup failed");
    expect((await svc.updateUser(created.data.id, { name: "Lan Anh", role: "admin" }, ADMIN_ID)).ok).toBe(true);
    expect((await svc.getManagedUser(created.data.id))?.role).toBe("admin");
  });

  it("does not demote the last active admin, but may when another remains", async () => {
    const only = await makeAdmin("Solo");
    expect(await svc.updateUser(only, { name: "Solo", role: "user" }, only)).toEqual({ ok: false, error: "last_admin" });
    expect((await svc.getManagedUser(only))?.role).toBe("admin");

    const second = await makeAdmin("Second");
    expect((await svc.updateUser(only, { name: "Solo", role: "user" }, second)).ok).toBe(true);
    // A locked admin does not count as a remaining admin.
    await svc.setUserStatus(only, "locked", second).catch(() => undefined);
    expect(await svc.updateUser(second, { name: "Second", role: "user" }, second)).toEqual({ ok: false, error: "last_admin" });
  });

  it("reports an unknown id", async () => {
    expect(await svc.updateUser(new Types.ObjectId().toString(), { name: "X", role: "user" }, ADMIN_ID)).toEqual({ ok: false, error: "not_found" });
    expect(await svc.updateUser("nope", { name: "X", role: "user" }, ADMIN_ID)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("lock", () => {
  it("a locked account cannot sign in and its open session is refused at the next request", async () => {
    const created = await newUser();
    if (!created.ok) throw new Error("setup failed");
    const id = created.data.id;
    expect(await auth.findActiveUserById(id)).not.toBeNull();

    expect((await svc.setUserStatus(id, "locked", ADMIN_ID)).ok).toBe(true);
    expect(await auth.findActiveUserById(id)).toBeNull();
    expect(await auth.authenticateWithPassword("lan", "temp-pass-1")).toEqual({ ok: false, reason: "locked" });

    expect((await svc.setUserStatus(id, "active", ADMIN_ID)).ok).toBe(true);
    expect((await auth.authenticateWithPassword("lan", "temp-pass-1")).ok).toBe(true);
  });

  it("refuses to lock yourself or the last active admin", async () => {
    const only = await makeAdmin("Solo");
    expect(await svc.setUserStatus(only, "locked", only)).toEqual({ ok: false, error: "self" });
    const other = await makeAdmin("Other");
    await svc.setUserStatus(other, "locked", only);
    const user = await newUser();
    if (!user.ok) throw new Error("setup failed");
    expect(await svc.setUserStatus(only, "locked", user.data.id)).toEqual({ ok: false, error: "last_admin" });
  });

  it("unlocking forgives the failed-login counter", async () => {
    const created = await newUser();
    if (!created.ok) throw new Error("setup failed");
    for (let i = 0; i < 5; i += 1) await auth.authenticateWithPassword("lan", "wrong-password");
    expect(await auth.authenticateWithPassword("lan", "temp-pass-1")).toMatchObject({ reason: "throttled" });
    await svc.setUserStatus(created.data.id, "active", ADMIN_ID);
    expect((await auth.authenticateWithPassword("lan", "temp-pass-1")).ok).toBe(true);
  });
});

describe("reset password", () => {
  it("sets a new temporary password, forces a change and clears the lockout", async () => {
    const created = await newUser();
    if (!created.ok) throw new Error("setup failed");
    const id = created.data.id;
    await User.updateOne({ _id: id }, { mustChangePassword: false });
    for (let i = 0; i < 5; i += 1) await auth.authenticateWithPassword("lan", "wrong-password");

    expect(await svc.resetPassword(id, "brand-new-pw", ADMIN_ID)).toEqual({ ok: true, data: null });
    expect(await auth.authenticateWithPassword("lan", "temp-pass-1")).toEqual({ ok: false, reason: "invalid" });
    expect((await auth.authenticateWithPassword("lan", "brand-new-pw")).ok).toBe(true);
    expect((await auth.findActiveUserById(id))?.mustChangePassword).toBe(true);
    expect(JSON.stringify(await AuditLog.find({}).lean())).not.toContain("brand-new-pw");
  });

  it("refuses an account without a password and an unknown id", async () => {
    const google = await User.create({ name: "G", email: "g@example.com", authProviders: ["google"] });
    expect(await svc.resetPassword(google._id.toString(), "brand-new-pw", ADMIN_ID)).toEqual({ ok: false, error: "no_password" });
    expect(await svc.resetPassword(new Types.ObjectId().toString(), "brand-new-pw", ADMIN_ID)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("list", () => {
  it("searches name, username, email and phone ignoring case, newest first", async () => {
    await newUser({ name: "Lan Anh", username: "lan", email: "lan@example.com" });
    await newUser({ name: "Minh", username: "minh" });
    await User.updateOne({ username: "minh" }, { phone: "84912345678" });
    expect((await svc.listUsers()).map((u) => u.username)).toEqual(["minh", "lan"]);
    expect((await svc.listUsers({ q: "ANH" })).map((u) => u.username)).toEqual(["lan"]);
    expect((await svc.listUsers({ q: "example.com" })).map((u) => u.username)).toEqual(["lan"]);
    expect((await svc.listUsers({ q: "0912" })).length).toBe(0);
    expect((await svc.listUsers({ q: "84912" })).map((u) => u.username)).toEqual(["minh"]);
    expect((await svc.listUsers({ q: ".*" })).length).toBe(0);
  });
});
