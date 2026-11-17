import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";
import type { ShowtimeRow } from "@/services/showtime.service";

/**
 * One screening: when (3 lines on the left), then branch, room with format, and price (3 rows on the right, so both columns end together). The "Create plan" button comes back with plans (Sprint 4); a disabled
 * copy on every card only took height (about a third of the card), so it is left out until then.
 * `showMovie` adds the movie title (when the list is not already grouped by movie).
 */
export function ShowtimeCard({ row, showMovie = false }: { row: ShowtimeRow; showMovie?: boolean }) {
  const t = useTranslations("showtimes");
  const locale = useLocale();
  return (
    <li className="flex min-w-0 items-start gap-4 rounded-xl border bg-card p-4">
      <div className="flex w-16 shrink-0 flex-col gap-0.5">
        <span className="text-xl leading-6 font-semibold tabular-nums">{formatTime(row.startAt, locale)}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{t("until", { time: formatTime(row.endAt, locale) })}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {showMovie ? (
          <Link href={`/movies/${row.movie.id}`} className="truncate text-base font-semibold">
            {row.movie.title}
          </Link>
        ) : null}
        <span className="break-words text-base">{[row.branch.brandName, row.branch.name].filter(Boolean).join(" · ")}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-sm text-muted-foreground">{row.auditorium.name}</span>
          <Badge variant="secondary" className="h-auto py-0.5 text-xs font-medium">
            {row.format.name}
          </Badge>
        </span>
        <span className="text-sm">{row.price === null ? t("noPrice") : t("price", { amount: formatVnd(row.price, locale) })}</span>
      </div>
    </li>
  );
}
