"use client";

import { StarIcon } from "@solar-icons/react/bold";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import type { SittingHistoryRow } from "@/services/viewing-history.service";

/** Interactive summary of seats sat in this room: tapping a past seat selects it right on the map. */
export function SittingHistorySummary({
  rows,
  selected,
  onSelect,
}: {
  rows: SittingHistoryRow[];
  selected?: string | null;
  onSelect?: (seatCode: string) => void;
}) {
  const t = useTranslations("cinemas.room.sittingHistory");
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (!onSelect) {
    return (
      <p className="rounded-xl border bg-card p-inset-sm type-secondary text-muted-foreground">
        {t("summary", { count: total, seats: rows.map((r) => (r.rating ? `${r.seatCode} ★${r.rating}` : r.seatCode)).join(", ") })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-stack rounded-xl border bg-card p-inset-sm">
      <p className="type-caption text-muted-foreground">{t("heading", { count: total })}</p>
      <div className="scroll-strip flex gap-stack">
        {rows.map((r) => (
          <Chip key={r.seatCode} selected={selected === r.seatCode} onClick={() => onSelect(r.seatCode)} className="px-inset-sm">
            <span className="tabular-nums">{r.seatCode}</span>
            {r.rating ? (
              <span className="inline-flex items-center gap-hair tabular-nums">
                <StarIcon className="size-icon-xs text-seat-favorite" aria-hidden />
                {r.rating}
              </span>
            ) : null}
            {r.count > 1 ? <span className="type-micro opacity-75 tabular-nums">×{r.count}</span> : null}
          </Chip>
        ))}
      </div>
    </div>
  );
}
