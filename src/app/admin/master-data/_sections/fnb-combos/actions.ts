"use server";

import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import { fnbComboInputSchema, fnbComboService } from "@/services/master-data/fnb-combo.service";

export async function saveFnbCombo(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(fnbComboService, fnbComboInputSchema, formData);
}

export async function removeFnbCombo(id: string): Promise<RemoveResult> {
  return removeEntity(fnbComboService, id);
}
