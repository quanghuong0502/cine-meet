"use server";

import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import { formatInputSchema, formatService } from "@/services/master-data/format.service";

export async function saveFormat(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(formatService, formatInputSchema, formData);
}

export async function removeFormat(id: string): Promise<RemoveResult> {
  return removeEntity(formatService, id);
}
