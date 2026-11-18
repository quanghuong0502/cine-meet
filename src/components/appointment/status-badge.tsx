import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/lib/appointment/state";

/** Status as words (colour is never the only sign): cancelled is red-tinted, the rest are neutral or branded. */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const t = useTranslations("appointments.status");
  const variant = status === "CANCELLED" ? "destructive" : status === "INVITING" ? "default" : "secondary";
  return (
    <Badge variant={variant} className="h-auto py-hair type-tag">
      {t(status)}
    </Badge>
  );
}
