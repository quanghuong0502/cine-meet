"use server";

import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import { fnbCategoryInputSchema, fnbCategoryService } from "@/services/master-data/fnb-category.service";

export async function saveFnbCategory(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(fnbCategoryService, fnbCategoryInputSchema, formData);
}

export async function removeFnbCategory(id: string): Promise<RemoveResult> {
  return removeEntity(fnbCategoryService, id);
}
