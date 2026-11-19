"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The bell in the app bar: a link to the notification list with the number of unread ones (words for screen readers, not just a dot). */
export function NotificationBell({ unread }: { unread: number }) {
  const t = useTranslations("notifications");
  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? t("bellUnread", { count: unread }) : t("bell")}
      className="relative flex size-target shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Bell className="size-icon-lg" aria-hidden />
      {unread > 0 ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-0 right-0 flex h-icon min-w-icon items-center justify-center rounded-full bg-primary px-tight type-tag text-primary-foreground tabular-nums",
          )}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
