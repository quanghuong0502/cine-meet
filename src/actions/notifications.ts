"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { markAllRead, markRead } from "@/services/notification.service";

// Only the signed-in person's own notifications are ever touched: the service filters by the session's user.

export async function markNotificationReadAction(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const changed = await markRead(user.userId, typeof id === "string" ? id : "");
  // The bell's badge lives in the layout, so the layout is refreshed.
  if (changed) revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await markAllRead(user.userId);
  revalidatePath("/", "layout");
  return { ok: true };
}
