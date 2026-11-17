import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

let svc: typeof import("./profile.service");
let User: typeof import("@/models/user").User;

beforeAll(async () => {
  await startTestDatabase();
  svc = await import("./profile.service");
  ({ User } = await import("@/models/user"));
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase();
  await User.init();
}, 120_000);

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await User.deleteMany({});
});

async function makeUser(username: string, extra: Record<string, unknown> = {}) {
  const doc = await User.create({ name: username, username, authProviders: ["credentials"], ...extra });
  return doc._id.toString();
}

const parse = (input: Record<string, string | undefined>) => svc.profileInputSchema.safeParse(input);

describe("profile input", () => {
  it("normalises the phone and reads the seat preference", () => {
    const result = parse({ name: "Lan", phone: "0912 345 678", seatPreference: "aisle" });
    expect(result.success && result.data).toMatchObject({ phone: "84912345678", seatPreference: "aisle" });
  });

  it("treats an empty phone, 'any' and a missing avatar as 'not set'", () => {
    const result = parse({ name: "Lan", seatPreference: "any" });
    if (!result.success) throw new Error("should parse");
    expect(result.data.phone).toBeUndefined();
    expect(result.data.seatPreference).toBeUndefined();
    expect(result.data.avatar).toBeUndefined();
  });

  it("returns codes for a bad phone, a missing name and an unknown seat preference", () => {
    const codes = (input: Record<string, string | undefined>) => {
      const result = parse(input);
      return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
    };
    expect(codes({ name: "Lan", phone: "123" })).toEqual({ phone: "invalid" });
    expect(codes({ phone: "0912345678" })).toHaveProperty("name");
    expect(codes({ name: "Lan", seatPreference: "roof" })).toEqual({ seatPreference: "invalid" });
  });
});

describe("profile storage", () => {
  it("saves and reads back", async () => {
    const id = await makeUser("lan");
    const parsed = parse({ name: "Lan Anh", phone: "0912345678", seatPreference: "back", avatar: "https://res.cloudinary.com/x/image/upload/a.jpg" });
    if (!parsed.success) throw new Error("setup failed");
    expect(await svc.updateProfile(id, parsed.data)).toEqual({ ok: true });
    expect(await svc.getProfile(id)).toMatchObject({ name: "Lan Anh", phone: "84912345678", seatPreference: "back", avatar: expect.stringContaining("cloudinary") });
  });

  it("removes a phone, avatar or preference that the form left empty", async () => {
    const id = await makeUser("lan", { phone: "84912345678", avatar: "https://x/a.jpg", seatPreference: "front" });
    const parsed = parse({ name: "Lan" });
    if (!parsed.success) throw new Error("setup failed");
    await svc.updateProfile(id, parsed.data);
    const profile = await svc.getProfile(id);
    expect(profile?.phone).toBeUndefined();
    expect(profile?.avatar).toBeUndefined();
    expect(profile?.seatPreference).toBeUndefined();
  });

  it("refuses a phone another account uses, but lets two accounts have none", async () => {
    await makeUser("an", { phone: "84912345678" });
    const id = await makeUser("binh");
    const taken = parse({ name: "Binh", phone: "0912345678" });
    if (!taken.success) throw new Error("setup failed");
    expect(await svc.updateProfile(id, taken.data)).toEqual({ ok: false, error: "phone_taken" });

    const none = parse({ name: "Binh" });
    if (!none.success) throw new Error("setup failed");
    await makeUser("chi");
    expect(await svc.updateProfile(id, none.data)).toEqual({ ok: true });
  });

  it("keeps your own phone when saving again", async () => {
    const id = await makeUser("lan", { phone: "84912345678" });
    const parsed = parse({ name: "Lan 2", phone: "+84 912 345 678" });
    if (!parsed.success) throw new Error("setup failed");
    expect(await svc.updateProfile(id, parsed.data)).toEqual({ ok: true });
  });

  it("reports an unknown account", async () => {
    const parsed = parse({ name: "X" });
    if (!parsed.success) throw new Error("setup failed");
    expect(await svc.updateProfile("6afbb4609e156d9ab456f6d3", parsed.data)).toEqual({ ok: false, error: "not_found" });
    expect(await svc.getProfile("nope")).toBeNull();
  });
});
