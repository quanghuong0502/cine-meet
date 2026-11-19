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
import { befriendEveryone, describeReport } from "./friend-pairs";

const ENV_FILE = ".env.local";

async function seedFriends(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error("Từ chối chạy ở production. Nếu thật sự muốn, đặt SEED_ALLOW_PRODUCTION=1.");
  }
  await connectToDatabase();
  const report = await befriendEveryone();
  if (report.accounts.length < 2) {
    console.log(`Chỉ có ${report.accounts.length} tài khoản người dùng đang hoạt động, chưa có cặp bạn bè nào để tạo.`);
    return;
  }
  console.log(describeReport(report));
  console.log(`Tài khoản: ${report.accounts.join(", ")}`);
}

seedFriends()
  .catch((error: unknown) => {
    console.error("Seed thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
