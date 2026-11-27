"use client";

import type { Icon as SolarIcon } from "@solar-icons/react/lib/types";
import {
  BellIcon,
  BellRingIcon,
  CalendarCloseIcon,
  CalendarMarkIcon,
  CheckReadIcon,
  HandHeartIcon,
  LoaderIcon,
  PiggyBankIcon,
  TicketStarIcon,
  UserPlusRoundedIcon,
  WalletMoneyIcon,
} from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/actions/notifications";
import { emitNotificationsRead } from "@/components/notification-bell-client";
import { Button } from "@/components/ui/button";
import { IconBadge, type IconBadgeTone } from "@/components/ui/icon-badge";
import { formatDayLong, formatTime, vietnamDayKey } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/notifications/types";

export interface NotificationItem {
  id: string;
  type?: NotificationType;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  read: boolean;
}

function categoryVisual(type?: NotificationType): { Icon: SolarIcon; tone: IconBadgeTone } {
  switch (type) {
    case "friend_request":
      return { Icon: UserPlusRoundedIcon, tone: "info" };
    case "friend_accepted":
      return { Icon: HandHeartIcon, tone: "primary" };
    case "budget_warning":
      return { Icon: PiggyBankIcon, tone: "warning" };
    case "expense_reminder":
      return { Icon: WalletMoneyIcon, tone: "warning" };
    case "appointment_confirmed":
      return { Icon: TicketStarIcon, tone: "success" };
    case "appointment_cancelled":
    case "participant_withdrew":
      return { Icon: CalendarCloseIcon, tone: "destructive" };
    case "showtime_reminder":
    case "poll_reminder":
    case "response_deadline_warning":
      return { Icon: BellRingIcon, tone: "primary" };
    case "appointment_invited":
    case "appointment_reply":
    case "participants_locked":
    case "appointment_changed":
      return { Icon: CalendarMarkIcon, tone: "primary" };
    default:
      return { Icon: BellIcon, tone: "primary" };
  }
}

/** The notification list: unread ones are marked by a tinted surface, dot and bold title. Tapping one opens it and marks it read. */
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  const isRead = (item: NotificationItem) => item.read || readIds.has(item.id);
  const hasUnread = items.some((item) => !isRead(item));
  const todayKey = vietnamDayKey(new Date().toISOString());

  function markAll() {
    const unreadIds = items.filter((item) => !isRead(item)).map((item) => item.id);
    setReadIds((prev) => new Set([...prev, ...unreadIds]));
    start(async () => {
      const result = await markAllNotificationsReadAction().catch(() => null);
      if (result) {
        emitNotificationsRead({ all: true });
        toast.success(t("allRead"));
      } else {
        setReadIds((prev) => {
          const next = new Set(prev);
          for (const id of unreadIds) next.delete(id);
          return next;
        });
        toast.error(t("networkError"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-group">
      {hasUnread ? (
        <Button type="button" variant="outline" size="cta-sm" disabled={pending} onClick={markAll} className="w-auto self-start px-inset">
          {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <CheckReadIcon aria-hidden />}
          {t("markAll")}
        </Button>
      ) : null}
      <ul className="flex flex-col gap-stack">
        {items.map((item) => {
          const read = isRead(item);
          const { Icon, tone } = categoryVisual(item.type);
          const sameDay = vietnamDayKey(item.createdAt) === todayKey;
          const stamp = sameDay
            ? t("todayAt", { time: formatTime(item.createdAt, locale) })
            : `${formatDayLong(item.createdAt, locale)} · ${formatTime(item.createdAt, locale)}`;
          return (
            <li key={item.id} className="list-card-cv">
              <Link
                href={item.url}
                prefetch={false}
                onClick={() => {
                  if (!read) {
                    setReadIds((prev) => new Set(prev).add(item.id));
                    emitNotificationsRead({ delta: 1 });
                    void markNotificationReadAction(item.id).catch(() => undefined);
                  }
                }}
                className={cn(
                  "flex min-h-row items-start gap-item rounded-xl border p-inset-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80",
                  read ? "bg-card hover:bg-muted/50" : "border-primary/30 bg-accent/25 hover:bg-accent/40",
                )}
              >
                <span aria-hidden className="relative shrink-0">
                  <IconBadge tone={read ? "muted" : tone} size="md">
                    <Icon />
                  </IconBadge>
                  {!read ? <span className="absolute -top-hair -right-hair size-icon-xs rounded-full border-2 border-card bg-primary" /> : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-tight">
                  <span className={cn("break-words type-item-title", read && "font-medium! text-muted-foreground")}>
                    {read ? null : <span className="sr-only">{t("new")} </span>}
                    {item.title}
                  </span>
                  <span className={cn("break-words type-body", read && "text-muted-foreground")}>{item.body}</span>
                  <span className="type-secondary text-muted-foreground tabular-nums">{stamp}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
