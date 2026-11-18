"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { ShowtimeCard } from "@/components/movie/showtime-card";
import { vietnamDayKey } from "@/lib/datetime";
import { vietnamToday } from "@/lib/movie/status";
import { cn } from "@/lib/utils";
import type { ShowtimeRow } from "@/services/showtime.service";

/**
 * The showtimes of one movie, with filters so a long schedule is not one endless scroll: a strip of the days that have showtimes
 * (one day is shown at a time), then the cinema and the format when there is more than one. All rows are already here, so
 * filtering is instant and needs no round trip.
 */
export function MovieShowtimes({ rows }: { rows: ShowtimeRow[] }) {
  const t = useTranslations("showtimes");
  const tm = useTranslations("movie");
  const locale = useLocale();
  const days = useMemo(() => [...new Set(rows.map((row) => vietnamDayKey(row.startAt)))].sort(), [rows]);
  const [picked, setDay] = useState(days[0]);
  // The picked day may vanish when the list refreshes (its showtimes were deleted): fall back to the first one.
  const day = days.includes(picked) ? picked : days[0];
  const [branch, setBranch] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);

  const branches = useMemo(() => [...new Map(rows.map((row) => [row.branch.id, [row.branch.brandName, row.branch.name].filter(Boolean).join(" · ")])).entries()], [rows]);
  const formats = useMemo(() => [...new Map(rows.map((row) => [row.format.id, row.format.name])).entries()], [rows]);
  const shown = rows.filter((row) => vietnamDayKey(row.startAt) === day && (!branch || row.branch.id === branch) && (!format || row.format.id === format));

  const today = vietnamToday();
  const weekday = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { timeZone: "UTC", weekday: "short" });

  const choices = (label: string, items: [string, string][], value: string | null, set: (next: string | null) => void) =>
    items.length > 1 ? (
      <div role="group" aria-label={label} className="scroll-strip flex gap-2 pb-1">
        <Chip selected={value === null} onClick={() => set(null)}>
          {t("filters.all")}
        </Chip>
        {items.map(([id, name]) => (
          <Chip key={id} selected={value === id} onClick={() => set(id)}>
            {name}
          </Chip>
        ))}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("dayStrip")}>
        <ul className="scroll-strip flex gap-2 pb-1">
          {days.map((key) => {
            const date = new Date(`${key}T00:00:00Z`);
            const selected = key === day;
            return (
              <li key={key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setDay(key)}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-h-row min-w-16 flex-col items-center justify-center gap-0.5 rounded-2xl border px-4 py-2 type-micro leading-tight! outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
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

      {choices(t("filters.labels.branch"), branches, branch, setBranch)}
      {choices(t("filters.labels.format"), formats, format, setFormat)}

      {shown.length === 0 ? (
        <p className="py-6 text-center type-secondary text-muted-foreground">{tm("noMatch")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((row) => (
            <ShowtimeCard key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
