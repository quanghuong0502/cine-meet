"use client";

import { CheckCircleIcon, CircleIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { Badge } from "@/components/ui/badge";
import { formatTime, vietnamDayKey } from "@/lib/datetime";
import { formatVnd, formatVndRange } from "@/lib/money";
import { vietnamToday } from "@/lib/movie/status";
import { cn } from "@/lib/utils";
// Kept in a plain (non "use client") module: a Server Component needs to call `toShowtimeChoice` directly, which is not
// possible with a function exported from a client module. Re-exported here so existing client imports keep working.
export { toShowtimeChoice, type ShowtimeChoice } from "@/lib/appointment/showtime-choice";
import type { ShowtimeChoice } from "@/lib/appointment/showtime-choice";

interface Props {
  showtimes: ShowtimeChoice[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** The day to open on (the day of the showtime the person came from). */
  initialDay?: string;
  /** The day is already decided: no day strip, only that day's showtimes. */
  hideDays?: boolean;
  /** The branch choice is made outside (the list is already narrowed): no branch chips here. */
  hideBranchFilter?: boolean;
}

/**
 * Picks showtimes of one movie without listing them all: a strip of the days that have showtimes (one day at a time), a cinema filter
 * when there is more than one, then that day's showtimes. A picked showtime is shown by the check on its own row.
 */
export function ShowtimePicker({ showtimes, selectedIds, onToggle, initialDay, hideDays = false, hideBranchFilter = false }: Props) {
  const t = useTranslations("showtimes");
  const ta = useTranslations("appointments.new");
  const locale = useLocale();
  const days = useMemo(() => [...new Set(showtimes.map((s) => vietnamDayKey(s.startAt)))].sort(), [showtimes]);
  const [pickedDay, setPickedDay] = useState<string | undefined>(initialDay);
  const day = pickedDay && days.includes(pickedDay) ? pickedDay : days[0];
  const [pickedBranch, setBranch] = useState<string | null>(null);
  const branches = useMemo(() => [...new Map(showtimes.map((s) => [s.branchId, s.branchName])).entries()], [showtimes]);
  const branch = pickedBranch && branches.some(([id]) => id === pickedBranch) ? pickedBranch : null;

  const shown = showtimes.filter((s) => vietnamDayKey(s.startAt) === day && (!branch || s.branchId === branch));

  const today = vietnamToday();
  const weekday = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { timeZone: "UTC", weekday: "short" });

  return (
    <div className="flex flex-col gap-item">
      {hideDays ? null : <nav aria-label={t("dayStrip")}>
        <ul className="scroll-strip flex gap-stack pb-tight">
          {days.map((key, index) => {
            const date = new Date(`${key}T00:00:00Z`);
            const open = key === day;
            const monthChanged = index > 0 && key.slice(5, 7) !== days[index - 1]?.slice(5, 7);
            const dayNum = Number(key.slice(8));
            const monthNum = Number(key.slice(5, 7));
            return (
              <li key={key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setPickedDay(key)}
                  aria-pressed={open}
                  className={cn(
                    "flex min-h-row min-w-row flex-col items-center justify-center gap-tight rounded-xl border px-inset py-inset-xs type-micro leading-tight! transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80",
                    open ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{key === today ? t("today") : weekday.format(date)}</span>
                  <span className="type-item-title tabular-nums">{monthChanged ? `${dayNum}/${monthNum}` : dayNum}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>}

      {branches.length > 1 && !hideBranchFilter ? (
        <div role="group" aria-label={t("filters.labels.branch")} className="scroll-strip flex gap-stack pb-tight">
          <Chip selected={branch === null} onClick={() => setBranch(null)}>
            {t("filters.all")}
          </Chip>
          {branches.map(([id, name]) => (
            <Chip key={id} selected={branch === id} onClick={() => setBranch(id)}>
              {name}
            </Chip>
          ))}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="py-inset text-center type-secondary text-muted-foreground">{ta("noShowtimesFilter")}</p>
      ) : (
        <ul className="flex flex-col gap-stack">
          {shown.map((s) => {
            const chosen = selectedIds.includes(s.id);
            // Same price rule as the showtime card: a range when the room has several seat types.
            const priceText =
              s.priceMin !== null && s.priceMax !== null && s.priceMax > s.priceMin
                ? t("price", { amount: formatVndRange(s.priceMin, s.priceMax, locale) })
                : s.price === null
                  ? t("noPrice")
                  : t("price", { amount: formatVnd(s.price, locale) });
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => onToggle(s.id)}
                  className={cn(
                    "flex w-full min-w-0 items-start gap-group rounded-xl border p-inset text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60",
                    chosen ? "border-primary bg-accent" : "bg-card",
                  )}
                >
                  <span className="flex min-w-row shrink-0 flex-col gap-tight whitespace-nowrap">
                    <span className="type-heading leading-6! tabular-nums">{formatTime(s.startAt, locale)}</span>
                    <span className="type-secondary text-muted-foreground tabular-nums">{t("until", { time: formatTime(s.endAt, locale) })}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-stack">
                    <span className="break-words type-body">{s.branchName}</span>
                    <span className="flex flex-wrap items-center gap-x-item gap-y-stack">
                      <span className="type-secondary text-muted-foreground">{s.roomName}</span>
                      <Badge variant="secondary">
                        {s.formatName}
                      </Badge>
                    </span>
                    <span className="type-secondary tabular-nums">{priceText}</span>
                  </span>
                  {chosen ? <CheckCircleIcon className="size-icon-lg shrink-0 text-primary-text" aria-hidden /> : <CircleIcon className="size-icon-lg shrink-0 text-muted-foreground" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
