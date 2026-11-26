import { BellIcon, BellRingIcon } from "@solar-icons/react/line-duotone";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { countUnread } from "@/services/notification.service";
import { cn } from "@/lib/utils";

/** Pure Server Component bell: never ships the `notifications` i18n namespace to client shells. */
export function NotificationBell({ unread, label }: { unread: number; label: string }) {
  return (
    <Link
      href="/notifications"
      prefetch={false}
      aria-label={label}
      className="relative flex size-target shrink-0 items-center justify-center rounded-full transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
    >
      {unread > 0 ? (
        <BellRingIcon className="size-icon-lg text-primary-text" aria-hidden />
      ) : (
        <BellIcon className="size-icon-lg" aria-hidden />
      )}
      {unread > 0 ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-hair right-hair flex h-icon min-w-icon items-center justify-center rounded-full bg-primary px-tight type-tag text-primary-foreground tabular-nums",
          )}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

/** Zero-shift fallback while `NotificationBellSlot` streams the unread count. */
export function NotificationBellFallback() {
  return (
    <Link
      href="/notifications"
      prefetch={false}
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
  const label = unread > 0 ? t("bellUnread", { count: unread }) : t("bell");
  return <NotificationBell unread={unread} label={label} />;
}
