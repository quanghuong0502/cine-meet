"use client";

import { BellIcon, BellRingIcon } from "@solar-icons/react/line-duotone";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const NOTIFICATIONS_READ_EVENT = "seatmate:notifications-read";

export function emitNotificationsRead(detail: { delta?: number; all?: boolean }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_READ_EVENT, { detail }));
}

interface Props {
  serverUnread: number;
  label: string;
  labelEmpty: string;
}

/**
 * Keeps the header bell badge in sync immediately when the user reads notifications one by one
 * (without forcing a full root layout cache invalidation on every tap) and passes `?back=` so
 * standalone PWA returns to the exact tab the user tapped the bell from.
 */
export function NotificationBellClient({ serverUnread, label, labelEmpty }: Props) {
  const pathname = usePathname();
  const [adjustment, setAdjustment] = useState<{ base: number; delta: number; cleared: boolean }>({
    base: serverUnread,
    delta: 0,
    cleared: false,
  });

  useEffect(() => {
    const onRead = (event: Event) => {
      const detail = (event as CustomEvent<{ delta?: number; all?: boolean }>).detail;
      setAdjustment((cur) => {
        const active = cur.base === serverUnread ? cur : { base: serverUnread, delta: 0, cleared: false };
        if (detail?.all) return { ...active, cleared: true };
        if (detail?.delta) return { ...active, delta: active.delta + detail.delta };
        return active;
      });
    };
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
  }, [serverUnread]);

  const active = adjustment.base === serverUnread ? adjustment : { base: serverUnread, delta: 0, cleared: false };
  const unread = active.cleared ? 0 : Math.max(0, serverUnread - active.delta);
  const href = pathname && pathname !== "/notifications" ? `/notifications?back=${encodeURIComponent(pathname)}` : "/notifications";

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={unread > 0 ? label : labelEmpty}
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
