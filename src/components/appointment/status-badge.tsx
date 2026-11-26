import { CalendarMarkIcon, CloseCircleIcon, ConfettiIcon, StarsMinimalisticIcon, TicketStarIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/appointment/state";

/** Status as words + icon + semantic tint so lifecycle stages read at a glance in both themes. */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const t = useTranslations("appointments.status");
  if (status === "CANCELLED") {
    return (
      <Badge variant="destructive">
        <CloseCircleIcon aria-hidden />
        {t(status)}
      </Badge>
    );
  }
  if (status === "CONFIRMED") {
    return (
      <Badge variant="secondary" className={cn("bg-success/15 text-success")}>
        <TicketStarIcon aria-hidden />
        {t(status)}
      </Badge>
    );
  }
  if (status === "PLANNING" || status === "PARTICIPANTS_LOCKED") {
    return (
      <Badge variant="secondary" className="bg-info/15 text-info">
        <StarsMinimalisticIcon aria-hidden />
        {t(status)}
      </Badge>
    );
  }
  if (status === "INVITING") {
    return (
      <Badge variant="accent">
        <CalendarMarkIcon aria-hidden />
        {t(status)}
      </Badge>
    );
  }
  if (status === "COMPLETED") {
    return (
      <Badge variant="secondary">
        <ConfettiIcon aria-hidden />
        {t(status)}
      </Badge>
    );
  }
  return <Badge variant="outline">{t(status)}</Badge>;
}
