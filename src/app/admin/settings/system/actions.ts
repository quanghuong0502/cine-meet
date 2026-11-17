"use server";

import { revalidatePath } from "next/cache";
import { errorState, parseForm, type SaveState } from "@/lib/admin/action-result";
import { requireAdmin } from "@/lib/auth/guards";
import { systemSettingsInputSchema, updateSystemSettings } from "@/services/settings.service";

/** The admin comes from the session, never from the form. */
export async function saveSystemSettings(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const admin = await requireAdmin();
  const parsed = parseForm(systemSettingsInputSchema, formData);
  if (!parsed.ok) return errorState(formData, "validation", parsed.fieldErrors);

  await updateSystemSettings(parsed.data, admin.userId);
  revalidatePath("/admin/settings");
  return { status: "success" };
}
