"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState, useTransition } from "react";
import { findShowtimesFromAction } from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { ShowtimePicker, toShowtimeChoice, type ShowtimeChoice } from "@/components/appointment/showtime-picker";
import { DateTimeField } from "@/components/date-time-field";
import { LoadingState } from "@/components/loading-state";
import { vietnamToIso } from "@/lib/appointment/datetime";
import { availableValues, type FacetRecord } from "@/lib/showtime/facets";
import type { FilterKey, FilterValues } from "@/lib/showtime/filters";
import { slotName, slotRange, timeInSlot, type TimeSlot } from "@/lib/showtime/slots";
import type { ShowtimeRow } from "@/services/showtime.service";

/** Filters that make sense for the showtimes of one movie (the genre is the movie's, so it never narrows anything). */
const KEYS: FilterKey[] = ["branch", "format", "slot"];

interface Props {
  movieId: string;
  slots: TimeSlot[];
  /** Showtimes already picked: shown as chosen, and not picked twice. */
  chosenIds: string[];
  onPick: (showtime: ShowtimeChoice) => void;
  /** Said under the finder when the time or the search is wrong (the form owns the error text). */
  onError: (message: string) => void;
}

/**
 * The person types the day and time they want to watch; then the showtimes of that movie on that day, from that time on, are loaded
 * and can be narrowed by cinema, format and part of the day. Picking one hands it to the form. With none to pick, nothing can be added.
 */
export function ShowtimeFinder({ movieId, slots, chosenIds, onPick, onError }: Props) {
  const t = useTranslations("appointments.new");
  const tf = useTranslations("showtimes.filters");
  const locale = useLocale();
  const [searching, startSearch] = useTransition();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [rows, setRows] = useState<ShowtimeRow[] | null>(null);
  const [filters, setFilters] = useState<FilterValues>({});

  // The picker fires `onChange` while it is still being turned. The search waits until the choice is final: the field loses focus (the
  // picker closed) or nothing changes for a moment. Only the newest search may show its result.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  const SETTLE_MS = 600;

  function schedule(nextDate: string, nextTime: string) {
    if (timer.current) clearTimeout(timer.current);
    setRows(null);
    setFilters({});
    latest.current += 1;
    if (nextDate && nextTime) timer.current = setTimeout(() => search(nextDate, nextTime), SETTLE_MS);
  }

  function settle() {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    search(date, time);
  }

  function search(nextDate: string, nextTime: string) {
    timer.current = null;
    setRows(null);
    setFilters({});
    if (!nextDate || !nextTime) return;
    const iso = vietnamToIso(nextDate, nextTime);
    if (!iso) return onError(t("errors.customInvalid"));
    if (new Date(iso).getTime() <= Date.now()) return onError(t("errors.past"));
    onError("");
    const mine = ++latest.current;
    startSearch(async () => {
      const result = await findShowtimesFromAction(movieId, iso).catch(() => null);
      if (mine !== latest.current) return;
      if (!result?.ok) return onError(t("errors.searchFailed"));
      setRows(result.showtimes);
    });
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

  return (
    <div className="flex flex-col gap-item">
      <span className="type-secondary text-muted-foreground">{t("pickTimeLabel")}</span>
      <div className="flex gap-stack">
        <DateTimeField kind="date" label={t("customDate")} value={date} onChange={(v) => { setDate(v); schedule(v, time); }} onBlur={settle} className="min-w-0 flex-1" />
        <DateTimeField kind="time" label={t("customTime")} value={time} onChange={(v) => { setTime(v); schedule(date, v); }} onBlur={settle} className="w-time-field" />
      </div>

      {searching ? <LoadingState compact /> : null}

      {!searching && rows !== null && rows.length === 0 ? <p role="status" className="type-secondary text-muted-foreground">{t("noneFromThen")}</p> : null}

      {!searching && rows !== null && rows.length > 0 ? (
        <div className="flex flex-col gap-item">
          {groups.map((key) => (
            <div key={key} role="group" aria-label={tf(`labels.${key}`)} className="flex flex-col gap-stack">
              <span className="type-secondary text-muted-foreground">{tf(`labels.${key}`)}</span>
              <div className="scroll-strip flex gap-stack pb-tight">
                <Chip selected={!filters[key]} onClick={() => setFilters({ ...filters, [key]: undefined })}>
                  {tf("all")}
                </Chip>
                {offered(key).map((value) => (
                  <Chip key={value} selected={filters[key] === value} onClick={() => setFilters({ ...filters, [key]: value })}>
                    {labelOf(key, value)}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          <ShowtimePicker
            showtimes={shown}
            selectedIds={chosenIds}
            hideDays
            hideBranchFilter
            onToggle={(id) => {
              const choice = shown.find((s) => s.id === id);
              if (!choice || chosenIds.includes(id)) return;
              onPick(choice);
              setRows(null);
              setDate("");
              setTime("");
              setFilters({});
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
