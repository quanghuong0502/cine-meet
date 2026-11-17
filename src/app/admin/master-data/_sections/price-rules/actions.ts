"use server";

import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { removeEntity, saveEntity } from "@/lib/admin/save-entity";
import { priceRuleInputSchema, priceRuleService } from "@/services/master-data/price-rule.service";

export async function savePriceRule(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveEntity(priceRuleService, priceRuleInputSchema, formData);
}

export async function removePriceRule(id: string): Promise<RemoveResult> {
  return removeEntity(priceRuleService, id);
}
