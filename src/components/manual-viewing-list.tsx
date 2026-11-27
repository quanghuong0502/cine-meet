"use client";

import { CalendarMarkIcon, TrashBinMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeManualViewingAction } from "@/actions/expenses";
import { LazyConfirmDialog } from "@/components/lazy-dialogs";
import { Button } from "@/components/ui/button";
import { formatDayLong } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";
import type { ManualViewingRow } from "@/services/expense.service";

interface Props {
  initialRows: ManualViewingRow[];
}

/** Compact list of recently logged manual viewings so users can review notes and remove mistakes. */
export function ManualViewingList({ initialRows }: Props) {
  const t = useTranslations("dashboard.logViewing");
  const locale = useLocale();
  const [rows, setRows] = useState(initialRows);
  const [target, setTarget] = useState<ManualViewingRow | null>(null);
  const [pending, start] = useTransition();

  if (rows.length === 0) return null;

  function confirmRemove() {
    if (!target) return;
    const removing = target;
    start(async () => {
      const result = await removeManualViewingAction(removing.id).catch(() => null);
      setTarget(null);
      if (!result?.ok) {
        toast.error(t("removeFailed"));
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== removing.id));
      toast.success(t("removed"));
    });
  }

  return (
    <section aria-labelledby="recent-manual-viewings" className="flex flex-col gap-item border-t pt-section">
      <div className="flex items-center gap-stack">
        <CalendarMarkIcon className="size-icon text-muted-foreground" aria-hidden />
        <h2 id="recent-manual-viewings" className="type-heading">
          {t("recentTitle")}
        </h2>
      </div>
      <ul className="flex flex-col gap-stack">
        {rows.map((row) => {
          const dayLabel = formatDayLong(`${row.date}T12:00:00+07:00`, locale);
          const title = row.movieTitle ?? row.roomLabel ?? dayLabel;
          const meta = [row.movieTitle ? row.roomLabel : undefined, row.movieTitle || row.roomLabel ? dayLabel : undefined]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={row.id} className="flex min-w-0 items-start gap-stack rounded-xl border bg-card p-inset-sm">
              <div className="flex min-w-0 flex-1 flex-col gap-tight">
                <div className="flex items-baseline justify-between gap-stack">
                  <span className="truncate type-item-title">{title}</span>
                  {row.total > 0 ? (
                    <span className="shrink-0 type-label text-primary-text tabular-nums">{formatVnd(row.total, locale)}</span>
                  ) : null}
                </div>
                {meta ? <span className="break-words type-secondary text-muted-foreground">{meta}</span> : null}
                {row.note ? <p className="break-words type-caption text-muted-foreground">{row.note}</p> : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => setTarget(row)}
                aria-label={t("removeAria", { title })}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <TrashBinMinimalisticIcon aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>

      {target ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (!open ? setTarget(null) : undefined)}
          title={t("removeTitle")}
          description={t("removeDescription")}
          tone="destructive"
          icon={<TrashBinMinimalisticIcon aria-hidden />}
          confirmLabel={t("removeConfirm")}
          pending={pending}
          onConfirm={confirmRemove}
        />
      ) : null}
    </section>
  );
}
