import { BellIcon } from "@solar-icons/react/line-duotone";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { NotificationBellClient } from "@/components/notification-bell-client";
import { countUnread } from "@/services/notification.service";

/** Zero-shift fallback while `NotificationBellSlot` streams the unread count. */
export function NotificationBellFallback() {
  return (
    <Link
      href="/notifications"
      prefetch={false}
      aria-label="Notifications"
      className="relative flex size-target shrink-0 items-center justify-center rounded-full transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
    >
      <BellIcon className="size-icon-lg" aria-hidden />
    </Link>
  );
}

/** Async Server Component streamed inside `<Suspense>` so `UserLayout` never blocks on `countUnread`. */
export async function NotificationBellSlot({ userId }: { userId: string }) {
  const [unread, t] = await Promise.all([
    countUnread(userId).catch(() => 0),
    getTranslations("notifications"),
  ]);
  const label = t("bellUnread", { count: Math.max(1, unread) });
  return <NotificationBellClient serverUnread={unread} label={label} labelEmpty={t("bell")} />;
}
