"use server";

import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { brandInputSchema, brandService } from "@/services/master-data/brand.service";

/** Create (no `id` field) or update (with `id`). The admin comes from the session, never from the form. */
export async function saveBrand(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(brandService, brandInputSchema, formData);
}

export async function removeBrand(id: string): Promise<RemoveResult> {
  return removeEntity(brandService, id);
}
