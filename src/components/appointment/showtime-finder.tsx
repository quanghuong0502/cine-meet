"use client";

import { CloseIcon, RefreshIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { findShowtimesFromAction } from "@/actions/appointments";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { ShowtimePicker, toShowtimeChoice, type ShowtimeChoice } from "@/components/appointment/showtime-picker";
import { DateTimeField } from "@/components/date-time-field";
import { LoadingState } from "@/components/loading-state";
import { vietnamToIso } from "@/lib/appointment/datetime";
import { MAX_TIME_OPTIONS } from "@/lib/appointment/limits";
import { formatDayLong, formatTime } from "@/lib/datetime";
import { vietnamToday } from "@/lib/movie/status";
import { availableValues, type FacetRecord } from "@/lib/showtime/facets";
import type { FilterKey, FilterValues } from "@/lib/showtime/filters";
import { slotName, slotRange, timeInSlot, type TimeSlot } from "@/lib/showtime/slots.helpers";
import type { ShowtimeRow } from "@/services/showtime.service";

/** Filters that make sense for the showtimes of one movie (the genre is the movie's, so it never narrows anything). */
const KEYS: FilterKey[] = ["branch", "format", "slot"];

interface Props {
  movieId: string;
  slots: TimeSlot[];
  /** Showtimes already picked. Those on the list being shown are ticked there; the others are listed above (so none is out of sight). */
  chosen: ShowtimeChoice[];
  onPick: (showtime: ShowtimeChoice) => void;
  /** Tapping a showtime that is already picked takes it off again. */
  onUnpick: (showtimeId: string) => void;
  /** Said under the finder when the time or the search is wrong (the form owns the error text). */
  onError: (message: string) => void;
}

/**
 * The person types the day and time they want to watch; then the showtimes of that movie on that day, from that time on, are loaded
 * and can be narrowed by cinema, format and part of the day. Picking one hands it to the form. With none to pick, nothing can be added.
 */
export function ShowtimeFinder({ movieId, slots, chosen, onPick, onUnpick, onError }: Props) {
  const t = useTranslations("appointments.new");
  const tf = useTranslations("showtimes.filters");
  const te = useTranslations("states.error");
  const locale = useLocale();
  const [searching, startSearch] = useTransition();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [rows, setRows] = useState<ShowtimeRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});

  // The picker fires `onChange` while it is still being turned. The search waits until the choice is final: the field loses focus (the
  // picker closed) or nothing changes for a moment. Only the newest search may show its result.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });
  const SETTLE_MS = 600;

  const runFetch = useCallback(
    (iso: string) => {
      setFailed(false);
      setFilters({});
      onErrorRef.current("");
      const mine = ++latest.current;
      startSearch(async () => {
        const result = await findShowtimesFromAction(movieId, iso).catch(() => null);
        if (mine !== latest.current) return;
        if (!result?.ok) {
          setFailed(true);
          onErrorRef.current(t("errors.searchFailed"));
          return;
        }
        setRows(result.showtimes);
      });
    },
    [movieId, t],
  );

  // Load upcoming showtimes straight away when a movie is picked so users don't have to guess a date + exact time first.
  useEffect(() => {
    let cancelled = false;
    const mine = ++latest.current;
    async function loadInitial() {
      const result = await findShowtimesFromAction(movieId, new Date().toISOString()).catch(() => null);
      if (cancelled || mine !== latest.current) return;
      if (!result?.ok) {
        setFailed(true);
        onErrorRef.current(t("errors.searchFailed"));
        return;
      }
      setFailed(false);
      setFilters({});
      setRows(result.showtimes);
    }
    void loadInitial();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [movieId, t]);

  const busy = searching || (rows === null && !failed);

  function search(nextDate: string, nextTime: string) {
    timer.current = null;
    if (!nextDate && !nextTime) {
      runFetch(new Date().toISOString());
      return;
    }
    if (!nextDate) return;
    const effectiveTime = nextTime || "00:00";
    const iso = vietnamToIso(nextDate, effectiveTime);
    if (!iso) return onError(t("errors.customInvalid"));
    const now = Date.now();
    const targetIso = !nextTime && new Date(iso).getTime() <= now ? new Date(now).toISOString() : iso;
    if (nextTime && new Date(iso).getTime() <= now) return onError(t("errors.past"));
    setRows(null);
    runFetch(targetIso);
  }

  function schedule(nextDate: string, nextTime: string) {
    if (timer.current) clearTimeout(timer.current);
    latest.current += 1;
    if (!nextDate && !nextTime) {
      runFetch(new Date().toISOString());
      return;
    }
    if (nextDate) timer.current = setTimeout(() => search(nextDate, nextTime), SETTLE_MS);
  }

  function settle() {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    search(date, time);
  }

  const records = useMemo<(FacetRecord & { id: string })[]>(
    () =>
      (rows ?? []).map((row) => {
        const clock = new Date(new Date(row.startAt).getTime() + 7 * 3600_000).toISOString().slice(11, 16);
        return { id: row.id, branch: row.branch.id, format: row.format.id, genre: [], slot: slots.filter((slot) => timeInSlot(slot, clock)).map((slot) => slot.id) };
      }),
    [rows, slots],
  );
  const available = availableValues(records, filters);
  const labelOf = (key: FilterKey, value: string): string => {
    if (key === "slot") {
      const slot = slots.find((s) => s.id === value);
      return slot ? `${slotName(slot, locale)} (${slotRange(slot)})` : value;
    }
    const row = rows?.find((r) => (key === "branch" ? r.branch.id : r.format.id) === value);
    return key === "branch" ? [row?.branch.brandName, row?.branch.name].filter(Boolean).join(" · ") : (row?.format.name ?? value);
  };
  const optionsOf = (key: FilterKey) => [...new Set(records.flatMap((r) => (Array.isArray(r[key]) ? (r[key] as string[]) : [r[key] as string])))];
  const offered = (key: FilterKey) => optionsOf(key).filter((value) => available[key].has(value) || filters[key] === value);
  const groups = KEYS.filter((key) => offered(key).length >= 2 || filters[key]);

  const shownIds = new Set(
    records.filter((r) => KEYS.every((key) => !filters[key] || (Array.isArray(r[key]) ? (r[key] as string[]).includes(filters[key]!) : r[key] === filters[key]))).map((r) => r.id),
  );
  const shown = (rows ?? []).filter((row) => shownIds.has(row.id)).map(toShowtimeChoice);
  const chosenIds = chosen.map((c) => c.id);
  const browsingAllDays = !date;

  return (
    <div className="flex flex-col gap-item">
      {chosen.length > 0 ? (
        <div className="flex flex-col gap-stack">
          <span className="type-caption text-muted-foreground tabular-nums">
            {t("pickedSummary", { count: chosen.length, max: MAX_TIME_OPTIONS })}
          </span>
          <ul className="flex flex-col gap-stack">
            {chosen.map((c) => (
              <li key={c.id} className="flex items-center gap-item rounded-xl border border-primary bg-accent p-inset-sm">
                <span className="flex min-w-0 flex-1 flex-col gap-tight">
                  <span className="break-words type-item-title tabular-nums">
                    {formatDayLong(c.startAt, locale)} · {formatTime(c.startAt, locale)}
                  </span>
                  <span className="break-words type-secondary text-muted-foreground">
                    {c.branchName} · {c.roomName} · {c.formatName}
                  </span>
                </span>
                <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={t("removeTime")} onClick={() => onUnpick(c.id)}>
                  <CloseIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-stack">
        <span className="type-secondary text-muted-foreground">{t("pickTimeLabel")}</span>
        {date || time ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDate("");
              setTime("");
              schedule("", "");
            }}
            className="-mr-inset-sm text-primary-text"
          >
            {tf("clear")}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-stack">
        <DateTimeField kind="date" label={t("customDate")} value={date} min={vietnamToday()} onChange={(v) => { setDate(v); schedule(v, time); }} onBlur={settle} className="min-w-menu-min flex-1" />
        <DateTimeField kind="time" label={t("customTime")} value={time} onChange={(v) => { setTime(v); schedule(date, v); }} onBlur={settle} className="min-w-time-field flex-1" />
      </div>

      {busy ? <LoadingState compact /> : null}

      {!busy && failed ? (
        <Button type="button" variant="outline" size="pill" onClick={() => search(date, time)} className="self-start">
          <RefreshIcon aria-hidden />
          {te("retry")}
        </Button>
      ) : null}

      {!busy && !failed && rows !== null && rows.length === 0 ? <p role="status" className="type-secondary text-muted-foreground">{t("noneFromThen")}</p> : null}

      {!busy && !failed && rows !== null && rows.length > 0 ? (
        <div className="flex flex-col gap-item">
          {groups.map((key) => (
            <div key={key} role="group" aria-label={tf(`labels.${key}`)} className="flex flex-col gap-stack">
              <span className="type-secondary text-muted-foreground">{tf(`labels.${key}`)}</span>
              <div className="scroll-strip flex gap-stack pb-tight">
                <Chip selected={!filters[key]} onClick={() => setFilters({ ...filters, [key]: undefined })}>
                  <span className="truncate">{tf("all")}</span>
                </Chip>
                {offered(key).map((value) => (
                  <Chip key={value} selected={filters[key] === value} onClick={() => setFilters({ ...filters, [key]: value })}>
                    <span className="min-w-0 truncate">{labelOf(key, value)}</span>
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          <ShowtimePicker
            showtimes={shown}
            selectedIds={chosenIds}
            hideDays={!browsingAllDays}
            hideBranchFilter
            onToggle={(id) => {
              // The day, time and list stay, so several showtimes can be picked without typing the time again.
              if (chosenIds.includes(id)) return onUnpick(id);
              const choice = shown.find((s) => s.id === id);
              if (choice) onPick(choice);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
