"use client";

import { CloseIcon, RoundedMagnifierIcon, TrashBinMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RemoveResult } from "@/lib/admin/action-result";
import { formatDayKey, formatTime, vietnamDayKey } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ShowtimeRow } from "@/services/showtime.service";

/** Showtimes grouped by day with instant client-side filtering and confirmed delete. */
export function AdminShowtimeList({ rows, removeAction }: { rows: ShowtimeRow[]; removeAction: (id: string) => Promise<RemoveResult> }) {
  const t = useTranslations("admin.movies.showtimes");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<ShowtimeRow | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.movie.title, row.branch.brandName, row.branch.name, row.auditorium.name, row.format.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const days = useMemo(() => {
    const map = new Map<string, ShowtimeRow[]>();
    for (const row of filtered) {
      const key = vietnamDayKey(row.startAt);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()];
  }, [filtered]);

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
      <div className="flex flex-col gap-group">
        <div className="relative">
          <RoundedMagnifierIcon className="pointer-events-none absolute top-1/2 left-inset size-icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className={cn("h-control rounded-xl bg-card px-inset pl-target type-body", query && "pr-target")}
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setQuery("")}
              aria-label={tc("clearSearch")}
              className="absolute top-1/2 right-hair size-target -translate-y-1/2 text-muted-foreground"
            >
              <CloseIcon aria-hidden />
            </Button>
          ) : null}
        </div>

        {days.length === 0 ? (
          <EmptyState
            mascot="bubu-sleepy"
            title={tc("noResultsTitle")}
            description={tc("noResultsDescription")}
            action={
              <Button type="button" variant="outline" size="pill" onClick={() => setQuery("")}>
                {tc("clearSearch")}
              </Button>
            }
          />
        ) : (
          <>
            <p className="type-secondary text-muted-foreground tabular-nums">{tc("itemCount", { count: filtered.length })}</p>
            {days.map(([day, items]) => (
              <section key={day} className="flex flex-col gap-stack">
                <h2 className="type-heading">{formatDayKey(day, locale)}</h2>
                <ul className="flex flex-col gap-stack">
                  {items.map((row) => (
                    <li key={row.id} className="flex min-w-0 items-center gap-stack rounded-xl border bg-card pr-inset-xs">
                      <div className="flex min-h-row min-w-0 flex-1 flex-col justify-center gap-tight py-inset-sm pl-inset">
                        <span className="truncate type-item-title tabular-nums">
                          {formatTime(row.startAt, locale)}–{formatTime(row.endAt, locale)} · {row.movie.title}
                        </span>
                        <span className="break-words type-secondary text-muted-foreground">
                          {[row.branch.brandName, row.branch.name, row.auditorium.name, row.format.name].filter(Boolean).join(" · ")}
                        </span>
                        <span className="type-secondary text-muted-foreground tabular-nums">
                          {row.price === null ? t("noPrice") : formatVnd(row.price, locale)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setPending(row)}
                        aria-label={`${tc("delete")}: ${row.movie.title} ${formatTime(row.startAt, locale)}`}
                        className="size-target shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <TrashBinMinimalisticIcon aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => (open ? undefined : setPending(null))}
        title={t("deleteTitle", { movie: pending?.movie.title ?? "", time: pending ? formatTime(pending.startAt, locale) : "" })}
        description={tc("deleteDescription")}
        tone="destructive"
        icon={<TrashBinMinimalisticIcon aria-hidden />}
        confirmLabel={tc("delete")}
        pending={isDeleting}
        onConfirm={confirm}
      />
    </>
  );
}
