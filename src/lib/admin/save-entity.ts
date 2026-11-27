import { revalidatePath, updateTag } from "next/cache";
import type { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { errorState, parseForm, type RemoveResult, type SaveState } from "@/lib/admin/action-result";
import { CATALOG_CINEMAS_TAG, MASTER_DATA_CATALOG_TAG, MASTER_DATA_PRICING_TAG } from "@/lib/cache";
import { BRAND_OPTIONS_TAG } from "@/services/master-data/brand-options";
import type { ServiceResult } from "@/services/master-data/crud";

const PAGE = "/admin/master-data";

interface EntityService<Input> {
  create(input: Input, actorId: string): Promise<ServiceResult<unknown>>;
  update(id: string, input: Input, actorId: string): Promise<ServiceResult<unknown>>;
  remove(id: string, actorId: string): Promise<ServiceResult<null>>;
}

/**
 * After any master-data change: expire cached catalog/pricing tags and revalidate affected admin & user routes.
 */
function refreshMasterData() {
  revalidatePath(PAGE, "layout");
  revalidatePath("/admin/auditoriums", "layout");
  revalidatePath("/admin/settings/room-3d");
  revalidatePath("/showtimes");
  revalidatePath("/cinemas", "layout");
  revalidatePath("/log-viewing");
  updateTag(BRAND_OPTIONS_TAG);
  updateTag(MASTER_DATA_CATALOG_TAG);
  updateTag(MASTER_DATA_PRICING_TAG);
  updateTag(CATALOG_CINEMAS_TAG);
}

/**
 * Shared body of every master-data "save" server action: the admin comes from the session (never the form),
 * the form is validated into error CODES, then created (no `id` field) or updated (with `id`).
 */
export async function saveEntity<S extends z.ZodType>(
  service: EntityService<z.infer<S>>,
  schema: S,
  formData: FormData,
): Promise<SaveState> {
  const admin = await requireAdmin();

  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return errorState(formData, "validation", parsed.fieldErrors);

  const id = formData.get("id");
  const result =
    typeof id === "string" && id !== ""
      ? await service.update(id, parsed.data, admin.userId)
      : await service.create(parsed.data, admin.userId);

  if (!result.ok) return errorState(formData, result.error);
  refreshMasterData();
  return { status: "success" };
}

export async function removeEntity(service: EntityService<never>, id: string): Promise<RemoveResult> {
  const admin = await requireAdmin();
  const result = await service.remove(id, admin.userId);
  if (!result.ok) return result;
  refreshMasterData();
  return { ok: true };
}
