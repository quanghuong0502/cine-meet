"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DateTimeField } from "@/components/date-time-field";
import { toast } from "sonner";
import { createAppointmentAction } from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { ShowtimeFinder } from "@/components/appointment/showtime-finder";
import type { ShowtimeChoice } from "@/components/appointment/showtime-picker";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { vietnamToIso } from "@/lib/appointment/datetime";
import type { TimeSlot } from "@/lib/showtime/slots";
import { vietnamToday } from "@/lib/movie/status";
import { MAX_TIME_OPTIONS } from "@/lib/appointment/limits";

interface Props {
  movies: { id: string; title: string }[];
  movieId?: string;
  /** The showtime the person came from ("plan this showtime"): already picked when the form opens. */
  initialShowtime?: ShowtimeChoice;
  slots: TimeSlot[];
  /** The answer-by time must be at least this many minutes before the earliest showtime (set by the admin). */
  deadlineLeadMinutes: number;
  friends: { id: string; name: string }[];
  groups: { id: string; name: string; memberIds: string[] }[];
}

const CONTROL = "h-control rounded-xl bg-card px-inset type-body";

/**
 * Creating an appointment: movie, one or more showtimes, friends to invite (a group picks all its members at once), and an optional
 * answer-by time. A showtime is found by typing the day and time to watch: the showtimes of that movie from then on are loaded (with
 * filters) and one is picked. With no showtime to pick there is nothing to add, so an appointment cannot be made without one.
 */
export function NewAppointmentForm({ movies, movieId: initialMovieId, initialShowtime, slots, deadlineLeadMinutes, friends, groups }: Props) {
  const t = useTranslations("appointments.new");
  const tc = useTranslations("appointments");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [movieId, setMovieId] = useState(initialMovieId);
  const [chosen, setChosen] = useState<ShowtimeChoice[]>(initialShowtime ? [initialShowtime] : []);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [allPaidByCreator, setAllPaidByCreator] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The latest answer-by time: the earliest showtime picked, minus the admin's lead. Checked as soon as both fields are filled.
  const earliestStart = chosen.length > 0 ? Math.min(...chosen.map((c) => new Date(c.startAt).getTime())) : null;
  const latestDeadline = earliestStart === null ? null : earliestStart - deadlineLeadMinutes * 60_000;
  const deadlineIso = vietnamToIso(deadlineDate, deadlineTime);
  const deadlineProblem = ((): string => {
    if (!deadlineIso) return "";
    // Only the lead is checked while typing (a time already past is caught on send, and the date picker starts at today).
    const at = new Date(deadlineIso).getTime();
    if (latestDeadline !== null && at > latestDeadline) return t("errors.deadlineBeforeStart", { minutes: deadlineLeadMinutes });
    return "";
  })();
  const deadlineMaxDate = latestDeadline === null ? undefined : new Date(latestDeadline + 7 * 3600_000).toISOString().slice(0, 10);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  // Showtimes belong to a movie: another movie starts the picked ones over.
  function pickMovie(id: string) {
    setMovieId(id);
    setChosen([]);
    setErrors((e) => ({ ...e, movie: "", times: "", find: "" }));
  }

  function pickShowtime(showtime: ShowtimeChoice) {
    if (chosen.length >= MAX_TIME_OPTIONS) return setErrors((e) => ({ ...e, find: t("errors.tooManyTimes", { max: MAX_TIME_OPTIONS }) }));
    setChosen((list) => [...list, showtime].sort((a, b) => a.startAt.localeCompare(b.startAt)));
    setErrors((e) => ({ ...e, find: "", times: "" }));
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
    if (chosen.length === 0) next.times = t("errors.times");
    if (invitees.length === 0) next.invitees = t("errors.invitees");
    let responseDeadline: string | undefined;
    if (deadlineDate || deadlineTime) {
      const iso = vietnamToIso(deadlineDate, deadlineTime);
      // The poll must end before the first time on it.
      const starts = chosen.map((c) => new Date(c.startAt).getTime());
      if (!iso || new Date(iso).getTime() <= Date.now()) next.deadline = t("errors.deadline");
      else if (starts.length > 0 && new Date(iso).getTime() > Math.min(...starts) - deadlineLeadMinutes * 60_000) next.deadline = t("errors.deadlineBeforeStart", { minutes: deadlineLeadMinutes });
      else responseDeadline = iso;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    start(async () => {
      const result = await createAppointmentAction({
        movieId,
        options: chosen.map((c) => ({ showtimeId: c.id })),
        inviteeIds: invitees,
        responseDeadline,
        send: true,
        allPaidByCreator,
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
        <Select value={movieId ?? ""} onValueChange={pickMovie}>
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
        {movieId ? (
          <ShowtimeFinder key={movieId} movieId={movieId} slots={slots} chosen={chosen} onPick={pickShowtime} onUnpick={(id) => setChosen((list) => list.filter((x) => x.id !== id))} onError={(message) => setErrors((e) => ({ ...e, find: message }))} />
        ) : (
          <p className="type-secondary text-muted-foreground">{t("pickMovieFirst")}</p>
        )}
        {fieldError("find")}
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

      <div className="flex min-h-target items-start justify-between gap-group rounded-xl border bg-card px-inset-sm">
        <Label htmlFor="appointment-all-paid" className="flex min-w-0 flex-1 flex-col items-start gap-tight text-left py-inset-sm">
          <span className="type-item-title">{t("allPaidByCreatorLabel")}</span>
          <span className="type-secondary text-muted-foreground">{t("allPaidByCreatorHint")}</span>
        </Label>
        <Switch className="mt-inset-sm" id="appointment-all-paid" checked={allPaidByCreator} onCheckedChange={setAllPaidByCreator} />
      </div>

      <div className="flex flex-col gap-item">
        <span className="type-label text-muted-foreground">{t("deadlineLabel")}</span>
        <div className="flex gap-stack">
          <DateTimeField kind="date" label={t("deadlineDate")} value={deadlineDate} onChange={setDeadlineDate} min={vietnamToday()} max={deadlineMaxDate} className="min-w-0 flex-1" />
          <DateTimeField kind="time" label={t("deadlineTime")} value={deadlineTime} onChange={setDeadlineTime} className="w-time-field" />
        </div>
        {deadlineProblem ? (
          <p role="alert" className="type-secondary text-destructive">
            {deadlineProblem}
          </p>
        ) : (
          fieldError("deadline")
        )}
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
