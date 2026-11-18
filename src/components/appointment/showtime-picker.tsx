"use client";

import { Circle, CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { Badge } from "@/components/ui/badge";
import { formatTime, vietnamDayKey } from "@/lib/datetime";
import { formatVnd, formatVndRange } from "@/lib/money";
import { vietnamToday } from "@/lib/movie/status";
import { cn } from "@/lib/utils";

export interface ShowtimeChoice {
  id: string;
  startAt: string;
  branchId: string;
  branchName: string;
  endAt: string;
  roomName: string;
  formatName: string;
  /** Whole dong; null when no price rule matches. The range shows when seat types differ. */
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
}

interface Props {
  showtimes: ShowtimeChoice[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** The day to open on (the day of the showtime the person came from). */
  initialDay?: string;
  /** The day is already decided: no day strip, only that day's showtimes. */
  hideDays?: boolean;
}

/**
 * Picks showtimes of one movie without listing them all: a strip of the days that have showtimes (one day at a time), a cinema filter
 * when there is more than one, then that day's showtimes. A picked showtime is shown by the check on its own row.
 */
export function ShowtimePicker({ showtimes, selectedIds, onToggle, initialDay, hideDays = false }: Props) {
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
          {days.map((key) => {
            const date = new Date(`${key}T00:00:00Z`);
            const open = key === day;
            return (
              <li key={key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setPickedDay(key)}
                  aria-pressed={open}
                  className={cn(
                    "flex min-h-row min-w-row flex-col items-center justify-center gap-tight rounded-2xl border px-inset py-inset-xs type-micro leading-tight! outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    open ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                  )}
                >
                  <span>{key === today ? t("today") : weekday.format(date)}</span>
                  <span className="type-item-title">{Number(key.slice(8))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>}

      {branches.length > 1 ? (
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
                    "flex w-full min-w-0 items-start gap-group rounded-xl border p-inset text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    chosen ? "border-primary bg-accent" : "bg-card",
                  )}
                >
                  <span className="flex w-row shrink-0 flex-col gap-tight">
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
                    <span className="type-secondary">{priceText}</span>
                  </span>
                  {chosen ? <CircleCheck className="size-icon-lg shrink-0 text-primary-text" aria-hidden /> : <Circle className="size-icon-lg shrink-0 text-muted-foreground" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
