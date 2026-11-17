"use server";

import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import { holidayInputSchema, holidayService } from "@/services/master-data/holiday.service";

export async function saveHoliday(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(holidayService, holidayInputSchema, formData);
}

export async function removeHoliday(id: string): Promise<RemoveResult> {
  return removeEntity(holidayService, id);
}
