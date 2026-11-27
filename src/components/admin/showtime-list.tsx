"use client";

import { CheckSquareIcon, CloseIcon, RoundedMagnifierIcon, TrashBinMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { LazyConfirmDialog } from "@/components/lazy-dialogs";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RemoveResult } from "@/lib/admin/action-result";
import { formatDayKey, formatTime, vietnamDayKey } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ShowtimeRow } from "@/services/showtime.service";

interface Option {
  value: string;
  label: string;
}

interface Props {
  rows: ShowtimeRow[];
  filters: { date: string; branch: string; movie: string };
  branchOptions: Option[];
  movieOptions: Option[];
  limit: number;
  removeAction: (id: string) => Promise<RemoveResult>;
  removeBulkAction: (ids: string[]) => Promise<{ ok: true; deleted: number; skipped: number } | { ok: false; error: "unknown" }>;
}

const FILTER_CONTROL = "h-control w-full rounded-xl bg-card px-inset type-body";

/** Showtimes grouped by day with URL date/branch/movie filters, instant client search, and single or batch delete. */
export function AdminShowtimeList({ rows, filters, branchOptions, movieOptions, limit, removeAction, removeBulkAction }: Props) {
  const t = useTranslations("admin.movies.showtimes");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [pending, setPending] = useState<ShowtimeRow | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<string>>(() => new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [isDeleting, startDeleting] = useTransition();

  const hasUrlFilters = Boolean(filters.date || filters.branch || filters.movie);

  function setUrlFilter(patch: Partial<{ date: string; branch: string; movie: string }>) {
    const next = { ...filters, ...patch };
    const params = new URLSearchParams();
    if (next.date) params.set("date", next.date);
    if (next.branch) params.set("branch", next.branch);
    if (next.movie) params.set("movie", next.movie);
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.movie.title, row.branch.brandName, row.branch.name, row.auditorium.name, row.format.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, deferredQuery]);

  const days = useMemo(() => {
    const map = new Map<string, ShowtimeRow[]>();
    for (const row of filtered) {
      const key = vietnamDayKey(row.startAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    return [...map.entries()];
  }, [filtered]);

  function togglePick(id: string) {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    const target = pending;
    if (!target) return;
    startDeleting(async () => {
      const result = await removeAction(target.id).catch(() => null);
      setPending(null);
      if (!result) toast.error(tc("errors.network"));
      else if (result.ok) toast.success(tc("deleted"));
      else toast.error(tc(`errors.${result.error}`));
    });
  }

  function confirmBulkDelete() {
    const ids = [...pickedIds];
    if (ids.length === 0) return;
    startDeleting(async () => {
      const result = await removeBulkAction(ids).catch(() => null);
      setConfirmBulk(false);
      if (!result) {
        toast.error(tc("errors.network"));
        return;
      }
      if (!result.ok) {
        toast.error(tc("errors.unknown"));
        return;
      }
      setPickedIds(new Set());
      setSelecting(false);
      toast.success(
        result.skipped > 0
          ? t("bulkDeletedSkipped", { deleted: result.deleted, skipped: result.skipped })
          : t("bulkDeleted", { deleted: result.deleted }),
      );
    });
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-group">
        <div className="grid grid-cols-1 gap-stack sm:grid-cols-3">
          <Input
            type="date"
            value={filters.date}
            aria-label={t("filterDate")}
            onChange={(e) => setUrlFilter({ date: e.target.value })}
            className={`${FILTER_CONTROL} text-left [&::-webkit-date-and-time-value]:text-left`}
          />
          <Select value={filters.branch || "all"} onValueChange={(v) => setUrlFilter({ branch: v === "all" ? "" : v })}>
            <SelectTrigger aria-label={t("filterBranch")} className={FILTER_CONTROL}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allBranches")}</SelectItem>
              {branchOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.movie || "all"} onValueChange={(v) => setUrlFilter({ movie: v === "all" ? "" : v })}>
            <SelectTrigger aria-label={t("filterMovie")} className={FILTER_CONTROL}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allMovies")}</SelectItem>
              {movieOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-stack">
          <div className="relative min-w-0 flex-1">
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
          {filtered.length > 0 ? (
            <Button
              type="button"
              variant={selecting ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setSelecting((v) => !v);
                setPickedIds(new Set());
              }}
              className="h-control shrink-0 rounded-xl px-inset-sm"
            >
              <CheckSquareIcon aria-hidden />
              {selecting ? tc("cancel") : t("selectMany")}
            </Button>
          ) : null}
        </div>

        {selecting ? (
          <div className="flex flex-wrap items-center justify-between gap-stack rounded-xl border bg-card p-inset-sm">
            <span className="type-secondary tabular-nums">{t("selectedCount", { count: pickedIds.size })}</span>
            <div className="flex items-center gap-stack">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPickedIds((prev) =>
                    prev.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)),
                  )
                }
              >
                {pickedIds.size === filtered.length ? t("deselectAll") : t("selectAll")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pickedIds.size === 0 || isDeleting}
                onClick={() => setConfirmBulk(true)}
              >
                <TrashBinMinimalisticIcon aria-hidden />
                {tc("delete")}
              </Button>
            </div>
          </div>
        ) : null}

        {rows.length >= limit ? (
          <p role="status" className="rounded-xl border border-warning/40 bg-warning/10 p-inset-sm type-caption text-warning">
            {t("limitNotice", { limit })}
          </p>
        ) : null}

        {days.length === 0 ? (
          <EmptyState
            mascot="bubu-sleepy"
            title={hasUrlFilters || query ? tc("noResultsTitle") : t("emptyTitle")}
            description={hasUrlFilters || query ? tc("noResultsDescription") : t("emptyDescription")}
            action={
              hasUrlFilters || query ? (
                <Button
                  type="button"
                  variant="outline"
                  size="pill"
                  onClick={() => {
                    setQuery("");
                    if (hasUrlFilters) setUrlFilter({ date: "", branch: "", movie: "" });
                  }}
                >
                  {tc("clearSearch")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="type-secondary text-muted-foreground tabular-nums">{tc("itemCount", { count: filtered.length })}</p>
            {days.map(([day, items]) => (
              <section key={day} className="flex flex-col gap-stack">
                <h2 className="type-heading">{formatDayKey(day, locale)}</h2>
                <ul className="flex flex-col gap-stack">
                  {items.map((row) => {
                    const checked = pickedIds.has(row.id);
                    return (
                      <li
                        key={row.id}
                        className={cn(
                          "list-card-cv flex min-w-0 items-center gap-stack rounded-xl border bg-card pr-inset-xs",
                          selecting && checked && "border-primary bg-accent/25",
                        )}
                      >
                        {selecting ? (
                          <button
                            type="button"
                            onClick={() => togglePick(row.id)}
                            aria-pressed={checked}
                            className="flex min-h-row min-w-0 flex-1 items-center gap-item py-inset-sm pl-inset text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "flex size-icon shrink-0 items-center justify-center rounded-md border",
                                checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                              )}
                            >
                              {checked ? "✓" : null}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col justify-center gap-tight">
                              <span className="truncate type-item-title tabular-nums">
                                {formatTime(row.startAt, locale)}–{formatTime(row.endAt, locale)} · {row.movie.title}
                              </span>
                              <span className="break-words type-secondary text-muted-foreground">
                                {[row.branch.brandName, row.branch.name, row.auditorium.name, row.format.name].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </button>
                        ) : (
                          <>
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
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>

      {pending !== null ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setPending(null))}
          title={t("deleteTitle", { movie: pending.movie.title, time: formatTime(pending.startAt, locale) })}
          description={tc("deleteDescription")}
          tone="destructive"
          icon={<TrashBinMinimalisticIcon aria-hidden />}
          confirmLabel={tc("delete")}
          pending={isDeleting}
          onConfirm={confirm}
        />
      ) : null}

      {confirmBulk ? (
        <LazyConfirmDialog
          open
          onOpenChange={setConfirmBulk}
          title={t("bulkDeleteTitle", { count: pickedIds.size })}
          description={tc("deleteDescription")}
          tone="destructive"
          icon={<TrashBinMinimalisticIcon aria-hidden />}
          confirmLabel={tc("delete")}
          pending={isDeleting}
          onConfirm={confirmBulkDelete}
        />
      ) : null}
    </>
  );
}
