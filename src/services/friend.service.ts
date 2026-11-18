import { randomBytes } from "node:crypto";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { MAX_GROUP_NAME, MAX_GROUPS, MAX_LOOKUPS_PER_HOUR } from "@/lib/friend-constants";
import { normalizeVietnamPhone } from "@/lib/phone";
import { FriendGroup } from "@/models/friend-group";
import { FriendLookup } from "@/models/friend-lookup";
import { Friendship } from "@/models/friendship";
import { User } from "@/models/user";

export interface PersonView {
  id: string;
  name: string;
  avatar?: string;
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

function toPerson(user: { _id: { toString(): string }; name: string; avatar?: string | null }): PersonView {
  return { id: user._id.toString(), name: user.name, avatar: user.avatar ?? undefined };
}

/** The code in this person's invite link; made on first use and kept after. */
export async function getInviteCode(userId: string): Promise<string | null> {
  await connectToDatabase();
  const user = await User.findById(userId, "inviteCode").lean().catch(() => null);
  if (!user) return null;
  if (user.inviteCode) return user.inviteCode;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomBytes(12).toString("base64url");
    try {
      // Only fills an empty code: two tabs opening at once end up with the same code.
      const updated = await User.findOneAndUpdate({ _id: userId, inviteCode: { $exists: false } }, { $set: { inviteCode: code } }, { returnDocument: "after" }).lean();
      if (updated?.inviteCode) return updated.inviteCode;
      const current = await User.findById(userId, "inviteCode").lean();
      if (current?.inviteCode) return current.inviteCode;
    } catch {
      // Code clash (practically impossible): try another.
    }
  }
  return null;
}

/** Who owns an invite link, for the page that opens it. Locked accounts count as not found. */
export async function findInviter(code: string): Promise<PersonView | null> {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(code)) return null;
  await connectToDatabase();
  const user = await User.findOne({ inviteCode: code, status: "active" }, "name avatar").lean();
  return user ? toPerson(user) : null;
}

export type RequestResult =
  | { ok: true; outcome: "sent" | "accepted" | "already_friends" | "already_requested" }
  | { ok: false; error: "not_found" | "self" };

/** Adds a request from `userId` to `targetId`, or accepts one the other person already sent. */
async function requestFriendship(userId: string, targetId: string): Promise<RequestResult> {
  if (userId === targetId) return { ok: false, error: "self" };
  const key = pairKey(userId, targetId);
  const existing = await Friendship.findOne({ pairKey: key }).lean();
  if (existing) {
    if (existing.status === "accepted") return { ok: true, outcome: "already_friends" };
    // They asked first: asking back is the same as saying yes.
    if (existing.userB.toString() === userId) {
      await Friendship.updateOne({ _id: existing._id }, { $set: { status: "accepted" } });
      return { ok: true, outcome: "accepted" };
    }
    return { ok: true, outcome: "already_requested" };
  }
  try {
    await Friendship.create({ userA: userId, userB: targetId, pairKey: key, status: "pending" });
  } catch (error) {
    // Both sides asked at once: the other row won, so treat it as already asked.
    if ((error as { code?: number }).code === 11000) return { ok: true, outcome: "already_requested" };
    throw error;
  }
  return { ok: true, outcome: "sent" };
}

export type PhoneRequestResult = { ok: true } | { ok: false; error: "invalid_phone" | "throttled" };

/**
 * Friend request by phone number. The answer is the same whether or not the number has an account (and whether the two are already
 * friends), so nobody can use this to find out who is on the app. Every lookup counts toward an hourly limit.
 */
export async function requestByPhone(userId: string, rawPhone: string): Promise<PhoneRequestResult> {
  const phone = normalizeVietnamPhone(rawPhone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  await connectToDatabase();

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const used = await FriendLookup.countDocuments({ userId, at: { $gte: since } });
  if (used >= MAX_LOOKUPS_PER_HOUR) return { ok: false, error: "throttled" };
  await FriendLookup.create({ userId });

  const target = await User.findOne({ phone, status: "active", role: "user" }, "_id").lean();
  if (target) await requestFriendship(userId, target._id.toString());
  return { ok: true };
}

/** Friend request from an invite link (the link already shows who it belongs to, so the answer can be specific). */
export async function requestByInviteCode(userId: string, code: string): Promise<RequestResult> {
  const inviter = await findInviter(code);
  if (!inviter) return { ok: false, error: "not_found" };
  await connectToDatabase();
  return requestFriendship(userId, inviter.id);
}

export type RespondResult = { ok: true } | { ok: false; error: "not_found" };

/** The person who got a request answers it: yes keeps it, no deletes it (they can be asked again). */
export async function respondToRequest(userId: string, friendshipId: string, accept: boolean): Promise<RespondResult> {
  if (!isValidObjectId(friendshipId)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const filter = { _id: friendshipId, userB: userId, status: "pending" as const };
  const result = accept ? await Friendship.updateOne(filter, { $set: { status: "accepted" } }) : await Friendship.deleteOne(filter);
  const changed = accept ? (result as { modifiedCount: number }).modifiedCount : (result as { deletedCount: number }).deletedCount;
  return changed ? { ok: true } : { ok: false, error: "not_found" };
}

/** Takes back a request the person sent, or ends a friendship (either side). Also drops the person from the other one's groups. */
export async function removeFriendship(userId: string, otherId: string): Promise<RespondResult> {
  if (!isValidObjectId(otherId)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const removed = await Friendship.deleteOne({ pairKey: pairKey(userId, otherId), $or: [{ userA: userId }, { userB: userId }] });
  if (!removed.deletedCount) return { ok: false, error: "not_found" };
  await FriendGroup.updateMany({ ownerId: userId }, { $pull: { memberIds: otherId } });
  await FriendGroup.updateMany({ ownerId: otherId }, { $pull: { memberIds: userId } });
  return { ok: true };
}

export interface FriendOverview {
  friends: PersonView[];
  /** Requests waiting for this person's answer. */
  incoming: (PersonView & { friendshipId: string })[];
  /** Requests this person sent that nobody answered yet. */
  outgoing: PersonView[];
}

export async function getFriendOverview(userId: string): Promise<FriendOverview> {
  await connectToDatabase();
  const rows = await Friendship.find({ $or: [{ userA: userId }, { userB: userId }] }).sort({ updatedAt: -1 }).lean();
  const otherId = (row: { userA: Types.ObjectId; userB: Types.ObjectId }) => (row.userA.toString() === userId ? row.userB : row.userA);
  const users = await User.find({ _id: { $in: rows.map(otherId) }, status: "active" }, "name avatar").lean();
  const byId = new Map(users.map((u) => [u._id.toString(), toPerson(u)]));

  const overview: FriendOverview = { friends: [], incoming: [], outgoing: [] };
  for (const row of rows) {
    const person = byId.get(otherId(row).toString());
    if (!person) continue; // Locked accounts drop out of every list.
    if (row.status === "accepted") overview.friends.push(person);
    else if (row.userB.toString() === userId) overview.incoming.push({ ...person, friendshipId: row._id.toString() });
    else overview.outgoing.push(person);
  }
  const byName = (a: PersonView, b: PersonView) => a.name.localeCompare(b.name, "vi");
  overview.friends.sort(byName);
  return overview;
}

/** Which of these people are this person's (active) friends: the only ones an appointment may invite. */
export async function filterFriendIds(userId: string, ids: string[]): Promise<string[]> {
  const valid = [...new Set(ids)].filter((id) => isValidObjectId(id) && id !== userId);
  if (valid.length === 0) return [];
  await connectToDatabase();
  const rows = await Friendship.find({ status: "accepted", pairKey: { $in: valid.map((id) => pairKey(userId, id)) } }, "pairKey").lean();
  const keys = new Set(rows.map((r) => r.pairKey));
  const friends = valid.filter((id) => keys.has(pairKey(userId, id)));
  const active = await User.find({ _id: { $in: friends }, status: "active" }, "_id").lean();
  return active.map((u) => u._id.toString());
}

export interface GroupView {
  id: string;
  name: string;
  members: PersonView[];
}

export const groupInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, { error: "required" }).max(MAX_GROUP_NAME, { error: "too_long" }),
  memberIds: z.array(z.string()).max(100).default([]),
});
export type GroupInput = z.infer<typeof groupInputSchema>;

export type SaveGroupResult = { ok: true } | { ok: false; error: "not_found" | "too_many" | "invalid" };

export async function listGroups(userId: string): Promise<GroupView[]> {
  await connectToDatabase();
  const groups = await FriendGroup.find({ ownerId: userId }).sort({ name: 1 }).lean();
  const ids = [...new Set(groups.flatMap((g) => g.memberIds.map(String)))];
  const users = await User.find({ _id: { $in: ids }, status: "active" }, "name avatar").lean();
  const byId = new Map(users.map((u) => [u._id.toString(), toPerson(u)]));
  return groups.map((g) => ({
    id: g._id.toString(),
    name: g.name,
    members: g.memberIds.map((m) => byId.get(m.toString())).filter((p): p is PersonView => Boolean(p)),
  }));
}

/** Creates or edits one of this person's groups. Members must be current friends. */
export async function saveGroup(userId: string, input: GroupInput): Promise<SaveGroupResult> {
  await connectToDatabase();
  const memberIds = await filterFriendIds(userId, input.memberIds);
  if (memberIds.length !== new Set(input.memberIds).size) return { ok: false, error: "invalid" };
  if (input.id) {
    if (!isValidObjectId(input.id)) return { ok: false, error: "not_found" };
    const updated = await FriendGroup.updateOne({ _id: input.id, ownerId: userId }, { $set: { name: input.name, memberIds } });
    return updated.matchedCount ? { ok: true } : { ok: false, error: "not_found" };
  }
  if ((await FriendGroup.countDocuments({ ownerId: userId })) >= MAX_GROUPS) return { ok: false, error: "too_many" };
  await FriendGroup.create({ ownerId: userId, name: input.name, memberIds });
  return { ok: true };
}

export async function deleteGroup(userId: string, groupId: string): Promise<SaveGroupResult> {
  if (!isValidObjectId(groupId)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const removed = await FriendGroup.deleteOne({ _id: groupId, ownerId: userId });
  return removed.deletedCount ? { ok: true } : { ok: false, error: "not_found" };
}
