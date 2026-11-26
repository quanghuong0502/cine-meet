/**
 * Recomputes the seat scores and the chatbot summary of EVERY saved layout version, from its own config, with the current
 * formula in `src/services/seat-score.ts`. Run it after changing that formula, otherwise rooms saved earlier keep their old scores.
 * Only the derived fields (`seats` and `summary`) are rewritten; a version's config never changes, so history stays true.
 * Refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1.
 *
 * Usage: npm run rescore   (reads .env.local if present)
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { layoutConfigSchema } from "@/lib/seat-layout/config";
import type { LayoutConfig } from "@/lib/seat-layout/types";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { SeatType } from "@/models/seat-type";
import { getCinemaDimensions } from "@/services/cinema-dimensions.service";
import { buildLayout } from "@/services/seat-layout-build";

const ENV_FILE = ".env.local";

async function rescore(): Promise<void> {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error("Từ chối chạy ở production. Nếu thật sự muốn, đặt SEED_ALLOW_PRODUCTION=1.");
  }
  await connectToDatabase();

  const defaults = await getCinemaDimensions();
  const types = (await SeatType.find({}).lean()).map((t) => ({ id: t._id.toString(), name: t.name, capacity: t.capacity }));
  let updated = 0;
  let skipped = 0;
  for (const layout of await AuditoriumLayout.find({}).lean()) {
    const parsed = layoutConfigSchema.safeParse(JSON.parse(JSON.stringify(layout.config)));
    if (!parsed.success) {
      skipped += 1;
      console.warn(`Bỏ qua layout ${layout._id.toString()}: cấu hình không hợp lệ.`);
      continue;
    }
    const built = buildLayout(parsed.data as LayoutConfig, types, defaults);
    await AuditoriumLayout.updateOne({ _id: layout._id }, { $set: { seats: built.seats, summary: built.summary } });
    updated += 1;
  }
  console.log(`Đã tính lại điểm ghế cho ${updated} phiên bản layout${skipped ? `, bỏ qua ${skipped}` : ""}.`);
}

rescore()
  .catch((error: unknown) => {
    console.error("Tính lại điểm thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
