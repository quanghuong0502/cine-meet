import { CalendarHeart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";
import type { ShowtimeRow } from "@/services/showtime.service";

/**
 * One screening: when, where, format and estimated price. "Create plan" is shown but off until plans exist (Sprint 4).
 * `showMovie` adds the movie title (when the list is not already grouped by movie).
 */
export function ShowtimeCard({ row, showMovie = false }: { row: ShowtimeRow; showMovie?: boolean }) {
  const t = useTranslations("showtimes");
  const locale = useLocale();
  return (
    <li className="flex flex-col gap-5 rounded-xl border bg-card p-4">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex w-16 shrink-0 flex-col gap-0.5">
          <span className="text-xl font-semibold tabular-nums">{formatTime(row.startAt, locale)}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{t("until", { time: formatTime(row.endAt, locale) })}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {showMovie ? (
            <Link href={`/movies/${row.movie.id}`} className="truncate text-base font-semibold">
              {row.movie.title}
            </Link>
          ) : null}
          <span className="break-words text-base">{[row.branch.brandName, row.branch.name].filter(Boolean).join(" · ")}</span>
          <span className="text-sm text-muted-foreground">{row.auditorium.name}</span>
          <span className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="h-auto py-0.5 text-xs font-medium">
              {row.format.name}
            </Badge>
            <span className="text-sm">{row.price === null ? t("noPrice") : t("price", { amount: formatVnd(row.price, locale) })}</span>
          </span>
        </div>
      </div>
      <Button type="button" variant="secondary" disabled className="h-target w-full rounded-full">
        <CalendarHeart aria-hidden />
        {t("createPlanSoon")}
      </Button>
    </li>
  );
}
