import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

describe("friend service", () => {
  let svc: typeof import("./friend.service");
  let User: typeof import("@/models/user").User;
  let Friendship: typeof import("@/models/friendship").Friendship;
  let Lookup: typeof import("@/models/friend-lookup").FriendLookup;
  let Notification: typeof import("@/models/notification").Notification;
  let a: string;
  let b: string;
  let c: string;

  beforeAll(async () => {
    await startTestDatabase();
    svc = await import("./friend.service");
    User = (await import("@/models/user")).User;
    Friendship = (await import("@/models/friendship")).Friendship;
    Lookup = (await import("@/models/friend-lookup")).FriendLookup;
    Notification = (await import("@/models/notification")).Notification;
    const { connectToDatabase } = await import("@/lib/db");
    await connectToDatabase();
    await Friendship.init();
    await User.init();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Friendship.deleteMany({}), Lookup.deleteMany({}), Notification.deleteMany({}), (await import("@/models/friend-group")).FriendGroup.deleteMany({})]);
    const make = (name: string, phone: string, extra = {}) => User.create({ name, username: name, phone, ...extra });
    a = String((await make("an", "84911111111"))._id);
    b = String((await make("binh", "84922222222"))._id);
    c = String((await make("chi", "84933333333"))._id);
  });

  it("a request by phone needs the other person to accept", async () => {
    expect(await svc.requestByPhone(a, "0922 222 222")).toEqual({ ok: true });
    expect((await svc.getFriendOverview(a)).friends).toHaveLength(0);
    const incoming = (await svc.getFriendOverview(b)).incoming;
    expect(incoming.map((p) => p.name)).toEqual(["an"]);
    expect(await svc.respondToRequest(b, incoming[0]!.friendshipId, true)).toEqual({ ok: true });
    expect((await svc.getFriendOverview(a)).friends.map((p) => p.name)).toEqual(["binh"]);
  });

  it("gives the same answer for a number with no account, a friend, or yourself", async () => {
    const unknown = await svc.requestByPhone(a, "0999 999 999");
    const self = await svc.requestByPhone(a, "0911 111 111");
    expect(unknown).toEqual({ ok: true });
    expect(self).toEqual({ ok: true });
    expect(await Friendship.countDocuments()).toBe(0);
  });

  it("rejects a text that is not a mobile number", async () => {
    expect(await svc.requestByPhone(a, "123")).toEqual({ ok: false, error: "invalid_phone" });
  });

  it("limits phone lookups per hour", async () => {
    const { MAX_LOOKUPS_PER_HOUR } = await import("@/lib/friend-constants");
    for (let i = 0; i < MAX_LOOKUPS_PER_HOUR; i++) expect(await svc.requestByPhone(a, "0999 999 999")).toEqual({ ok: true });
    expect(await svc.requestByPhone(a, "0922 222 222")).toEqual({ ok: false, error: "throttled" });
    expect(await Friendship.countDocuments()).toBe(0);
    // Another person is not affected.
    expect(await svc.requestByPhone(b, "0933 333 333")).toEqual({ ok: true });
  });

  it("asking someone who already asked you makes you friends", async () => {
    await svc.requestByPhone(a, "0922222222");
    await svc.requestByPhone(b, "0911111111");
    expect((await svc.getFriendOverview(a)).friends.map((p) => p.name)).toEqual(["binh"]);
    expect(await Friendship.countDocuments()).toBe(1);
  });

  it("declining deletes the request; only the receiver can answer", async () => {
    await svc.requestByPhone(a, "0922222222");
    const id = (await svc.getFriendOverview(b)).incoming[0]!.friendshipId;
    expect(await svc.respondToRequest(a, id, true)).toEqual({ ok: false, error: "not_found" });
    expect(await svc.respondToRequest(b, id, false)).toEqual({ ok: true });
    expect(await Friendship.countDocuments()).toBe(0);
  });

  it("does not request a locked account", async () => {
    await User.updateOne({ _id: b }, { status: "locked" });
    await svc.requestByPhone(a, "0922222222");
    expect(await Friendship.countDocuments()).toBe(0);
  });

  it("invite link: code is stable, request works, self and unknown code fail", async () => {
    const code = await svc.getInviteCode(a);
    expect(code).toBeTruthy();
    expect(await svc.getInviteCode(a)).toBe(code);
    expect((await svc.findInviter(code!))?.name).toBe("an");
    expect(await svc.requestByInviteCode(b, code!)).toEqual({ ok: true, outcome: "sent" });
    expect(await svc.requestByInviteCode(b, code!)).toEqual({ ok: true, outcome: "already_requested" });
    expect(await svc.requestByInviteCode(a, code!)).toEqual({ ok: false, error: "self" });
    expect(await svc.requestByInviteCode(a, "zzzzzzzzzzzzzz")).toEqual({ ok: false, error: "not_found" });
    // a opens b's link while b's request to a is pending: becomes friends.
    const second = (await svc.getInviteCode(b))!;
    expect(await svc.requestByInviteCode(a, second)).toEqual({ ok: true, outcome: "accepted" });
  });

  it("filterFriendIds keeps only accepted friends", async () => {
    await svc.requestByPhone(a, "0922222222");
    await svc.respondToRequest(b, (await svc.getFriendOverview(b)).incoming[0]!.friendshipId, true);
    await svc.requestByPhone(a, "0933333333"); // pending only
    expect(await svc.filterFriendIds(a, [b, c, a, "nope"])).toEqual([b]);
  });

  it("removing a friend also drops them from groups", async () => {
    await svc.requestByPhone(a, "0922222222");
    await svc.respondToRequest(b, (await svc.getFriendOverview(b)).incoming[0]!.friendshipId, true);
    expect(await svc.saveGroup(a, { name: "Team", memberIds: [b, c] })).toEqual({ ok: false, error: "invalid" });
    expect(await svc.saveGroup(a, { name: "Team", memberIds: [b] })).toEqual({ ok: true });
    expect((await svc.listGroups(a))[0]?.members.map((p) => p.name)).toEqual(["binh"]);
    expect(await svc.removeFriendship(b, a)).toEqual({ ok: true });
    expect((await svc.listGroups(a))[0]?.members).toEqual([]);
  });

  describe("notifications", () => {
    const sent = async () => (await Notification.find({}).sort({ createdAt: 1 }).lean()).map((n) => [String(n.recipientId), n.type, (n.payload as { actorName: string }).actorName]);

    it("a new request tells only the person asked, with the asker's name", async () => {
      await svc.requestByPhone(a, "0922222222");
      expect(await sent()).toEqual([[b, "friend_request", "an"]]);
    });

    it("saying yes tells the person who asked; saying no tells nobody", async () => {
      await svc.requestByPhone(a, "0922222222");
      await svc.requestByPhone(c, "0911111111");
      await Notification.deleteMany({});
      const incoming = (await svc.getFriendOverview(b)).incoming[0]!.friendshipId;
      await svc.respondToRequest(b, incoming, true);
      expect(await sent()).toEqual([[a, "friend_accepted", "binh"]]);
      await Notification.deleteMany({});
      const second = (await svc.getFriendOverview(a)).incoming[0]!.friendshipId;
      await svc.respondToRequest(a, second, false);
      expect(await sent()).toEqual([]);
    });

    it("asking someone who already asked you accepts it and tells them", async () => {
      await svc.requestByPhone(a, "0922222222");
      await Notification.deleteMany({});
      await svc.requestByPhone(b, "0911111111");
      expect(await sent()).toEqual([[a, "friend_accepted", "binh"]]);
    });

    it("asking again, an unknown number, or yourself tells nobody", async () => {
      await svc.requestByPhone(a, "0922222222");
      await Notification.deleteMany({});
      await svc.requestByPhone(a, "0922222222");
      await svc.requestByPhone(a, "0999999999");
      await svc.requestByPhone(a, "0911111111");
      expect(await sent()).toEqual([]);
    });

    it("a request from an invite link tells the owner of the link", async () => {
      const code = (await svc.getInviteCode(a))!;
      await svc.requestByInviteCode(b, code);
      expect(await sent()).toEqual([[a, "friend_request", "binh"]]);
    });
  });
});
