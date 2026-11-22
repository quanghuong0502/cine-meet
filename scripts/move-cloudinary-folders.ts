/**
 * Moves pictures that were uploaded before folders existed into the right Cloudinary folder.
 * Which folder is decided by the field that uses the picture (users.avatar, brands.logoUrl, branches.imageUrl, movies.posterUrl),
 * not by the picture's name: <CLOUDINARY_ROOT_FOLDER>/avatars | brands | branches | movies.
 * Pictures that no record uses are left where they are and only listed.
 *
 * It follows the database in .env.local and the CLOUDINARY_ROOT_FOLDER in that file: run it once per environment
 * (dev database with seatmate_dev, production database with seatmate_production).
 *
 * Usage: npm run cloudinary:move            (dry run: only prints what would move)
 *        npm run cloudinary:move -- --apply (moves them)
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { assetFolder, cloudinaryConfig } from "@/lib/cloudinary";
import { Branch } from "@/models/branch";
import { Brand } from "@/models/brand";
import { Movie } from "@/models/movie";
import { User } from "@/models/user";

const ENV_FILE = ".env.local";

interface Target {
  kind: "avatars" | "brands" | "branches" | "movies";
  label: string;
  urls: () => Promise<{ id: string; url: string }[]>;
}

const withUrl = <T extends { _id: unknown }>(rows: T[], field: keyof T) =>
  rows.flatMap((row) => (typeof row[field] === "string" && row[field] ? [{ id: String(row._id), url: row[field] as string }] : []));

const TARGETS: Target[] = [
  { kind: "avatars", label: "users.avatar", urls: async () => withUrl(await User.find({ avatar: { $exists: true, $ne: "" } }, { avatar: 1 }).lean(), "avatar") },
  { kind: "brands", label: "brands.logoUrl", urls: async () => withUrl(await Brand.find({ logoUrl: { $exists: true, $ne: "" } }, { logoUrl: 1 }).lean(), "logoUrl") },
  { kind: "branches", label: "branches.imageUrl", urls: async () => withUrl(await Branch.find({ imageUrl: { $exists: true, $ne: "" } }, { imageUrl: 1 }).lean(), "imageUrl") },
  { kind: "movies", label: "movies.posterUrl", urls: async () => withUrl(await Movie.find({ posterUrl: { $exists: true, $ne: "" } }, { posterUrl: 1 }).lean(), "posterUrl") },
];

/** The picture's public_id from its delivery address: everything after the version segment (v123), without the extension; null if it is not ours. */
function publicIdOf(url: string, cloudName: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const prefix = `/${cloudName}/image/upload/`;
  if (parsed.hostname !== "res.cloudinary.com" || !parsed.pathname.startsWith(prefix)) return null;
  const segments = parsed.pathname.slice(prefix.length).split("/").map(decodeURIComponent);
  const versionAt = segments.findIndex((segment) => /^v\d+$/.test(segment));
  const rest = (versionAt >= 0 ? segments.slice(versionAt + 1) : segments).join("/");
  return rest.replace(/\.[a-z0-9]+$/i, "") || null;
}

async function main(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  const apply = process.argv.includes("--apply");
  const config = cloudinaryConfig();
  if (!config) throw new Error("Chưa cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).");
  await connectToDatabase();

  console.log(`${apply ? "CHUYỂN THẬT" : "Chạy thử (thêm --apply để chuyển thật)"}; thư mục gốc: ${config.rootFolder ?? "(không đặt CLOUDINARY_ROOT_FOLDER)"}`);
  const auth = `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}`;
  let moved = 0;
  let failed = 0;
  const seen = new Set<string>();

  for (const target of TARGETS) {
    const folder = assetFolder(target.kind, config);
    for (const { id, url } of await target.urls()) {
      const publicId = publicIdOf(url, config.cloudName);
      if (!publicId) {
        console.log(`Bỏ qua (không phải ảnh của tài khoản này) ${target.label} ${id}: ${url}`);
        continue;
      }
      if (seen.has(publicId)) continue;
      seen.add(publicId);
      console.log(`${publicId}  ->  ${folder}  (${target.label} ${id})`);
      if (!apply) continue;

      const path = publicId.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${path}`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ asset_folder: folder }),
      });
      if (response.ok) {
        moved += 1;
      } else {
        failed += 1;
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        console.warn(`  Không chuyển được: ${body?.error?.message ?? response.status}`);
      }
    }
  }

  console.log(apply ? `Xong: chuyển ${moved}, lỗi ${failed}.` : `Sẽ chuyển ${seen.size} ảnh. Ảnh không thuộc bản ghi nào được giữ nguyên.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
