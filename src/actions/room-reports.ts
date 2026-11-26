"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { reportRoom, resolveRoomReport, roomReportInputSchema } from "@/services/room-report.service";

export type ReportRoomResult = { ok: true } | { ok: false; error: "invalid" | "not_found" };

export async function reportRoomAction(input: unknown): Promise<ReportRoomResult> {
  const user = await requireUser();
  const parsed = roomReportInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const result = await reportRoom(user.userId, parsed.data);
  if (result.ok) {
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/room-reports");
  }
  return result;
}

export async function resolveRoomReportAction(id: string): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  await requireAdmin();
  const result = await resolveRoomReport(typeof id === "string" ? id : "");
  if (result.ok) {
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/room-reports");
  }
  return result;
}
