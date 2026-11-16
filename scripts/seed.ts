/**
 * Creates the first admin account from ADMIN_EMAIL / ADMIN_PASSWORD (optional ADMIN_USERNAME).
 * Safe to run repeatedly: an existing account is never duplicated and its password is never overwritten.
 * Refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1 is set explicitly.
 *
 * Usage: npm run seed   (reads .env.local if present)
 */
import { existsSync } from "node:fs";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { LoginAttempt } from "@/models/login-attempt";
import { User } from "@/models/user";

const PASSWORD_HASH_ROUNDS = 12;
const MIN_ADMIN_PASSWORD_LENGTH = 8;
const ENV_FILE = ".env.local";

const seedEnvSchema = z.object({
  ADMIN_EMAIL: z.email({ error: "ADMIN_EMAIL phải là email hợp lệ." }),
  ADMIN_USERNAME: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, {
      error: "ADMIN_USERNAME chỉ gồm chữ thường, số, . _ - (3 đến 30 ký tự).",
    })
    .optional(),
  ADMIN_PASSWORD: z
    .string()
    .min(MIN_ADMIN_PASSWORD_LENGTH, {
      error: `ADMIN_PASSWORD phải có ít nhất ${MIN_ADMIN_PASSWORD_LENGTH} ký tự.`,
    }),
});

async function seedAdmin(): Promise<void> {
  // Next.js loads .env.local itself; a plain tsx script has to do it explicitly.
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error(
      "Từ chối chạy seed ở production. Nếu thật sự muốn tạo admin, đặt SEED_ALLOW_PRODUCTION=1.",
    );
  }

  const parsed = seedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => issue.message).join(" ");
    throw new Error(`Thiếu hoặc sai cấu hình admin trong ${ENV_FILE}. ${problems}`);
  }
  const email = parsed.data.ADMIN_EMAIL.trim().toLowerCase();

  await connectToDatabase();
  // Make sure the unique indexes exist before upserting.
  await Promise.all([User.init(), LoginAttempt.init()]);

  const existing = await User.findOne({ email });
  if (existing) {
    const needsPromotion = existing.role !== "admin" || existing.status !== "active";
    if (needsPromotion) {
      existing.role = "admin";
      existing.status = "active";
      await existing.save();
    }
    console.log(
      needsPromotion
        ? "Tài khoản đã tồn tại: đã nâng lên admin và mở khóa. Mật khẩu giữ nguyên."
        : "Tài khoản admin đã tồn tại. Không có thay đổi.",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.ADMIN_PASSWORD, PASSWORD_HASH_ROUNDS);
  await User.create({
    name: "Quản trị viên",
    email,
    username: parsed.data.ADMIN_USERNAME,
    role: "admin",
    status: "active",
    authProviders: ["credentials"],
    passwordHash,
  });
  console.log("Đã tạo tài khoản admin đầu tiên.");
}

seedAdmin()
  .catch((error: unknown) => {
    console.error("Seed thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
