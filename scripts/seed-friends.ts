/**
 * Makes every active regular account (role "user") a friend of every other one, so the invite, vote and lock flows can be tried
 * with any set of test accounts without adding friends by hand. Admins are left out (they have no friends).
 * Safe to run again: pairs that are already friends are left alone, and a pending request between two accounts becomes accepted.
 * Run it again after adding more accounts. Refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1.
 *
 * Usage: npm run seed:friends   (reads .env.local if present)
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Friendship } from "@/models/friendship";
import { User } from "@/models/user";
import { pairKey } from "@/services/friend.service";

const ENV_FILE = ".env.local";

async function seedFriends(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error("Từ chối chạy ở production. Nếu thật sự muốn, đặt SEED_ALLOW_PRODUCTION=1.");
  }

  await connectToDatabase();
  await Friendship.init();

  const users = await User.find({ role: "user", status: "active" }, "_id name").sort({ createdAt: 1 }).lean();
  if (users.length < 2) {
    console.log(`Chỉ có ${users.length} tài khoản người dùng đang hoạt động, chưa có cặp bạn bè nào để tạo.`);
    return;
  }

  const pairs: { a: string; b: string; key: string }[] = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const a = users[i]!._id.toString();
      const b = users[j]!._id.toString();
      pairs.push({ a, b, key: pairKey(a, b) });
    }
  }

  // Look first, so the report is exact and an existing friendship is never touched.
  const existing = await Friendship.find({ pairKey: { $in: pairs.map((p) => p.key) } }, "pairKey status").lean();
  const statusByKey = new Map(existing.map((f) => [f.pairKey, f.status]));
  const todo = pairs.filter((p) => statusByKey.get(p.key) !== "accepted");
  const created = todo.filter((p) => !statusByKey.has(p.key)).length;
  const converted = todo.length - created;

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
  console.log(`${users.length} tài khoản, ${pairs.length} cặp: tạo mới ${created}, chuyển từ lời mời sang bạn bè ${converted}, đã là bạn từ trước ${pairs.length - todo.length}.`);
  console.log(`Tài khoản: ${users.map((u) => u.name).join(", ")}`);
}

seedFriends()
  .catch((error: unknown) => {
    console.error("Seed thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
