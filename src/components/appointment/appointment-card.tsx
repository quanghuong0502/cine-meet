import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { AppointmentStatusBadge } from "@/components/appointment/status-badge";
import { ListThumb } from "@/components/list-thumb";
import { Badge } from "@/components/ui/badge";
import { formatDayLong, formatTime } from "@/lib/datetime";
import type { AppointmentSummary } from "@/services/appointment.service";

/** One appointment in the list: poster, movie, when, who made it, status, and a flag when it waits for this person's answer. */
export function AppointmentCard({ item }: { item: AppointmentSummary }) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const when = item.status === "INVITING" && item.optionCount > 1 ? t("timesCount", { count: item.optionCount }) : `${formatDayLong(item.startAt, locale)} · ${formatTime(item.startAt, locale)}`;
  return (
    <li>
      <Link href={`/appointments/${item.id}`} className="flex min-h-row items-center gap-item rounded-xl border bg-card p-inset-sm">
        <ListThumb imageUrl={item.movie.posterUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-tight">
          <span className="break-words type-item-title">{item.movie.title}</span>
          <span className="type-secondary text-muted-foreground">{when}</span>
          <span className="type-secondary text-muted-foreground">{item.isCreator ? t("byMe") : t("byName", { name: item.creatorName })}</span>
          <span className="flex flex-wrap items-center gap-stack">
            <AppointmentStatusBadge status={item.status} />
            {item.needsReply ? (
              <Badge variant="outline" className="h-auto py-hair type-tag">
                {t("needsReply")}
              </Badge>
            ) : null}
          </span>
        </div>
      </Link>
    </li>
  );
}
