"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { CINEMA_DIMENSIONS_TAG } from "@/lib/cache";
import { cinemaDimensionDefaultsSchema } from "@/lib/seat-layout/dimensions";
import { updateCinemaDimensions } from "@/services/cinema-dimensions.service";

export type SaveCinemaDimensionsResult =
  | { ok: true; rescored: number }
  | { ok: false; error: "validation" | "unknown" };

export async function saveCinemaDimensionsAction(raw: unknown): Promise<SaveCinemaDimensionsResult> {
  const admin = await requireAdmin();
  const parsed = cinemaDimensionDefaultsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation" };

  try {
    const { rescored } = await updateCinemaDimensions(parsed.data, admin.userId);
    updateTag(CINEMA_DIMENSIONS_TAG);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/cinema-dimensions");
    revalidatePath("/admin/auditoriums");
    revalidatePath("/cinemas", "layout");
    return { ok: true, rescored };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
