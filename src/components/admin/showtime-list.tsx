"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { RemoveResult } from "@/lib/admin/action-result";
import { formatDayKey, formatTime, vietnamDayKey } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";
import type { ShowtimeRow } from "@/services/showtime.service";

/** Showtimes grouped by day, each with a delete button (confirmed in a dialog). */
export function AdminShowtimeList({ rows, removeAction }: { rows: ShowtimeRow[]; removeAction: (id: string) => Promise<RemoveResult> }) {
  const t = useTranslations("admin.movies.showtimes");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const [pending, setPending] = useState<ShowtimeRow | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const days = new Map<string, ShowtimeRow[]>();
  for (const row of rows) {
    const key = vietnamDayKey(row.startAt);
    days.set(key, [...(days.get(key) ?? []), row]);
  }

  function confirm() {
    const target = pending;
    if (!target) return;
    startDeleting(async () => {
      const result = await removeAction(target.id);
      setPending(null);
      if (result.ok) toast.success(tc("deleted"));
      else toast.error(tc(`errors.${result.error}`));
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {[...days.entries()].map(([day, items]) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{formatDayKey(day, locale)}</h2>
            <ul className="flex flex-col gap-2">
              {items.map((row) => (
                <li key={row.id} className="flex min-w-0 items-center rounded-xl border bg-card pr-2">
                  <div className="flex min-h-row min-w-0 flex-1 flex-col justify-center gap-0.5 py-3 pl-4">
                    <span className="truncate text-base font-semibold">
                      {formatTime(row.startAt, locale)}–{formatTime(row.endAt, locale)} · {row.movie.title}
                    </span>
                    <span className="break-words text-sm text-muted-foreground">
                      {[row.branch.brandName, row.branch.name, row.auditorium.name, row.format.name].filter(Boolean).join(" · ")}
                    </span>
                    <span className="text-sm text-muted-foreground">{row.price === null ? t("noPrice") : formatVnd(row.price, locale)}</span>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setPending(row)} aria-label={`${tc("delete")}: ${row.movie.title} ${formatTime(row.startAt, locale)}`} className="size-target shrink-0 text-muted-foreground">
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(open) => (open ? undefined : setPending(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { movie: pending?.movie.title ?? "", time: pending ? formatTime(pending.startAt, locale) : "" })}</AlertDialogTitle>
            <AlertDialogDescription>{tc("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              {isDeleting ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : null}
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
