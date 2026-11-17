"use server";

import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import { fnbItemInputSchema, fnbItemService } from "@/services/master-data/fnb-item.service";

export async function saveFnbItem(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(fnbItemService, fnbItemInputSchema, formData);
}

export async function removeFnbItem(id: string): Promise<RemoveResult> {
  return removeEntity(fnbItemService, id);
}
