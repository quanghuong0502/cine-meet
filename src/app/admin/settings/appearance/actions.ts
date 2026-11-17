"use server";

import { revalidatePath, updateTag } from "next/cache";
import { errorState, type SaveState } from "@/lib/admin/action-result";
import { requireAdmin } from "@/lib/auth/guards";
import { saveBrandColor } from "@/services/brand-color.service";
import { BRAND_THEME_TAG } from "@/services/brand-theme-cache";

/** The admin comes from the session, never from the form. The colour is checked again here (readable, visible), not only in the picker. */
export async function saveBrandColorAction(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const admin = await requireAdmin();
  const color = formData.get("color");
  const result = await saveBrandColor(typeof color === "string" ? color : "", admin.userId);
  if (!result.ok) return errorState(formData, "validation", { color: result.error });

  // Every page takes the new colour: drop the cached theme and the client's cached pages.
  updateTag(BRAND_THEME_TAG);
  revalidatePath("/", "layout");
  return { status: "success" };
}
