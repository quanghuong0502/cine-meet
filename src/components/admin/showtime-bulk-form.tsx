"use client";

import { AddIcon, CloseIcon, DangerCircleIcon, LoaderIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VALIDATION_CODES, type ValidationCode } from "@/lib/admin/action-result";
import { datesBetween } from "@/lib/showtime/time";
import type { BulkState } from "@/app/admin/movies/actions";

interface Option {
  value: string;
  label: string;
  group?: string;
}

interface Props {
  movies: Option[];
  formats: Option[];
  rooms: Option[];
  backHref: string;
  action: (previous: BulkState, formData: FormData) => Promise<BulkState>;
  /** Vietnam's today, the default for both dates. */
  today: string;
  maxShowtimes: number;
}

const CONTROL_CLASS = "h-control rounded-xl bg-card px-inset type-body";
const isCode = (code: string): code is ValidationCode => VALIDATION_CODES.some((known) => known === code);

/** One movie x rooms x a range of days x start times. The lists travel as comma-separated hidden fields. */
export function ShowtimeBulkForm({ movies, formats, rooms, backHref, action, today, maxShowtimes }: Props) {
  const t = useTranslations("admin.movies.bulk");
  const tv = useTranslations("admin.validation");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as BulkState);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [times, setTimes] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [chosenRooms, setChosenRooms] = useState<string[]>([]);

  useEffect(() => {
    if (state.status !== "success") return;
    toast.success(t("created", { created: state.created, skipped: state.skipped }));
    router.replace(backHref);
  }, [state, t, router, backHref]);

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const typed = state.status === "error" ? state.values : undefined;
  const days = datesBetween(from, to);
  // Auto-include a valid time still sitting in the `#time` input so forgetting to click "+ Add" never fails validation.
  const validDraftTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(draft) ? draft.padStart(5, "0") : null;
  const effectiveTimes = validDraftTime && !times.includes(validDraftTime) ? [...times, validDraftTime].sort() : times;
  const total = days.length * effectiveTimes.length * chosenRooms.length;
  const tooMany = total > maxShowtimes;
  const roomGroups = useMemo(() => {
    const map = new Map<string, Option[]>();
    for (const room of rooms) {
      const key = room.group ?? "";
      map.set(key, [...(map.get(key) ?? []), room]);
    }
    return [...map.entries()];
  }, [rooms]);

  function addTime() {
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(draft)) return;
    const value = draft.padStart(5, "0");
    setTimes((current) => (current.includes(value) ? current : [...current, value].sort()));
    setDraft("");
  }

  const error = (name: string) =>
    errors[name] ? (
      <p role="alert" className="-mt-tight type-secondary text-destructive">
        {tv(isCode(errors[name]) ? errors[name] : "invalid")}
      </p>
    ) : null;

  const label = (name: string, text: string, required = false) => (
    <Label htmlFor={name} className="text-muted-foreground">
      <span>
        {text}
        {required ? <RequiredMark /> : null}
      </span>
    </Label>
  );

  return (
    <form action={formAction} noValidate className="flex flex-1 flex-col gap-field">
      <div className="flex flex-col gap-item">
        {label("movieId", t("movie"), true)}
        <Select name="movieId" defaultValue={typed?.movieId || undefined}>
          <SelectTrigger id="movieId" aria-invalid={Boolean(errors.movieId) || undefined} className={`${CONTROL_CLASS} w-full`}>
            <SelectValue placeholder={t("moviePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {movies.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error("movieId")}
      </div>

      <div className="flex flex-col gap-item">
        {label("formatId", t("format"), true)}
        <Select name="formatId" defaultValue={typed?.formatId || undefined}>
          <SelectTrigger id="formatId" aria-invalid={Boolean(errors.formatId) || undefined} className={`${CONTROL_CLASS} w-full`}>
            <SelectValue placeholder={t("formatPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {formats.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error("formatId")}
      </div>

      <div className="flex flex-col gap-item">
        <span className="type-label text-muted-foreground">
          {t("rooms")}
          <RequiredMark />
        </span>
        <div role="group" aria-label={t("rooms")} className="flex flex-col gap-item">
          <input type="hidden" name="auditoriumIds" value={chosenRooms.join(",")} />
          {roomGroups.map(([group, groupRooms]) => (
            <div key={group} className="flex flex-col gap-stack rounded-xl border bg-card/40 p-inset-sm">
              {group ? <span className="type-secondary font-medium text-muted-foreground">{group}</span> : null}
              <div className="flex flex-wrap gap-stack">
                {groupRooms.map((room) => (
                  <Chip
                    key={room.value}
                    selected={chosenRooms.includes(room.value)}
                    onClick={() => setChosenRooms((c) => (c.includes(room.value) ? c.filter((v) => v !== room.value) : [...c, room.value]))}
                  >
                    {room.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error("auditoriumIds")}
      </div>

      <div className="grid grid-cols-2 gap-item">
        <div className="flex min-w-0 flex-col gap-item">
          {label("from", t("from"), true)}
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => {
              const next = e.target.value;
              setFrom(next);
              if (next && to && next > to) setTo(next);
            }}
            className={`${CONTROL_CLASS} text-left [&::-webkit-date-and-time-value]:text-left`}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-item">
          {label("to", t("to"), true)}
          <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${CONTROL_CLASS} text-left [&::-webkit-date-and-time-value]:text-left`} />
        </div>
        <input type="hidden" name="dates" value={days.join(",")} />
        {error("dates")}
      </div>

      <div className="flex flex-col gap-item">
        {label("time", t("times"), true)}
        <div className="flex gap-stack">
          <Input
            id="time"
            type="time"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTime();
              }
            }}
            className={`${CONTROL_CLASS} min-w-0 flex-1 text-left [&::-webkit-date-and-time-value]:text-left`}
          />
          <Button type="button" variant="secondary" size="cta" onClick={addTime} className="w-auto shrink-0">
            <AddIcon aria-hidden />
            {t("addTime")}
          </Button>
        </div>
        <input type="hidden" name="times" value={effectiveTimes.join(",")} />
        {times.length > 0 ? (
          <ul className="flex flex-wrap gap-stack">
            {times.map((time) => (
              <li key={time}>
                <Chip selected onClick={() => setTimes((c) => c.filter((v) => v !== time))} aria-label={t("removeTime", { time })}>
                  {time}
                  <CloseIcon className="size-icon-sm" aria-hidden />
                </Chip>
              </li>
            ))}
          </ul>
        ) : null}
        {error("times")}
      </div>

      <div className="flex flex-col gap-item">
        {label("priceOverride", t("price"))}
        <MoneyInput id="priceOverride" name="priceOverride" placeholder="90.000" defaultValue={typed?.priceOverride} className={CONTROL_CLASS} />
        {error("priceOverride")}
      </div>

      <p className="type-secondary text-muted-foreground tabular-nums" aria-live="polite">
        {t("summary", { count: total })}
      </p>

      {tooMany ? (
        <p role="alert" className="flex items-start gap-stack rounded-xl border border-destructive/30 bg-destructive/10 px-inset py-inset-sm type-secondary text-destructive">
          <DangerCircleIcon className="mt-hair size-icon-sm shrink-0" aria-hidden />
          {t("errors.too_many", { max: maxShowtimes })}
        </p>
      ) : null}

      {state.status === "error" && state.error !== "validation" ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-inset py-inset-sm type-secondary text-destructive">
          {t(`errors.${state.error}`, { max: maxShowtimes })}
        </p>
      ) : null}

      <div aria-hidden className="h-save-clear shrink-0" />
      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-inset pt-group pb-(--inset-bottom) md:left-sidebar">
        <div className="mx-auto flex max-w-form">
          <Button type="submit" size="cta" disabled={isPending || tooMany} className="pointer-events-auto min-w-0 flex-1">
            {isPending ? (
              <>
                <LoaderIcon className="motion-safe:animate-spin" aria-hidden />
                {t("creating")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
