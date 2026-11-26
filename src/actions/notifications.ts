"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { markAllRead, markRead } from "@/services/notification.service";

// Only the signed-in person's own notifications are ever touched: the service filters by the session's user.

export async function markNotificationReadAction(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const changed = await markRead(user.userId, typeof id === "string" ? id : "");
  // Avoid invalidating the whole root layout on every tap (which clears the 30s Client Router Cache while navigating).
  if (changed) revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await markAllRead(user.userId);
  revalidatePath("/notifications");
  revalidatePath("/(user)", "layout");
  return { ok: true };
}
