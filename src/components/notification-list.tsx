"use client";

import { CheckCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { formatDayLong, formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  read: boolean;
}

/** The notification list: unread ones are marked by a dot and bold title (and the word "new" for screen readers). Tapping one opens it and marks it read. */
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const hasUnread = items.some((item) => !item.read);

  function markAll() {
    start(async () => {
      const result = await markAllNotificationsReadAction().catch(() => null);
      if (result) toast.success(t("allRead"));
      else toast.error(t("networkError"));
    });
  }

  return (
    <div className="flex flex-col gap-group">
      {hasUnread ? (
        <Button type="button" variant="outline" size="pill" disabled={pending} onClick={markAll} className="self-start">
          <CheckCheck aria-hidden />
          {t("markAll")}
        </Button>
      ) : null}
      <ul className="flex flex-col gap-stack">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.url}
              onClick={() => {
                // Fire and forget: the page opens at once; the badge catches up when the layout refreshes.
                if (!item.read) void markNotificationReadAction(item.id).catch(() => undefined);
              }}
              className="flex min-h-row items-start gap-item rounded-xl border bg-card p-inset-sm"
            >
              <span aria-hidden className={cn("mt-stack size-icon-xs shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primary")} />
              <span className="flex min-w-0 flex-1 flex-col gap-tight">
                <span className={cn("break-words type-item-title", item.read && "text-muted-foreground")}>
                  {item.read ? null : <span className="sr-only">{t("new")} </span>}
                  {item.title}
                </span>
                <span className="break-words type-body">{item.body}</span>
                <span className="type-secondary text-muted-foreground tabular-nums">
                  {formatDayLong(item.createdAt, locale)} · {formatTime(item.createdAt, locale)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
