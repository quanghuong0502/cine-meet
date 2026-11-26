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
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;
  await connectToDatabase();
  const month = vietnamParts(now).date.slice(0, 7);
  const { start, end } = currentMonthRange(now);
  const users = await User.find({ _id: { $in: uniqueIds } }, "monthlyBudget").lean();
  const trackedUsers = users.filter((u) => u.monthlyBudget?.ticket || u.monthlyBudget?.fnb);
  if (trackedUsers.length === 0) return;
  const trackedIds = trackedUsers.map((u) => u._id);

  const [spentRows, existingWarnings] = await Promise.all([
    Expense.aggregate<{ _id: { userId: { toString(): string }; category: string }; total: number }>([
      { $match: { userId: { $in: trackedIds }, date: { $gte: start, $lt: end }, category: { $in: ["ticket", "fnb"] } } },
      { $group: { _id: { userId: "$userId", category: "$category" }, total: { $sum: "$amount" } } },
    ]),
    BudgetNotification.find({ userId: { $in: trackedIds }, month }, "userId category threshold").lean(),
  ]);

  const spentMap = new Map(spentRows.map((r) => [`${r._id.userId.toString()}:${r._id.category}`, r.total]));
  const alreadySet = new Set(existingWarnings.map((w) => `${w.userId.toString()}:${w.category}:${w.threshold}`));

  const toEnqueue: { recipientId: string; type: "budget_warning"; payload: { actorName: string; budgetCategory: "ticket" | "fnb"; percent: 80 | 100 } }[] = [];
  for (const user of trackedUsers) {
    const uid = user._id.toString();
    const budget = user.monthlyBudget!;
    for (const category of ["ticket", "fnb"] as const) {
      const amount = budget[category];
      if (!amount) continue;
      const spent = spentMap.get(`${uid}:${category}`) ?? 0;
      const threshold = budgetThresholdReached(Math.round((spent / amount) * 100));
      if (!threshold || alreadySet.has(`${uid}:${category}:${threshold}`)) continue;
      try {
        await BudgetNotification.create({ userId: uid, month, category, threshold });
      } catch {
        continue; // another write got here first
      }
      toEnqueue.push({ recipientId: uid, type: "budget_warning", payload: { actorName: "", budgetCategory: category, percent: threshold } });
    }
  }
  if (toEnqueue.length > 0) await enqueueNotifications(toEnqueue);
}
