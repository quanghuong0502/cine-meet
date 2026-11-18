"use client";

import { LoaderCircle, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VALIDATION_CODES, type ValidationCode } from "@/lib/admin/action-result";
import { datesBetween } from "@/lib/showtime/time";
import type { BulkState } from "@/app/admin/movies/actions";

interface Option {
  value: string;
  label: string;
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

const CONTROL_CLASS = "h-control rounded-xl bg-card px-4 type-body";
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
  const total = days.length * times.length * chosenRooms.length;

  function addTime() {
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(draft)) return;
    const value = draft.padStart(5, "0");
    setTimes((current) => (current.includes(value) ? current : [...current, value].sort()));
    setDraft("");
  }

  const error = (name: string) =>
    errors[name] ? (
      <p role="alert" className="-mt-1 type-secondary text-destructive">
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
      <div className="flex flex-col gap-3">
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

      <div className="flex flex-col gap-3">
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

      <div className="flex flex-col gap-3">
        {label("rooms", t("rooms"), true)}
        <div role="group" aria-label={t("rooms")} className="flex flex-wrap gap-2">
          <input type="hidden" name="auditoriumIds" value={chosenRooms.join(",")} />
          {rooms.map((room) => (
            <Chip
              key={room.value}
              selected={chosenRooms.includes(room.value)}
              onClick={() => setChosenRooms((c) => (c.includes(room.value) ? c.filter((v) => v !== room.value) : [...c, room.value]))}
            >
              {room.label}
            </Chip>
          ))}
        </div>
        {error("auditoriumIds")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-3">
          {label("from", t("from"), true)}
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${CONTROL_CLASS} text-left [&::-webkit-date-and-time-value]:text-left`} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          {label("to", t("to"), true)}
          <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${CONTROL_CLASS} text-left [&::-webkit-date-and-time-value]:text-left`} />
        </div>
        <input type="hidden" name="dates" value={days.join(",")} />
        {error("dates")}
      </div>

      <div className="flex flex-col gap-3">
        {label("time", t("times"), true)}
        <div className="flex gap-2">
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
            <Plus aria-hidden />
            {t("addTime")}
          </Button>
        </div>
        <input type="hidden" name="times" value={times.join(",")} />
        {times.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {times.map((time) => (
              <li key={time}>
                <Chip selected onClick={() => setTimes((c) => c.filter((v) => v !== time))} aria-label={t("removeTime", { time })}>
                  {time}
                  <X className="size-4" aria-hidden />
                </Chip>
              </li>
            ))}
          </ul>
        ) : null}
        {error("times")}
      </div>

      <div className="flex flex-col gap-3">
        {label("priceOverride", t("price"))}
        <Input id="priceOverride" name="priceOverride" type="number" inputMode="numeric" step="1" min={0} placeholder="90000" autoComplete="off" defaultValue={typed?.priceOverride} className={CONTROL_CLASS} />
        {error("priceOverride")}
      </div>

      <p className="type-secondary text-muted-foreground" aria-live="polite">
        {t("summary", { count: total })}
      </p>

      {state.status === "error" && state.error !== "validation" ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 type-secondary text-destructive">
          {t(`errors.${state.error}`, { max: maxShowtimes })}
        </p>
      ) : null}

      <div aria-hidden className="h-[calc(var(--spacing-control)+2.5rem)] shrink-0" />
      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-64">
        <div className="mx-auto flex max-w-sm">
          <Button type="submit" size="cta" disabled={isPending || total > maxShowtimes} className="pointer-events-auto min-w-0 flex-1">
            {isPending ? (
              <>
                <LoaderCircle className="motion-safe:animate-spin" aria-hidden />
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
