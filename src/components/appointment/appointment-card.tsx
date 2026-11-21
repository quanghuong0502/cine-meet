import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { AppointmentStatusBadge } from "@/components/appointment/status-badge";
import { ListThumb } from "@/components/list-thumb";
import { formatDayCompact, formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { AppointmentSummary } from "@/services/appointment.service";

/**
 * One appointment in the list, three lines: movie, when, and the status with the one fact that matters for this person:
 * the creator sees how many have answered, an invited person sees that an answer is waiting for them (or who made it).
 */
export function AppointmentCard({ item }: { item: AppointmentSummary }) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const when =
    item.status === "INVITING" && item.optionCount > 1
      ? t("timesCount", { count: item.optionCount })
      : `${formatDayCompact(item.startAt, locale)} · ${formatTime(item.startAt, locale)}`;

  // The card never says who made the plan; it only says what to do next (answer, or the creator's progress).
  const note = item.isCreator
    ? item.status === "INVITING"
      ? t("answered", { answered: item.answeredCount, total: item.participantCount })
      : item.status === "PARTICIPANTS_LOCKED" || item.status === "PLANNING" || item.status === "CONFIRMED"
        ? t("peopleGoing", { count: item.attendeeCount })
        : null
    : item.needsReply
      ? t("needsReply")
      : null;

  // The note is the fact to act on, so it is a step heavier than the time above it (medium weight): waiting for my answer stands out in the
  // accent colour, the creator's progress in normal text, .
  const noteColor = item.isCreator ? "text-foreground" : item.needsReply ? "text-primary-text" : "text-muted-foreground";

  return (
    <li>
      <Link href={`/appointments/${item.id}`} className="flex min-h-row items-center gap-item rounded-xl border bg-card p-inset-sm">
        <ListThumb shape="poster" imageUrl={item.movie.posterUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-tight">
          <span className="break-words type-item-title">{item.movie.title}</span>
          <span className="type-secondary text-muted-foreground tabular-nums">{when}</span>
          <span className="flex flex-wrap items-center gap-x-stack gap-y-tight">
            <AppointmentStatusBadge status={item.status} />
            {note ? <span className={cn("type-label", noteColor)}>{note}</span> : null}
          </span>
        </div>
      </Link>
    </li>
  );
}
