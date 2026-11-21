import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { currentMonthRange } from "@/lib/dashboard/period";
import { vietnamParts } from "@/services/pricing/ticket-price";
import { BudgetNotification } from "@/models/budget-notification";
import { Expense } from "@/models/expense";
import { User } from "@/models/user";
import { enqueueNotifications } from "@/notifications/outbox";

export interface MonthlyBudget {
  ticket?: number;
  fnb?: number;
}

/** Empty text means "no budget for this category"; otherwise a non-negative whole number of dong. */
const budgetAmount = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === "" ? undefined : Number(value.replace(/\D/g, ""))))
  .pipe(z.number().int().min(0).max(1_000_000_000).optional());

export const monthlyBudgetSchema = z.object({ ticket: budgetAmount, fnb: budgetAmount });
export type MonthlyBudgetInput = z.infer<typeof monthlyBudgetSchema>;

export async function getMonthlyBudget(userId: string): Promise<MonthlyBudget | null> {
  await connectToDatabase();
  const user = await User.findById(userId, "monthlyBudget").lean();
  return user?.monthlyBudget ? { ticket: user.monthlyBudget.ticket ?? undefined, fnb: user.monthlyBudget.fnb ?? undefined } : null;
}

/** Saves the budget; a category left blank is cleared (no longer tracked, so no more warnings for it). */
export async function setMonthlyBudget(userId: string, input: MonthlyBudgetInput): Promise<void> {
  await connectToDatabase();
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  if (input.ticket === undefined) $unset["monthlyBudget.ticket"] = 1;
  else $set["monthlyBudget.ticket"] = input.ticket;
  if (input.fnb === undefined) $unset["monthlyBudget.fnb"] = 1;
  else $set["monthlyBudget.fnb"] = input.fnb;
  await User.updateOne({ _id: userId }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) });
}

export interface BudgetProgress {
  category: "ticket" | "fnb";
  budget: number;
  spent: number;
  percent: number;
}

/** This month's spending against the budget, for each category that has one. `null` categories (no budget set) are left out. */
export async function getBudgetProgress(userId: string, now = new Date()): Promise<BudgetProgress[]> {
  await connectToDatabase();
  const [user, { start, end }] = await Promise.all([User.findById(userId, "monthlyBudget").lean(), Promise.resolve(currentMonthRange(now))]);
  const budget = user?.monthlyBudget;
  if (!budget?.ticket && !budget?.fnb) return [];
  const rows = await Expense.aggregate<{ _id: string; total: number }>([
    { $match: { userId: user!._id, date: { $gte: start, $lt: end }, category: { $in: ["ticket", "fnb"] } } },
    { $group: { _id: "$category", total: { $sum: "$amount" } } },
  ]);
  const spentByCategory = new Map(rows.map((r) => [r._id, r.total]));
  const result: BudgetProgress[] = [];
  for (const category of ["ticket", "fnb"] as const) {
    const amount = budget[category];
    if (!amount) continue;
    const spent = spentByCategory.get(category) ?? 0;
    result.push({ category, budget: amount, spent, percent: Math.round((spent / amount) * 100) });
  }
  return result;
}

/** The highest threshold (100 then 80) a percentage has just reached, or null if it has not reached either yet. */
export function budgetThresholdReached(percent: number): 80 | 100 | null {
  if (percent >= 100) return 100;
  if (percent >= 80) return 80;
  return null;
}

/**
 * #11: after new spending is recorded, tells each affected person once per threshold per category per month if they just
 * crossed 80% or 100% of their budget. Silent for anyone without a budget set. A `BudgetNotification` row remembers each
 * crossing already announced, so reaching 85% right after 82% (both over 80%) does not nag twice, and next month starts fresh.
 */
export async function checkBudgetWarnings(userIds: readonly string[], now = new Date()): Promise<void> {
  await connectToDatabase();
  const month = vietnamParts(now).date.slice(0, 7);
  for (const userId of new Set(userIds)) {
    const progress = await getBudgetProgress(userId, now);
    for (const p of progress) {
      const threshold = budgetThresholdReached(p.percent);
      if (!threshold) continue;
      // Reaching 100% also means 80% was reached; only the highest new threshold is worth telling about.
      const already = await BudgetNotification.exists({ userId, month, category: p.category, threshold });
      if (already) continue;
      try {
        await BudgetNotification.create({ userId, month, category: p.category, threshold });
      } catch {
        continue; // another write got here first
      }
      await enqueueNotifications([{ recipientId: userId, type: "budget_warning", payload: { actorName: "", budgetCategory: p.category, percent: threshold } }]);
    }
  }
}
