import { cache } from "react";
import { CINEMA_DIMENSIONS_TAG, safeCache } from "@/lib/cache";
import { connectToDatabase } from "@/lib/db";
import { layoutConfigSchema } from "@/lib/seat-layout/config";
import {
  cinemaDimensionDefaultsSchema,
  DEFAULT_CINEMA_DIMENSIONS,
  type CinemaDimensionDefaults,
} from "@/lib/seat-layout/dimensions";
import type { LayoutConfig, SeatStyle, SeatTypeInfo } from "@/lib/seat-layout/types";
import { AuditoriumLayout } from "@/models/auditorium-layout";
import { SeatType } from "@/models/seat-type";
import { SystemSetting } from "@/models/system-setting";
import { recordAudit } from "@/services/audit.service";
import { buildLayout } from "@/services/seat-layout-build";

export const CINEMA_DIMENSIONS_KEY = "cinemaDimensions";

async function readCinemaDimensions(): Promise<CinemaDimensionDefaults> {
  await connectToDatabase();
  const row = await SystemSetting.findOne({ key: CINEMA_DIMENSIONS_KEY }).lean();
  const parsed = cinemaDimensionDefaultsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_CINEMA_DIMENSIONS;
}

const getCinemaDimensionsCached = safeCache(readCinemaDimensions, ["cinema-dimensions"], {
  tags: [CINEMA_DIMENSIONS_TAG],
  revalidate: 3600,
});

/** Loads system-wide default cinema dimensions from `SystemSetting` (cached cross-request & per-render). */
export const getCinemaDimensions = cache(() => getCinemaDimensionsCached());

/**
 * Updates system-wide cinema dimension defaults, logs the audit entry, and recomputes seat scores & summaries
 * for all saved layouts so Heatmaps stay in sync with the new defaults.
 */
export async function updateCinemaDimensions(
  next: CinemaDimensionDefaults,
  actorId: string,
): Promise<{ dimensions: CinemaDimensionDefaults; rescored: number }> {
  await connectToDatabase();
  const before = await readCinemaDimensions();
  if (JSON.stringify(before) === JSON.stringify(next)) {
    return { dimensions: before, rescored: 0 };
  }

  const row = await SystemSetting.findOneAndUpdate(
    { key: CINEMA_DIMENSIONS_KEY },
    { $set: { value: next } },
    { upsert: true, returnDocument: "after" },
  ).lean();

  await recordAudit({
    actorId,
    action: "update",
    entity: "systemSetting",
    entityId: row._id.toString(),
    before: { key: CINEMA_DIMENSIONS_KEY, value: before },
    after: { key: CINEMA_DIMENSIONS_KEY, value: next },
  });

  const rescored = await rescoreAllLayouts(next);
  return { dimensions: next, rescored };
}

/** Recomputes derived seat scores & summaries for every stored layout using `defaults` + each layout's own overrides. */
export async function rescoreAllLayouts(defaults: CinemaDimensionDefaults): Promise<number> {
  const types: SeatTypeInfo[] = (await SeatType.find({}, "name capacity style").lean()).map((t) => ({
    id: t._id.toString(),
    name: t.name,
    capacity: t.capacity,
    style: (t.style as SeatStyle | undefined) ?? "standard",
  }));

  let updated = 0;
  const BATCH = 50;
  let ops: Parameters<typeof AuditoriumLayout.bulkWrite>[0] = [];
  const cursor = AuditoriumLayout.find({}, "config").lean().cursor();
  for await (const layout of cursor) {
    const parsed = layoutConfigSchema.safeParse(JSON.parse(JSON.stringify(layout.config)));
    if (!parsed.success) continue;
    const built = buildLayout(parsed.data as LayoutConfig, types, defaults);
    ops.push({
      updateOne: {
        filter: { _id: layout._id },
        update: { $set: { seats: built.seats, summary: built.summary } },
      },
    });
    updated += 1;
    if (ops.length >= BATCH) {
      await AuditoriumLayout.bulkWrite(ops, { ordered: false });
      ops = [];
    }
  }
  if (ops.length > 0) await AuditoriumLayout.bulkWrite(ops, { ordered: false });
  return updated;
}
