import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/datetime";
import { formatVnd, formatVndRange } from "@/lib/money";
import type { ShowtimeRow } from "@/services/showtime.service";

/**
 * One screening: when (3 lines on the left), then branch, room with format, and price (3 rows in the middle, so both columns end together),
 * and a small round "plan this showtime" button on the right (an icon, so it adds width rather than the height a full button would).
 * `showMovie` adds the movie title (when the list is not already grouped by movie).
 */
export function ShowtimeCard({ row, showMovie = false }: { row: ShowtimeRow; showMovie?: boolean }) {
  const t = useTranslations("showtimes");
  const locale = useLocale();
  // A room with several seat types (standard, VIP, couple...) shows the range; otherwise the one price.
  const priceText =
    row.priceMin !== null && row.priceMax !== null && row.priceMax > row.priceMin
      ? t("price", { amount: formatVndRange(row.priceMin, row.priceMax, locale) })
      : row.price === null
        ? t("noPrice")
        : t("price", { amount: formatVnd(row.price, locale) });
  return (
    <li className="flex min-w-0 items-start gap-group rounded-xl border bg-card p-inset">
      <div className="flex w-row shrink-0 flex-col gap-tight">
        <span className="type-heading leading-6! tabular-nums">{formatTime(row.startAt, locale)}</span>
        <span className="type-secondary text-muted-foreground tabular-nums">{t("until", { time: formatTime(row.endAt, locale) })}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-stack">
        {showMovie ? (
          <Link href={`/movies/${row.movie.id}`} className="truncate type-item-title">
            {row.movie.title}
          </Link>
        ) : null}
        <span className="break-words type-body">{[row.branch.brandName, row.branch.name].filter(Boolean).join(" · ")}</span>
        <span className="flex flex-wrap items-center gap-x-item gap-y-stack">
          <span className="type-secondary text-muted-foreground">{row.auditorium.name}</span>
          <Badge variant="secondary" className="h-auto py-hair type-tag">
            {row.format.name}
          </Badge>
        </span>
        <span className="type-secondary">{priceText}</span>
      </div>
      <Button asChild variant="outline" size="icon" className="shrink-0 rounded-full">
        <Link href={`/appointments/new?showtimeId=${row.id}`} aria-label={t("createPlan")}>
          <CalendarPlus aria-hidden />
        </Link>
      </Button>
    </li>
  );
}
