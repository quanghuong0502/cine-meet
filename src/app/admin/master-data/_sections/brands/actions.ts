"use server";

import { revalidatePath } from "next/cache";
import { errorState, parseForm, type RemoveResult, type SaveState } from "@/lib/admin/action-result";
import { requireAdmin } from "@/lib/auth/guards";
import { brandInputSchema, brandService } from "@/services/master-data/brand.service";

const PAGE = "/admin/master-data";

/** Create (no `id` field) or update (with `id`). The admin comes from the session, never from the form. */
export async function saveBrand(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const admin = await requireAdmin();

  const parsed = parseForm(brandInputSchema, formData);
  if (!parsed.ok) return errorState(formData, "validation", parsed.fieldErrors);

  const id = formData.get("id");
  const result =
    typeof id === "string" && id !== ""
      ? await brandService.update(id, parsed.data, admin.userId)
      : await brandService.create(parsed.data, admin.userId);

  if (!result.ok) return errorState(formData, result.error);
  revalidatePath(PAGE);
  return { status: "success" };
}

export async function removeBrand(id: string): Promise<RemoveResult> {
  const admin = await requireAdmin();
  const result = await brandService.remove(id, admin.userId);
  if (!result.ok) return result;
  revalidatePath(PAGE);
  return { ok: true };
}
