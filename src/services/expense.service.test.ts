import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, vietnamToday } from "@/lib/movie/status";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";
import { manualViewingInputSchema } from "./expense.service";

describe("manualViewingInputSchema", () => {
  it("accepts today in Vietnam time", () => {
    const today = vietnamToday();
    const result = manualViewingInputSchema.safeParse({
      date: today,
      ticket: "100.000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBe(today);
      expect(result.data.ticket).toBe(100_000);
      expect(result.data.fnb).toBe(0);
    }
  });

  it("accepts a past date", () => {
    const past = addDays(vietnamToday(), -5);
    const result = manualViewingInputSchema.safeParse({
      date: past,
      ticket: "90000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a future date with future_date error", () => {
    const tomorrow = addDays(vietnamToday(), 1);
    const result = manualViewingInputSchema.safeParse({
      date: tomorrow,
      ticket: "90000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("date"));
      expect(issue).toBeDefined();
      expect(issue?.message).toBe("future_date");
    }
  });

  it("rejects invalid date strings", () => {
    const result = manualViewingInputSchema.safeParse({
      date: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes currency input with thousand separators and trims", () => {
    const result = manualViewingInputSchema.safeParse({
      date: vietnamToday(),
      ticket: "  120.000 ₫ ",
      fnb: "45,000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ticket).toBe(120_000);
      expect(result.data.fnb).toBe(45_000);
    }
  });

  it("transforms 'none' option to undefined for movieId and auditoriumId", () => {
    const result = manualViewingInputSchema.safeParse({
      date: vietnamToday(),
      movieId: "none",
      auditoriumId: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.movieId).toBeUndefined();
      expect(result.data.auditoriumId).toBeUndefined();
    }
  });
});

describe("logManualViewing service", () => {
  let svc: typeof import("./expense.service");
  let Expense: typeof import("@/models/expense").Expense;
  let ManualViewing: typeof import("@/models/manual-viewing").ManualViewing;
  const oid = () => new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await startTestDatabase();
    svc = await import("./expense.service");
    Expense = (await import("@/models/expense")).Expense;
    ManualViewing = (await import("@/models/manual-viewing")).ManualViewing;
    await (await import("@/lib/db")).connectToDatabase();
  }, 120_000);
  afterAll(stopTestDatabase);

  beforeEach(async () => {
    await Promise.all([Expense.deleteMany({}), ManualViewing.deleteMany({})]);
  });

  it("creates a manual viewing and only positive expenses", async () => {
    const userId = oid().toString();
    const result = await svc.logManualViewing(userId, {
      date: vietnamToday(),
      ticket: 90_000,
      fnb: 0,
      other: 15_000,
    });
    expect(result.ok).toBe(true);

    const doc = await ManualViewing.findById(result.id);
    expect(doc).not.toBeNull();
    expect(doc?.userId.toString()).toBe(userId);

    const expenses = await Expense.find({ manualViewingId: result.id }).lean();
    expect(expenses).toHaveLength(2);
    expect(expenses.find((e) => e.category === "ticket")?.amount).toBe(90_000);
    expect(expenses.find((e) => e.category === "other")?.amount).toBe(15_000);
    expect(expenses.find((e) => e.category === "fnb")).toBeUndefined();
  });

  it("deleting a manual viewing removes its expenses, and only the owner can delete", async () => {
    const owner = oid().toString();
    const otherUser = oid().toString();

    const created = await svc.logManualViewing(owner, {
      date: vietnamToday(),
      ticket: 80_000,
      fnb: 30_000,
      other: 0,
    });
    expect(created.ok).toBe(true);

    // Other user cannot delete
    const denied = await svc.removeManualViewing(otherUser, created.id);
    expect(denied).toEqual({ ok: false, error: "not_found" });
    expect(await ManualViewing.countDocuments({ _id: created.id })).toBe(1);

    // Owner can delete
    const allowed = await svc.removeManualViewing(owner, created.id);
    expect(allowed).toEqual({ ok: true });
    expect(await ManualViewing.countDocuments({ _id: created.id })).toBe(0);
    expect(await Expense.countDocuments({ manualViewingId: created.id })).toBe(0);
  });
});
