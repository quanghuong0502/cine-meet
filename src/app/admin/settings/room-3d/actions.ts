"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { ROOM_3D_APPEARANCE_TAG } from "@/lib/cache";
import { room3DAppearanceSchema } from "@/lib/seat-layout/room-3d-appearance";
import { updateRoom3DAppearance } from "@/services/room-3d-appearance.service";

export type SaveRoom3DAppearanceResult =
  | { ok: true }
  | { ok: false; error: "validation" | "unknown" };

export async function saveRoom3DAppearanceAction(raw: unknown): Promise<SaveRoom3DAppearanceResult> {
  const admin = await requireAdmin();
  const parsed = room3DAppearanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    await updateRoom3DAppearance(parsed.data, admin.userId);
    updateTag(ROOM_3D_APPEARANCE_TAG);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/room-3d");
    revalidatePath("/admin/auditoriums");
    revalidatePath("/cinemas", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
