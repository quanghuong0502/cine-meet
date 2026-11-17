"use server";

import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import { seatTypeInputSchema, seatTypeService } from "@/services/master-data/seat-type.service";

export async function saveSeatType(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(seatTypeService, seatTypeInputSchema, formData);
}

export async function removeSeatType(id: string): Promise<RemoveResult> {
  return removeEntity(seatTypeService, id);
}
