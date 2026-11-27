"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { logManualViewing, manualViewingInputSchema, removeManualViewing } from "@/services/expense.service";

export type LogViewingError = "invalid" | "future_date";
export type LogViewingResult = { ok: true; id: string } | { ok: false; error: LogViewingError };

export async function logManualViewingAction(input: unknown): Promise<LogViewingResult> {
  const user = await requireUser();
  const parsed = manualViewingInputSchema.safeParse(input);
  if (!parsed.success) {
    const isFuture = parsed.error.issues.some((i) => i.message === "future_date");
    return { ok: false, error: isFuture ? "future_date" : "invalid" };
  }
  const result = await logManualViewing(user.userId, parsed.data);
  revalidatePath("/");
  revalidatePath("/log-viewing");
  revalidatePath("/cinemas", "layout");
  return result;
}

export async function removeManualViewingAction(id: string): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  const user = await requireUser();
  const result = await removeManualViewing(user.userId, typeof id === "string" ? id : "");
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/log-viewing");
    revalidatePath("/cinemas", "layout");
  }
  return result;
}
