"use server";

import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import { genreInputSchema, genreService } from "@/services/master-data/genre.service";

export async function saveGenre(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(genreService, genreInputSchema, formData);
}

export async function removeGenre(id: string): Promise<RemoveResult> {
  return removeEntity(genreService, id);
}
