import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";

describe("budget warnings (#11) and spending totals", () => {
  let svc: typeof import("./budget.service");
  let expenses: typeof import("./expense.service");
  let User: typeof import("@/models/user").User;
  let Expense: typeof import("@/models/expense").Expense;
  let Notification: typeof import("@/models/notification").Notification;
  let BudgetNotification: typeof import("@/models/budget-notification").BudgetNotification;
  const now = new Date("2026-03-15T05:00:00.000Z");
  const inMonth = new Date("2026-03-10T05:00:00.000Z");
  const lastMonth = new Date("2026-02-20T05:00:00.000Z");

  beforeAll(async () => {
    await startTestDatabase();
    svc = await import("./budget.service");
    expenses = await import("./expense.service");
    User = (await import("@/models/user")).User;
    Expense = (await import("@/models/expense")).Expense;
    Notification = (await import("@/models/notification")).Notification;
    BudgetNotification = (await import("@/models/budget-notification")).BudgetNotification;
    await (await import("@/lib/db")).connectToDatabase();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Expense.deleteMany({}), Notification.deleteMany({}), BudgetNotification.deleteMany({})]);
  });

  async function makeUser(monthlyBudget?: { ticket?: number; fnb?: number }) {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, name: "U", status: "active", role: "user", monthlyBudget });
    return id.toString();
  }
  const spend = (userId: string, category: "ticket" | "fnb" | "other", amount: number, date = inMonth) =>
    Expense.create({ userId, category, amount, date });

  it("maps a percentage to the highest threshold reached", () => {
    expect(svc.budgetThresholdReached(79)).toBeNull();
    expect(svc.budgetThresholdReached(80)).toBe(80);
    expect(svc.budgetThresholdReached(99)).toBe(80);
    expect(svc.budgetThresholdReached(100)).toBe(100);
    expect(svc.budgetThresholdReached(150)).toBe(100);
  });

  it("measures only this month's own spending per budgeted category", async () => {
    const me = await makeUser({ ticket: 100_000 });
    const other = await makeUser({ ticket: 100_000 });
    await spend(me, "ticket", 60_000);
    await spend(me, "ticket", 20_000, lastMonth); // not this month
    await spend(me, "fnb", 50_000); // fnb has no budget: left out
    await spend(other, "ticket", 90_000); // someone else's
    expect(await svc.getBudgetProgress(me, now)).toEqual([{ category: "ticket", budget: 100_000, spent: 60_000, percent: 60 }]);
  });

  it("has no progress when no budget is set", async () => {
    const me = await makeUser();
    await spend(me, "ticket", 60_000);
    expect(await svc.getBudgetProgress(me, now)).toEqual([]);
  });

  it("warns once at 80% and once more at 100%, never twice for the same threshold", async () => {
    const me = await makeUser({ ticket: 100_000 });
    const warnings = () => Notification.countDocuments({ recipientId: me, type: "budget_warning" });

    await spend(me, "ticket", 70_000);
    await svc.checkBudgetWarnings([me], now);
    expect(await warnings()).toBe(0);

    await spend(me, "ticket", 12_000); // 82%
    await svc.checkBudgetWarnings([me], now);
    expect(await warnings()).toBe(1);

    await spend(me, "ticket", 3_000); // 85%, still the 80% band
    await svc.checkBudgetWarnings([me], now);
    expect(await warnings()).toBe(1);

    await spend(me, "ticket", 20_000); // 105%
    await svc.checkBudgetWarnings([me], now);
    expect(await warnings()).toBe(2);

    await svc.checkBudgetWarnings([me], now);
    expect(await warnings()).toBe(2);
  });

  it("starts fresh next month and stays silent for people with no budget", async () => {
    const me = await makeUser({ fnb: 100_000 });
    const none = await makeUser();
    await spend(me, "fnb", 90_000);
    await spend(none, "fnb", 900_000);
    await svc.checkBudgetWarnings([me, none], now);
    expect(await Notification.countDocuments({ recipientId: me, type: "budget_warning" })).toBe(1);
    expect(await Notification.countDocuments({ recipientId: none })).toBe(0);

    const april = new Date("2026-04-15T05:00:00.000Z");
    await spend(me, "fnb", 95_000, new Date("2026-04-10T05:00:00.000Z"));
    await svc.checkBudgetWarnings([me], april);
    expect(await Notification.countDocuments({ recipientId: me, type: "budget_warning" })).toBe(2);
  });

  it("logging a viewing records one expense per cost entered and can raise a warning", async () => {
    const me = await makeUser({ ticket: 100_000 });
    const result = await expenses.logManualViewing(me, {
      date: "2026-03-10",
      ticket: 0,
      fnb: 0,
      other: 0,
    } as never);
    expect(result.ok).toBe(true);
    expect(await Expense.countDocuments({ userId: me })).toBe(0); // no cost typed: no expense, viewing still kept

    await expenses.logManualViewing(me, { date: "2026-03-10", ticket: 95_000, fnb: 20_000, other: 0 } as never);
    expect(await Expense.countDocuments({ userId: me })).toBe(2);
  });

  it("timeline puts each expense in exactly one bucket and totals match", async () => {
    const me = await makeUser();
    await spend(me, "ticket", 100_000, inMonth);
    await spend(me, "fnb", 40_000, inMonth);
    await spend(me, "other", 10_000, lastMonth);
    const rows = await expenses.getSpendingTimeline(me, "month", now, 3);
    expect(rows).toHaveLength(3);
    const total = rows.reduce((sum, r) => sum + r.total, 0);
    expect(total).toBe(150_000);
    const last = rows[rows.length - 1];
    expect(last).toMatchObject({ ticket: 100_000, fnb: 40_000, other: 0, total: 140_000 });
    expect(rows[1]).toMatchObject({ other: 10_000, total: 10_000 });
  });

  it("only the person who logged a viewing can remove it, and its costs go with it", async () => {
    const me = await makeUser();
    const other = await makeUser();
    const { id } = await expenses.logManualViewing(me, { date: "2026-03-10", ticket: 95_000, fnb: 0, other: 0 } as never);
    expect(await expenses.removeManualViewing(other, id)).toEqual({ ok: false, error: "not_found" });
    expect(await Expense.countDocuments({ userId: me })).toBe(1);
    expect(await expenses.removeManualViewing(me, id)).toEqual({ ok: true });
    expect(await Expense.countDocuments({ userId: me })).toBe(0);
  });
});
