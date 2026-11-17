"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { removeSeatMark, saveSeatMark, seatMarkInputSchema } from "@/services/seat-mark.service";

export type MarkActionResult = { ok: true } | { ok: false; error: "invalid" | "not_found" };

/** The person is always the signed-in user: nothing about who they are comes from the request. */
export async function saveSeatMarkAction(input: unknown): Promise<MarkActionResult> {
  const user = await requireUser();
  const parsed = seatMarkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const result = await saveSeatMark(user.userId, parsed.data);
  if (!result.ok) return result;
  // Clears the client's cached copy of the room pages so the mark is there when the person comes back.
  revalidatePath("/cinemas", "layout");
  return { ok: true };
}

export async function removeSeatMarkAction(auditoriumId: string, seatCode: string): Promise<MarkActionResult> {
  const user = await requireUser();
  const result = await removeSeatMark(user.userId, auditoriumId, seatCode);
  if (!result.ok) return result;
  revalidatePath("/cinemas", "layout");
  return { ok: true };
}
