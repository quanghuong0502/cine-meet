import { useTranslations } from "next-intl";
import type { SittingHistoryRow } from "@/services/viewing-history.service";

/** "You have sat in this room 3 times: F7, F8, G9" (design 3.2), most-sat seat first. */
export function SittingHistorySummary({ rows }: { rows: SittingHistoryRow[] }) {
  const t = useTranslations("cinemas.room.sittingHistory");
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <p className="rounded-xl border bg-card p-inset-sm type-secondary text-muted-foreground">
      {t("summary", { count: total, seats: rows.map((r) => (r.rating ? `${r.seatCode} ★${r.rating}` : r.seatCode)).join(", ") })}
    </p>
  );
}
