"use server";

import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import { ageRatingInputSchema, ageRatingService } from "@/services/master-data/age-rating.service";

export async function saveAgeRating(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(ageRatingService, ageRatingInputSchema, formData);
}

export async function removeAgeRating(id: string): Promise<RemoveResult> {
  return removeEntity(ageRatingService, id);
}
