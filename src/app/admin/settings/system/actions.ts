"use server";

import { revalidatePath, updateTag } from "next/cache";
import { errorState, parseForm, type SaveState } from "@/lib/admin/action-result";
import { requireAdmin } from "@/lib/auth/guards";
import { CATALOG_MOVIES_TAG, SYSTEM_SETTINGS_TAG } from "@/lib/cache";
import { systemSettingsInputSchema, updateSystemSettings } from "@/services/settings.service";

/** The admin comes from the session, never from the form. */
export async function saveSystemSettings(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const admin = await requireAdmin();
  const parsed = parseForm(systemSettingsInputSchema, formData);
  if (!parsed.ok) return errorState(formData, "validation", parsed.fieldErrors);

  await updateSystemSettings(parsed.data, admin.userId);
  updateTag(SYSTEM_SETTINGS_TAG);
  updateTag(CATALOG_MOVIES_TAG);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/system");
  revalidatePath("/showtimes");
  revalidatePath("/appointments/new");
  return { status: "success" };
}
