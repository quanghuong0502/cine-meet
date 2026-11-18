"use client";

import { LoaderCircle, Plus, Send, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createAppointmentAction } from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { DateTimeField } from "@/components/date-time-field";
import { LoadingState } from "@/components/loading-state";
import { ShowtimePicker, type ShowtimeChoice } from "@/components/appointment/showtime-picker";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { vietnamToIso } from "@/lib/appointment/datetime";
import { MAX_TIME_OPTIONS } from "@/lib/appointment/limits";
import { formatDayLong, formatTime, vietnamDayKey } from "@/lib/datetime";

interface Props {
  movies: { id: string; title: string }[];
  movieId?: string;
  showtimes: ShowtimeChoice[];
  initialShowtimeId?: string;
  friends: { id: string; name: string }[];
  groups: { id: string; name: string; memberIds: string[] }[];
}

const CONTROL = "h-control rounded-xl bg-card px-inset type-body";

/**
 * Creating an appointment: movie, one or more times (real showtimes of that movie, or a time typed by hand), friends to invite
 * (a group picks all its members at once), and an optional answer-by time. Picking another movie reloads the page for that movie's showtimes;
 * what was typed here (friends, deadline) stays.
 */
export function NewAppointmentForm({ movies, movieId, showtimes, initialShowtimeId, friends, groups }: Props) {
  const t = useTranslations("appointments.new");
  const tc = useTranslations("appointments");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  // Picking a movie reloads the page for that movie's showtimes. The select shows the new movie at once, and the times area shows a loader until they arrive.
  const [loadingMovie, startLoadingMovie] = useTransition();
  const [pickedMovie, setPickedMovie] = useState<string | undefined>(undefined);
  const shownMovie = loadingMovie ? pickedMovie : movieId;

  // Times belong to a movie: picking another movie starts the times over (the page below re-renders with that movie's showtimes).
  const [timesFor, setTimesFor] = useState(movieId);
  const [showtimeIds, setShowtimeIds] = useState<string[]>(initialShowtimeId ? [initialShowtimeId] : []);
  const [custom, setCustom] = useState<string[]>([]);
  if (timesFor !== movieId) {
    setTimesFor(movieId);
    setShowtimeIds([]);
    setCustom([]);
  }
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [invitees, setInvitees] = useState<string[]>([]);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const total = showtimeIds.length + custom.length;

  function addCustom() {
    const iso = vietnamToIso(date, time);
    if (!iso) return setErrors((e) => ({ ...e, custom: t("errors.customInvalid") }));
    if (new Date(iso).getTime() <= Date.now()) return setErrors((e) => ({ ...e, custom: t("errors.past") }));
    if (custom.includes(iso)) return setErrors((e) => ({ ...e, custom: t("errors.duplicate") }));
    if (total >= MAX_TIME_OPTIONS) return setErrors((e) => ({ ...e, custom: t("errors.tooManyTimes", { max: MAX_TIME_OPTIONS }) }));
    setErrors((e) => ({ ...e, custom: "" }));
    setCustom([...custom, iso]);
    setDate("");
    setTime("");
  }

  function pickMovie(id: string) {
    setPickedMovie(id);
    startLoadingMovie(() => {
      router.replace(`/appointments/new?movieId=${id}`);
    });
  }

  function groupChosen(memberIds: string[]) {
    return memberIds.length > 0 && memberIds.every((id) => invitees.includes(id));
  }
  function toggleGroup(memberIds: string[]) {
    setInvitees((current) => (groupChosen(memberIds) ? current.filter((id) => !memberIds.includes(id)) : [...new Set([...current, ...memberIds])]));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!movieId) next.movie = t("errors.movie");
    if (total === 0) next.times = t("errors.times");
    if (invitees.length === 0) next.invitees = t("errors.invitees");
    let responseDeadline: string | undefined;
    if (deadlineDate || deadlineTime) {
      const iso = vietnamToIso(deadlineDate, deadlineTime);
      // The poll must end before the first time on it.
      const starts = [...showtimeIds.map((id) => showtimes.find((s) => s.id === id)?.startAt), ...custom].filter((v): v is string => Boolean(v)).map((v) => new Date(v).getTime());
      if (!iso || new Date(iso).getTime() <= Date.now()) next.deadline = t("errors.deadline");
      else if (starts.length > 0 && new Date(iso).getTime() >= Math.min(...starts)) next.deadline = t("errors.deadlineBeforeStart");
      else responseDeadline = iso;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    start(async () => {
      const result = await createAppointmentAction({
        movieId,
        options: [...showtimeIds.map((id) => ({ showtimeId: id })), ...custom.map((iso) => ({ startAt: iso }))],
        inviteeIds: invitees,
        responseDeadline,
        send: true,
      }).catch(() => null);
      if (!result) {
        toast.error(tc("networkError"));
        return;
      }
      if (!result.ok) {
        toast.error(tc(`errors.${result.error}`));
        return;
      }
      toast.success(t("sent"));
      router.replace(`/appointments/${result.id}`);
    });
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p role="alert" className="type-secondary text-destructive">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-field">
      <div className="flex flex-col gap-item">
        <Label htmlFor="appointment-movie" className="type-label text-muted-foreground">
          {t("movieLabel")}
          <RequiredMark />
        </Label>
        <Select value={shownMovie ?? ""} onValueChange={pickMovie}>
          <SelectTrigger id="appointment-movie" aria-required aria-invalid={errors.movie ? true : undefined} className={`${CONTROL} w-full`}>
            <SelectValue placeholder={t("moviePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {movies.map((movie) => (
              <SelectItem key={movie.id} value={movie.id}>
                {movie.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldError("movie")}
      </div>

      <div className="flex flex-col gap-item">
        <span id="appointment-times" className="type-label text-muted-foreground">
          {t("timesLabel")}
          <RequiredMark />
        </span>
        {loadingMovie ? (
          <LoadingState compact />
        ) : showtimes.length > 0 ? (
          <ShowtimePicker
            showtimes={showtimes}
            selectedIds={showtimeIds}
            initialDay={initialShowtimeId ? vietnamDayKey(showtimes.find((s) => s.id === initialShowtimeId)?.startAt ?? "") : undefined}
            onToggle={(id) => (showtimeIds.includes(id) || total < MAX_TIME_OPTIONS ? setShowtimeIds(toggle(showtimeIds, id)) : setErrors((e) => ({ ...e, times: t("errors.tooManyTimes", { max: MAX_TIME_OPTIONS }) })))}
          />
        ) : movieId ? (
          <p className="type-secondary text-muted-foreground">{t("noShowtimes")}</p>
        ) : null}

        {custom.length > 0 ? (
          <div className="flex flex-wrap gap-stack">
            {custom.map((iso) => (
              <Chip key={iso} selected onClick={() => setCustom(custom.filter((v) => v !== iso))} aria-label={t("removeTime")}>
                {formatDayLong(iso, locale)} · {formatTime(iso, locale)}
                <X className="size-icon-sm" aria-hidden />
              </Chip>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-stack">
          <span className="type-secondary text-muted-foreground">{t("customLabel")}</span>
          <div className="flex gap-stack">
            <DateTimeField kind="date" label={t("customDate")} value={date} onChange={setDate} className="min-w-0 flex-1" />
            <DateTimeField kind="time" label={t("customTime")} value={time} onChange={setTime} className="w-time-field" />
            <Button type="button" variant="outline" size="icon" className="size-control shrink-0" aria-label={t("addTime")} onClick={addCustom}>
              <Plus aria-hidden />
            </Button>
          </div>
          {fieldError("custom")}
        </div>
        {fieldError("times")}
      </div>

      <div className="flex flex-col gap-item">
        <span id="appointment-invitees" className="type-label text-muted-foreground">
          {t("inviteesLabel")}
          <RequiredMark />
        </span>
        {groups.length > 0 ? (
          <div role="group" aria-label={t("groupsLabel")} className="flex flex-wrap gap-stack">
            {groups.map((group) => (
              <Chip key={group.id} selected={groupChosen(group.memberIds)} onClick={() => toggleGroup(group.memberIds)} disabled={group.memberIds.length === 0}>
                {group.name}
              </Chip>
            ))}
          </div>
        ) : null}
        {friends.length > 0 ? (
          <div role="group" aria-labelledby="appointment-invitees" className="flex flex-wrap gap-stack">
            {friends.map((friend) => (
              <Chip key={friend.id} selected={invitees.includes(friend.id)} onClick={() => setInvitees(toggle(invitees, friend.id))}>
                {friend.name}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="type-secondary text-muted-foreground">{t("noFriends")}</p>
        )}
        {fieldError("invitees")}
      </div>

      <div className="flex flex-col gap-item">
        <span className="type-label text-muted-foreground">{t("deadlineLabel")}</span>
        <div className="flex gap-stack">
          <DateTimeField kind="date" label={t("deadlineDate")} value={deadlineDate} onChange={setDeadlineDate} className="min-w-0 flex-1" />
          <DateTimeField kind="time" label={t("deadlineTime")} value={deadlineTime} onChange={setDeadlineTime} className="w-time-field" />
        </div>
        {fieldError("deadline")}
      </div>

      <div aria-hidden className="h-save-clear shrink-0" />
      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-inset pb-(--inset-bottom)">
        <div className="mx-auto flex max-w-form items-center">
          <Button type="submit" size="cta" disabled={pending} className="pointer-events-auto min-w-0 flex-1">
            {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Send aria-hidden />}
            {t("submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}
