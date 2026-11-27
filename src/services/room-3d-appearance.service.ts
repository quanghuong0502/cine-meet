import { cache } from "react";
import { ROOM_3D_APPEARANCE_TAG, safeCache } from "@/lib/cache";
import { connectToDatabase } from "@/lib/db";
import {
  DEFAULT_ROOM_3D_APPEARANCE,
  normalizeRoom3DAppearance,
  room3DAppearanceSchema,
  type Room3DAppearance,
} from "@/lib/seat-layout/room-3d-appearance";
import { SystemSetting } from "@/models/system-setting";
import { recordAudit } from "@/services/audit.service";

export const ROOM_3D_APPEARANCE_KEY = "room3dAppearance";

async function readRoom3DAppearance(): Promise<Room3DAppearance> {
  await connectToDatabase();
  const row = await SystemSetting.findOne({ key: ROOM_3D_APPEARANCE_KEY }).lean();
  const parsed = room3DAppearanceSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : DEFAULT_ROOM_3D_APPEARANCE;
}

const getRoom3DAppearanceCached = safeCache(readRoom3DAppearance, ["room-3d-appearance-v3"], {
  tags: [ROOM_3D_APPEARANCE_TAG],
  revalidate: 3600,
});

/** Loads system-wide 3D room visual UI configuration from `SystemSetting` (cached cross-request & per-render). */
export const getRoom3DAppearance = cache(async () => normalizeRoom3DAppearance(await getRoom3DAppearanceCached()));

/**
 * Updates system-wide 3D room UI configuration and logs an audit entry.
 * Purely visual — does not touch physical dimensions or trigger seat rescoring.
 */
export async function updateRoom3DAppearance(
  next: Room3DAppearance,
  actorId: string,
): Promise<Room3DAppearance> {
  await connectToDatabase();
  const before = await readRoom3DAppearance();
  if (JSON.stringify(before) === JSON.stringify(next)) {
    return before;
  }

  const row = await SystemSetting.findOneAndUpdate(
    { key: ROOM_3D_APPEARANCE_KEY },
    { $set: { value: next } },
    { upsert: true, returnDocument: "after" },
  ).lean();

  await recordAudit({
    actorId,
    action: "update",
    entity: "systemSetting",
    entityId: row._id.toString(),
    before: { key: ROOM_3D_APPEARANCE_KEY, value: before },
    after: { key: ROOM_3D_APPEARANCE_KEY, value: next },
  });

  return next;
}
