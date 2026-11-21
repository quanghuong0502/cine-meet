"use server";

import { requireUser } from "@/lib/auth/guards";
import { monthlyBudgetSchema, setMonthlyBudget } from "@/services/budget.service";

export type SaveBudgetResult = { ok: true } | { ok: false; error: "invalid" };

export async function saveBudgetAction(input: unknown): Promise<SaveBudgetResult> {
  const user = await requireUser();
  const parsed = monthlyBudgetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await setMonthlyBudget(user.userId, parsed.data);
  return { ok: true };
}
