import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/lib/appointment/state";

/** Status as words (colour is never the only sign): cancelled is red-tinted, "inviting" is the soft accent pill, the rest are neutral. */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const t = useTranslations("appointments.status");
  const variant = status === "CANCELLED" ? "destructive" : status === "INVITING" ? "accent" : "secondary";
  return (
    <Badge variant={variant}>
      {t(status)}
    </Badge>
  );
}
