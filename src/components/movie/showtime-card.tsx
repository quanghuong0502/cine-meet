import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { CalendarMarkIcon } from "@solar-icons/react/line-duotone";
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
    <li className="list-card-cv flex min-w-0 flex-col gap-item rounded-xl border bg-card p-inset">
      <div className="flex flex-wrap items-center justify-between gap-stack">
        <div className="flex items-baseline gap-stack tabular-nums">
          <span className="type-heading leading-6!">{formatTime(row.startAt, locale)}</span>
          <span className="type-secondary text-muted-foreground">– {formatTime(row.endAt, locale)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-stack">
          <Badge variant="secondary">{row.format.name}</Badge>
          <Badge variant={row.price === null && row.priceMin === null ? "outline" : "accent"} className="tabular-nums">
            {priceText}
          </Badge>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-item">
        <div className="flex min-w-0 flex-1 flex-col gap-tight">
          {showMovie ? (
            <Link
              href={`/movies/${row.movie.id}`}
              prefetch={false}
              className="inline-flex min-h-target items-center truncate type-item-title text-primary-text outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {row.movie.title}
            </Link>
          ) : null}
          <span className="break-words type-body">{[row.branch.brandName, row.branch.name].filter(Boolean).join(" · ")}</span>
          <span className="type-secondary text-muted-foreground">{row.auditorium.name}</span>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full">
          <Link href={`/appointments/new?showtimeId=${row.id}`} prefetch={false} aria-label={t("createPlan")}>
            <CalendarMarkIcon aria-hidden />
            {t("planShort")}
          </Link>
        </Button>
      </div>
    </li>
  );
}
