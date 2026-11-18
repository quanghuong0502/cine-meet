import { Friendship } from "@/models/friendship";
import { User } from "@/models/user";
import { pairKey } from "@/services/friend.service";

export interface BefriendReport {
  accounts: string[];
  pairs: number;
  created: number;
  converted: number;
  already: number;
}

/**
 * Makes every active regular account (role "user") a friend of every other one. Looks first, so an existing friendship is never touched
 * and the report is exact; a pending request between two accounts becomes accepted. Admins are left out. Needs a database connection.
 */
export async function befriendEveryone(): Promise<BefriendReport> {
  await Friendship.init();
  const users = await User.find({ role: "user", status: "active" }, "_id name").sort({ createdAt: 1 }).lean();

  const pairs: { a: string; b: string; key: string }[] = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const a = users[i]!._id.toString();
      const b = users[j]!._id.toString();
      pairs.push({ a, b, key: pairKey(a, b) });
    }
  }

  const existing = pairs.length > 0 ? await Friendship.find({ pairKey: { $in: pairs.map((p) => p.key) } }, "pairKey status").lean() : [];
  const statusByKey = new Map(existing.map((f) => [f.pairKey, f.status]));
  const todo = pairs.filter((p) => statusByKey.get(p.key) !== "accepted");
  const created = todo.filter((p) => !statusByKey.has(p.key)).length;

  if (todo.length > 0) {
    await Friendship.bulkWrite(
      todo.map((p) => ({
        updateOne: {
          filter: { pairKey: p.key },
          update: { $set: { status: "accepted" as const }, $setOnInsert: { userA: p.a, userB: p.b, pairKey: p.key } },
          upsert: true,
        },
      })),
    );
  }
  return { accounts: users.map((u) => u.name), pairs: pairs.length, created, converted: todo.length - created, already: pairs.length - todo.length };
}

export function describeReport(report: BefriendReport): string {
  return `${report.accounts.length} tài khoản, ${report.pairs} cặp: tạo mới ${report.created}, chuyển từ lời mời sang bạn bè ${report.converted}, đã là bạn từ trước ${report.already}.`;
}
