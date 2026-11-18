/**
 * Creates a few SAMPLE regular accounts (An, Bình, Chi) so the friend, invite, vote and lock flows can be tried with several people,
 * then makes every regular account a friend of every other one (including accounts that already existed, such as yours).
 * Each sample account has a username, a phone number and the same sample password below, and signs in straight away (no forced password change).
 * Safe to run again: an account whose username already exists is kept as it is (its password is not touched).
 * These are test accounts: delete them before going to production. Refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1.
 *
 * Usage: npm run seed:users   (reads .env.local if present)
 */
import { existsSync } from "node:fs";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";
import { befriendEveryone, describeReport } from "./friend-pairs";

const ENV_FILE = ".env.local";
const PASSWORD_HASH_ROUNDS = 12;

/** Sample password for every sample account: only for trying the app, never for a real account. */
const SAMPLE_PASSWORD = "Mau12345!";

const SAMPLES = [
  { name: "An (mẫu)", username: "an", phone: "84900000001" },
  { name: "Bình (mẫu)", username: "binh", phone: "84900000002" },
  { name: "Chi (mẫu)", username: "chi", phone: "84900000003" },
];

async function seedUsers(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error("Từ chối chạy ở production. Nếu thật sự muốn, đặt SEED_ALLOW_PRODUCTION=1.");
  }

  await connectToDatabase();
  await User.init();
  const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, PASSWORD_HASH_ROUNDS);

  const made: string[] = [];
  const kept: string[] = [];
  for (const sample of SAMPLES) {
    // A username or phone already taken by someone else is left alone: the sample is skipped rather than overwriting a real account.
    const taken = await User.findOne({ $or: [{ username: sample.username }, { phone: sample.phone }] }, "_id").lean();
    if (taken) {
      kept.push(sample.username);
      continue;
    }
    await User.create({ ...sample, role: "user", status: "active", authProviders: ["credentials"], passwordHash, mustChangePassword: false, locale: "vi" });
    made.push(sample.username);
  }
  console.log(`Tài khoản mẫu: tạo mới ${made.length}${made.length ? ` (${made.join(", ")})` : ""}, đã có sẵn ${kept.length}${kept.length ? ` (${kept.join(", ")})` : ""}.`);
  if (made.length > 0) console.log(`Đăng nhập bằng tên đăng nhập ở trên và mật khẩu mẫu ${SAMPLE_PASSWORD}`);

  const report = await befriendEveryone();
  console.log(describeReport(report));
  console.log(`Tài khoản: ${report.accounts.join(", ")}`);
}

seedUsers()
  .catch((error: unknown) => {
    console.error("Seed thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
