"use server";

import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import { branchInputSchema, branchService } from "@/services/master-data/branch.service";

export async function saveBranch(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(branchService, branchInputSchema, formData);
}

export async function removeBranch(id: string): Promise<RemoveResult> {
  return removeEntity(branchService, id);
}
