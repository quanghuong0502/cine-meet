import { AltArrowRightIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { AppointmentStatusBadge } from "@/components/appointment/status-badge";
import { ListThumb } from "@/components/list-thumb";
import { formatDayCompact, formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { AppointmentSummary } from "@/services/appointment.service";

/**
 * One appointment in the list, three lines: movie, when, and the status with the one fact that matters for this person:
 * the creator sees how many have answered, an invited person sees that an answer is waiting for them (or who is going).
 */
export function AppointmentCard({ item }: { item: AppointmentSummary }) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const when =
    item.status === "INVITING" && item.optionCount > 1
      ? t("timesCount", { count: item.optionCount })
      : `${formatDayCompact(item.startAt, locale)} · ${formatTime(item.startAt, locale)}`;

  const goingStage = item.status === "PARTICIPANTS_LOCKED" || item.status === "PLANNING" || item.status === "CONFIRMED";
  const note = item.isCreator
    ? item.status === "INVITING"
      ? t("answered", { answered: item.answeredCount, total: item.participantCount })
      : goingStage
        ? t("peopleGoing", { count: item.attendeeCount })
        : null
    : item.needsReply
      ? t("needsReply")
      : goingStage
        ? t("peopleGoing", { count: item.attendeeCount })
        : null;

  const noteColor = item.needsReply ? "text-primary-text" : item.isCreator ? "text-foreground" : "text-muted-foreground";
  const past = item.status === "COMPLETED" || item.status === "CANCELLED";

  return (
    <li className="list-card-cv">
      <Link
        href={`/appointments/${item.id}`}
        prefetch={false}
        className={cn(
          "flex min-h-row items-center gap-item rounded-xl border bg-card p-inset-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60",
          item.needsReply && "border-primary/50",
          past && "opacity-80",
        )}
      >
        <ListThumb shape="poster" imageUrl={item.movie.posterUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-tight">
          <span className="break-words type-item-title">{item.movie.title}</span>
          <span className="type-secondary text-muted-foreground tabular-nums">{when}</span>
          <span className="flex flex-wrap items-center gap-x-stack gap-y-tight">
            <AppointmentStatusBadge status={item.status} />
            {note ? <span className={cn("type-label", noteColor)}>{note}</span> : null}
          </span>
        </div>
        <AltArrowRightIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
