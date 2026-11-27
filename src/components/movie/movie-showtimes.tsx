"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { ShowtimeCard } from "@/components/movie/showtime-card";
import { Button } from "@/components/ui/button";
import { vietnamDayKey } from "@/lib/datetime";
import { vietnamToday } from "@/lib/movie/status";
import { cn } from "@/lib/utils";
import type { ShowtimeRow } from "@/services/showtime.service";

const weekdayFormatters = new Map<string, Intl.DateTimeFormat>();
function weekdayFormatter(locale: string): Intl.DateTimeFormat {
  const tag = locale === "en" ? "en-GB" : "vi-VN";
  let fmt = weekdayFormatters.get(tag);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(tag, { timeZone: "UTC", weekday: "short" });
    weekdayFormatters.set(tag, fmt);
  }
  return fmt;
}

/**
 * The showtimes of one movie, with filters so a long schedule is not one endless scroll: a strip of the days that have showtimes
 * (one day is shown at a time), then the cinema and the format available on that day. All rows are already here, so
 * filtering is instant and needs no round trip.
 */
export function MovieShowtimes({ rows, backHref }: { rows: ShowtimeRow[]; backHref?: string }) {
  const t = useTranslations("showtimes");
  const tm = useTranslations("movie");
  const locale = useLocale();
  const days = useMemo(() => [...new Set(rows.map((row) => vietnamDayKey(row.startAt)))].sort(), [rows]);
  const [picked, setDay] = useState(days[0]);
  // The picked day may vanish when the list refreshes (its showtimes were deleted): fall back to the first one.
  const day = days.includes(picked) ? picked : days[0];
  const [branch, setBranch] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);

  const dayRows = useMemo(() => rows.filter((row) => vietnamDayKey(row.startAt) === day), [rows, day]);
  const branches = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of dayRows) if (!format || row.format.id === format) map.set(row.branch.id, [row.branch.brandName, row.branch.name].filter(Boolean).join(" · "));
    if (branch && !map.has(branch)) {
      const existing = rows.find((r) => r.branch.id === branch);
      if (existing) map.set(branch, [existing.branch.brandName, existing.branch.name].filter(Boolean).join(" · "));
    }
    return [...map.entries()];
  }, [dayRows, format, branch, rows]);
  const formats = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of dayRows) if (!branch || row.branch.id === branch) map.set(row.format.id, row.format.name);
    if (format && !map.has(format)) {
      const existing = rows.find((r) => r.format.id === format);
      if (existing) map.set(format, existing.format.name);
    }
    return [...map.entries()];
  }, [dayRows, branch, format, rows]);
  const shown = dayRows.filter((row) => (!branch || row.branch.id === branch) && (!format || row.format.id === format));

  const today = vietnamToday();
  const weekday = weekdayFormatter(locale);

  const choices = (label: string, items: [string, string][], value: string | null, set: (next: string | null) => void) =>
    items.length > 1 || value !== null ? (
      <div role="group" aria-label={label} className="scroll-strip flex gap-stack pb-tight">
        <Chip selected={value === null} onClick={() => set(null)}>
          <span className="truncate">{t("filters.all")}</span>
        </Chip>
        {items.map(([id, name]) => (
          <Chip key={id} selected={value === id} onClick={() => set(id)}>
            <span className="min-w-0 truncate">{name}</span>
          </Chip>
        ))}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-group">
      <nav aria-label={t("dayStrip")}>
        <ul className="scroll-strip flex gap-stack pb-tight">
          {days.map((key, index) => {
            const date = new Date(`${key}T00:00:00Z`);
            const selected = key === day;
            const monthChanged = index > 0 && key.slice(5, 7) !== days[index - 1]?.slice(5, 7);
            const dayNum = Number(key.slice(8));
            const monthNum = Number(key.slice(5, 7));
            return (
              <li key={key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setDay(key)}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-h-row min-w-row flex-col items-center justify-center gap-tight rounded-xl border px-inset py-inset-xs type-micro leading-tight! transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80",
                    selected ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{key === today ? t("today") : weekday.format(date)}</span>
                  <span className="type-item-title tabular-nums">{monthChanged ? `${dayNum}/${monthNum}` : dayNum}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {choices(t("filters.labels.branch"), branches, branch, setBranch)}
      {choices(t("filters.labels.format"), formats, format, setFormat)}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-item py-inset-lg text-center">
          <p className="type-secondary text-muted-foreground">{tm("noMatch")}</p>
          {branch || format ? (
            <Button
              type="button"
              variant="outline"
              size="pill"
              onClick={() => {
                setBranch(null);
                setFormat(null);
              }}
            >
              {t("filters.clear")}
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-item">
          {shown.map((row) => (
            <ShowtimeCard key={row.id} row={row} backHref={backHref} />
          ))}
        </ul>
      )}
    </div>
  );
}
