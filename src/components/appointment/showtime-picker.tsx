"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { formatDayLong, formatTime, vietnamDayKey } from "@/lib/datetime";
import { vietnamToday } from "@/lib/movie/status";
import { cn } from "@/lib/utils";

export interface ShowtimeChoice {
  id: string;
  startAt: string;
  branchId: string;
  branchName: string;
  /** "Room · Format". */
  label: string;
}

interface Props {
  showtimes: ShowtimeChoice[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** The day to open on (the day of the showtime the person came from). */
  initialDay?: string;
}

/**
 * Picks showtimes of one movie without listing them all: a strip of the days that have showtimes (one day at a time), a cinema filter
 * when there is more than one, then that day's showtimes. What is picked stays visible as chips on top, whatever day is open.
 */
export function ShowtimePicker({ showtimes, selectedIds, onToggle, initialDay }: Props) {
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
  const selected = selectedIds.map((id) => showtimes.find((s) => s.id === id)).filter((s): s is ShowtimeChoice => Boolean(s));

  const today = vietnamToday();
  const weekday = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { timeZone: "UTC", weekday: "short" });

  return (
    <div className="flex flex-col gap-item">
      {selected.length > 0 ? (
        <div role="group" aria-label={ta("pickedShowtimes")} className="flex flex-wrap gap-stack">
          {selected.map((s) => (
            <Chip key={s.id} selected onClick={() => onToggle(s.id)} aria-label={ta("removeTime")}>
              {formatDayLong(s.startAt, locale)} · {formatTime(s.startAt, locale)}
              <X className="size-icon-sm" aria-hidden />
            </Chip>
          ))}
        </div>
      ) : null}

      <nav aria-label={t("dayStrip")}>
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
      </nav>

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
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => onToggle(s.id)}
                  className={cn(
                    "flex min-h-target w-full items-center gap-item rounded-xl border p-inset-sm text-left transition-colors",
                    chosen ? "border-transparent bg-primary text-primary-foreground" : "bg-card",
                  )}
                >
                  <span className="shrink-0 type-item-title tabular-nums">{formatTime(s.startAt, locale)}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-tight">
                    <span className="break-words type-body">{s.branchName}</span>
                    <span className={cn("break-words type-secondary", !chosen && "text-muted-foreground")}>{s.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
