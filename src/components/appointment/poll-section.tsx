"use client";

import { AddIcon, AltArrowDownIcon, AltArrowUpIcon, BellRingIcon, CalendarAddIcon, ClapperboardPlayIcon, ClockCircleIcon, CloseIcon, DisketteIcon, DislikeIcon, LikeIcon, LoaderIcon, UndoLeftRoundIcon, UserCheckRoundedIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { submitResponseAction } from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { LockDialog } from "@/components/appointment/lock-dialog";
import { ShowtimeFinder } from "@/components/appointment/showtime-finder";
import { DateTimeField } from "@/components/date-time-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { vietnamToIso } from "@/lib/appointment/datetime";
import { MAX_TIME_OPTIONS } from "@/lib/appointment/limits";
import type { ShowtimeChoice } from "@/lib/appointment/showtime-choice";
import { yesVoterIds } from "@/lib/appointment/state";
import { vietnamToday } from "@/lib/movie/status";
import type { TimeSlot } from "@/lib/showtime/slots";
import type { AppointmentView } from "@/services/appointment.service";

type Vote = "yes" | "no" | null;
type ProposalDraft = { key: string; startAt: string; showtimeId?: string; place?: string; choice?: ShowtimeChoice };

interface Props {
  view: AppointmentView;
  /** The person may still answer (invited, poll open, before the answer-by time). */
  canVote: boolean;
  when: (iso: string) => string;
  /** For the creator while people can still answer: locks this time in with the chosen people. Without it there is no lock button. */
  onLock?: (optionId: string, attendeeIds: string[]) => void;
  /** For the creator while people can still answer: nudges the people who have not voted on this time. */
  onRemind?: (optionId: string) => void;
  /** Where the Save bar is drawn (portal inside AppointmentDetail's fixed bottom bar). */
  barSlot?: HTMLElement | null;
  /** A write is running (the lock, in the creator's case). */
  busy?: boolean;
  /** Admin response deadline lead in minutes, to keep client-side proposal validation aligned with the server. */
  deadlineLeadMinutes?: number;
  /** Time slots for the optional ShowtimeFinder when proposing another time. */
  timeSlots?: TimeSlot[];
}

/**
 * The candidate times with how people voted. Shows who voted Yes/No/Waiting via expandable detail on each option,
 * and gives the creator clear labeled controls to lock in a time or nudge pending voters.
 */
export function PollSection({
  view,
  canVote,
  when,
  onLock,
  onRemind,
  barSlot = null,
  busy = false,
  deadlineLeadMinutes = 60,
  timeSlots = [],
}: Props) {
  const t = useTranslations("appointments.detail");
  const tc = useTranslations("appointments");
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, Vote>>(() => Object.fromEntries(view.options.map((o) => [o.id, o.myVote ?? null])));
  const [proposals, setProposals] = useState<ProposalDraft[]>([]);
  const [proposeMode, setProposeMode] = useState<"showtime" | "custom">("showtime");
  const [finderOpen, setFinderOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [locking, setLocking] = useState<string | null>(null);
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const activeRemindingId = busy ? remindingId : null;
  const changed = view.options.filter((o) => (draft[o.id] ?? null) !== (o.myVote ?? null));
  const dirty = changed.length > 0 || proposals.length > 0;
  const barVisible = Boolean(canVote && dirty);

  function validateProposal(iso: string, showtimeId?: string): string | null {
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms) || ms <= Date.now()) return t("proposeInvalid");
    if (view.responseDeadline && ms < new Date(view.responseDeadline).getTime() + deadlineLeadMinutes * 60_000) {
      return tc("errors.option_before_deadline");
    }
    const existingClash = view.options.some(
      (o) => new Date(o.startAt).getTime() === ms && (o.showtimeId ?? undefined) === showtimeId,
    );
    const draftClash = proposals.some((p) => new Date(p.startAt).getTime() === ms && p.showtimeId === showtimeId);
    if (existingClash || draftClash) return tc("errors.duplicate");
    if (view.options.length + proposals.length >= MAX_TIME_OPTIONS) return tc("errors.limit");
    return null;
  }

  function addProposal() {
    const iso = vietnamToIso(date, time);
    if (!iso) return setError(t("proposeInvalid"));
    const problem = validateProposal(iso);
    if (problem) return setError(problem);
    setError("");
    setProposals([...proposals, { key: `custom:${iso}`, startAt: iso }]);
    setDate("");
    setTime("");
  }

  function addShowtimeProposal(choice: ShowtimeChoice) {
    const problem = validateProposal(choice.startAt, choice.id);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    const place = [choice.branchName, choice.roomName].filter(Boolean).join(" · ");
    setProposals((prev) => [...prev, { key: `st:${choice.id}`, startAt: choice.startAt, showtimeId: choice.id, place, choice }]);
  }

  function removeShowtimeProposal(showtimeId: string) {
    setError("");
    setProposals((prev) => prev.filter((p) => p.showtimeId !== showtimeId));
  }

  function discard() {
    setDraft(Object.fromEntries(view.options.map((o) => [o.id, o.myVote ?? null])));
    setProposals([]);
    setError("");
  }

  function save() {
    start(async () => {
      const result = await submitResponseAction(view.id, {
        votes: changed.map((o) => ({ optionId: o.id, vote: draft[o.id] ?? null })),
        proposals: proposals.map((p) => (p.showtimeId ? { showtimeId: p.showtimeId } : { startAt: p.startAt })),
      }).catch(() => null);
      if (!result) {
        toast.error(tc("networkError"));
        return;
      }
      if (!result.ok) {
        toast.error(tc(`errors.${result.error}`));
        return;
      }
      toast.success(t("saved"));
    });
  }

  const nameOf = (userId: string) =>
    userId === view.creator.id ? view.creator.name : (view.participants.find((p) => p.id === userId)?.name ?? "?");

  /** People who said Yes to a time and are still in (have not turned the invitation down). */
  const votersOf = (optionId: string) => {
    const option = view.options.find((o) => o.id === optionId);
    const yes = option ? yesVoterIds(option.votes) : [];
    return view.participants.filter((p) => (p.status === "invited" || p.status === "accepted") && yes.includes(p.id)).map((p) => ({ id: p.id, name: p.name }));
  };
  const lockingOption = view.options.find((o) => o.id === locking);

  return (
    <section aria-labelledby="appt-poll" className="flex flex-col gap-item">
      <h2 id="appt-poll" className="type-heading">
        {view.isCreator ? t("timesCreator") : t("times")}
      </h2>
      <ul className="flex flex-col gap-item">
        {view.options.map((option) => {
          const mine = draft[option.id] ?? null;
          // Everyone else's saved votes, plus this person's draft in place of their saved one.
          const others = option.votes.filter((v) => v.userId !== view.viewerId);
          const yesIds = [...others.filter((v) => v.vote === "yes").map((v) => v.userId), ...(mine === "yes" ? [view.viewerId] : [])];
          const noIds = [...others.filter((v) => v.vote === "no").map((v) => v.userId), ...(mine === "no" ? [view.viewerId] : [])];
          const waitingPeople = view.participants.filter(
            (p) => (p.status === "invited" || p.status === "accepted") && (p.id === view.viewerId ? mine === null : !others.some((v) => v.userId === p.id)),
          );
          const yes = yesIds.length;
          const no = noIds.length;
          const waiting = waitingPeople.length;
          const expanded = expandedOption === option.id;
          const eligibleVoters = votersOf(option.id);
          const isUnsaved = canVote && mine !== (option.myVote ?? null);
          return (
            <li key={option.id} className="flex flex-col gap-item rounded-xl border bg-card p-inset">
              <div className="flex flex-col gap-tight">
                <span className="flex flex-wrap items-center gap-stack">
                  <span className="type-item-title tabular-nums">{when(option.startAt)}</span>
                  {isUnsaved ? <Badge variant="accent">{t("unsaved")}</Badge> : null}
                </span>
                {option.place ? <span className="break-words type-secondary text-muted-foreground">{option.place}</span> : null}
                {option.proposedBy ? <span className="type-caption text-muted-foreground">{t("proposedBy", { name: option.proposedBy.name })}</span> : null}
              </div>

              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedOption((cur) => (cur === option.id ? null : option.id))}
                className="flex min-h-target items-center justify-between gap-stack rounded-lg bg-muted/40 px-inset-sm py-tight text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
              >
                <span className="flex items-center gap-group type-label tabular-nums">
                  <span className="flex items-center gap-tight" aria-label={t("countYes", { count: yes })}>
                    <LikeIcon className="size-icon-sm text-success" aria-hidden />
                    <span aria-hidden>{yes}</span>
                  </span>
                  <span className="flex items-center gap-tight" aria-label={t("countNo", { count: no })}>
                    <DislikeIcon className="size-icon-sm text-destructive" aria-hidden />
                    <span aria-hidden>{no}</span>
                  </span>
                  <span className="flex items-center gap-tight text-muted-foreground" aria-label={t("countWaiting", { count: waiting })}>
                    <ClockCircleIcon className="size-icon-sm" aria-hidden />
                    <span aria-hidden>{waiting}</span>
                  </span>
                </span>
                {expanded ? <AltArrowUpIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden /> : <AltArrowDownIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />}
              </button>

              {expanded ? (
                <dl className="flex flex-col gap-tight rounded-lg border bg-background/60 p-inset-sm type-caption">
                  {yesIds.length > 0 ? (
                    <div className="flex flex-wrap gap-x-stack">
                      <dt className="font-medium text-success">{t("yes")}:</dt>
                      <dd className="text-foreground">{yesIds.map(nameOf).join(", ")}</dd>
                    </div>
                  ) : null}
                  {noIds.length > 0 ? (
                    <div className="flex flex-wrap gap-x-stack">
                      <dt className="font-medium text-destructive">{t("no")}:</dt>
                      <dd className="text-foreground">{noIds.map(nameOf).join(", ")}</dd>
                    </div>
                  ) : null}
                  {waitingPeople.length > 0 ? (
                    <div className="flex flex-wrap gap-x-stack">
                      <dt className="font-medium text-muted-foreground">{t("waitingShort")}:</dt>
                      <dd className="text-muted-foreground">{waitingPeople.map((p) => p.name).join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {canVote ? (
                <div role="group" aria-label={t("yourVote")} className="flex gap-stack">
                  <Chip selected={mine === "yes"} disabled={pending} onClick={() => setDraft({ ...draft, [option.id]: mine === "yes" ? null : "yes" })} className="min-w-0 flex-1 px-inset-sm">
                    <LikeIcon className="size-icon-sm shrink-0" aria-hidden />
                    <span className="truncate">{t("yes")}</span>
                  </Chip>
                  <Chip selected={mine === "no"} disabled={pending} onClick={() => setDraft({ ...draft, [option.id]: mine === "no" ? null : "no" })} className="min-w-0 flex-1 px-inset-sm">
                    <DislikeIcon className="size-icon-sm shrink-0" aria-hidden />
                    <span className="truncate">{t("no")}</span>
                  </Chip>
                </div>
              ) : null}

              {onLock || onRemind ? (
                <div className="flex flex-wrap items-center gap-stack border-t pt-item">
                  {onLock ? (
                    <Button
                      type="button"
                      variant={eligibleVoters.length > 0 ? "secondary" : "outline"}
                      size="sm"
                      disabled={busy || eligibleVoters.length === 0}
                      onClick={() => setLocking(option.id)}
                      className="flex-auto rounded-full"
                    >
                      <UserCheckRoundedIcon aria-hidden />
                      {t("lockThisTime")}
                    </Button>
                  ) : null}
                  {onRemind ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || option.waitingCount === 0 || option.recentlyReminded}
                      aria-label={t("remindThisTime")}
                      onClick={() => {
                        setRemindingId(option.id);
                        onRemind(option.id);
                      }}
                      className="shrink-0 rounded-full"
                    >
                      {activeRemindingId === option.id ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <BellRingIcon aria-hidden />}
                      {t("remindShort")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}

        {proposals.map((proposal) => (
          <li key={proposal.key} className="flex items-start gap-item rounded-xl border border-primary bg-accent p-inset-sm">
            <div className="flex min-w-0 flex-1 flex-col gap-stack">
              <span className="type-item-title tabular-nums">{when(proposal.startAt)}</span>
              {proposal.place ? <span className="break-words type-secondary text-muted-foreground">{proposal.place}</span> : null}
              <span className="flex flex-wrap items-center gap-stack">
                <Badge variant="outline" className="bg-card">
                  {t("unsaved")}
                </Badge>
                <span className="type-secondary text-muted-foreground">{t("proposedYes")}</span>
              </span>
            </div>
            <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={t("removeProposal")} onClick={() => setProposals(proposals.filter((p) => p.key !== proposal.key))}>
              <CloseIcon aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      {canVote ? (
        <div className="flex flex-col gap-stack">
          <div className="flex items-center justify-between gap-stack">
            <span className="type-label text-muted-foreground">
              <CalendarAddIcon className="mr-stack inline size-icon-sm align-text-bottom" aria-hidden />
              {t("proposeLabel")}
            </span>
            {finderOpen ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError("");
                  setProposeMode((m) => (m === "showtime" ? "custom" : "showtime"));
                }}
              >
                {proposeMode === "showtime" ? t("proposeCustomMode") : t("proposeShowtimeMode")}
              </Button>
            ) : null}
          </div>
          {!finderOpen ? (
            <Button type="button" variant="outline" size="cta-sm" disabled={pending} onClick={() => setFinderOpen(true)}>
              <ClapperboardPlayIcon aria-hidden />
              {t("proposeShowtimeMode")}
            </Button>
          ) : proposeMode === "showtime" ? (
            <ShowtimeFinder
              movieId={view.movie.id}
              slots={timeSlots}
              chosen={proposals.flatMap((p) => (p.choice ? [p.choice] : []))}
              onPick={addShowtimeProposal}
              onUnpick={removeShowtimeProposal}
              onError={setError}
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-stack">
                <DateTimeField kind="date" label={t("proposeDate")} value={date} min={vietnamToday()} onChange={setDate} className="min-w-menu-min flex-1" />
                <DateTimeField kind="time" label={t("proposeTime")} value={time} onChange={setTime} className="min-w-time-field flex-1" />
              </div>
              <Button type="button" variant="outline" size="cta-sm" disabled={pending || !date || !time} onClick={addProposal}>
                <AddIcon aria-hidden />
                {t("proposeButton")}
              </Button>
            </>
          )}
          {error ? (
            <p role="alert" className="type-secondary text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {onLock && lockingOption ? (
        <LockDialog
          key={lockingOption.id}
          open
          onOpenChange={(next) => !next && setLocking(null)}
          timeText={when(lockingOption.startAt)}
          voters={votersOf(lockingOption.id)}
          pending={busy}
          onConfirm={(attendeeIds) => onLock(lockingOption.id, attendeeIds)}
        />
      ) : null}

      {barVisible && barSlot
        ? createPortal(
            <div className="mx-auto flex w-full max-w-form items-center gap-stack">
              <Button type="button" variant="outline" size="icon" disabled={pending} onClick={discard} aria-label={t("discard")} className="pointer-events-auto size-control shrink-0 rounded-full">
                <UndoLeftRoundIcon aria-hidden />
              </Button>
              <Button type="button" size="cta" disabled={pending} onClick={save} className="pointer-events-auto min-w-0 flex-1">
                {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <DisketteIcon aria-hidden />}
                {t("save")}
              </Button>
            </div>,
            barSlot,
          )
        : null}
    </section>
  );
}
