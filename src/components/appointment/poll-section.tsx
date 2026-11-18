"use client";

import { BellRing, CalendarClock, Clock, LoaderCircle, Plus, Save, ThumbsDown, ThumbsUp, Undo2, UserLock, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { submitResponseAction } from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { LockDialog } from "@/components/appointment/lock-dialog";
import { DateTimeField } from "@/components/date-time-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { vietnamToIso } from "@/lib/appointment/datetime";
import { MAX_TIME_OPTIONS } from "@/lib/appointment/limits";
import { yesVoterIds } from "@/lib/appointment/state";
import { cn } from "@/lib/utils";
import type { AppointmentView } from "@/services/appointment.service";

type Vote = "yes" | "no" | null;

interface Props {
  view: AppointmentView;
  /** The person may still answer (invited, poll open, before the answer-by time). */
  canVote: boolean;
  when: (iso: string) => string;
  /** The "turn the invitation down" button (built by the screen, which owns its confirmation); it shares the bottom bar with Save. */
  declineButton?: React.ReactNode;
  /** For the creator while people can still answer: locks this time in with the chosen people. Without it there is no lock button. */
  onLock?: (optionId: string, attendeeIds: string[]) => void;
  /** For the creator while people can still answer: nudges the people who have not voted on this time. */
  onRemind?: (optionId: string) => void;
  /** Tells the page whether the fixed bottom bar is showing, so it can leave room for it at its very end. */
  onBarVisibleChange?: (visible: boolean) => void;
  /** A write is running (the lock, in the creator's case). */
  busy?: boolean;
}

/**
 * The candidate times with how people voted. A person who may still answer sets Yes/No on each time and suggests more times,
 * all on screen only: nothing is sent until they press "Save answers" (fixed at the bottom, above the menu), which sends the lot
 * at once. The counts and names show the person's own draft straight away. The parent gives this a `key` that changes after a save,
 * so it starts again from what the server now has.
 */
export function PollSection({ view, canVote, when, declineButton, onLock, onRemind, onBarVisibleChange, busy = false }: Props) {
  const t = useTranslations("appointments.detail");
  const tc = useTranslations("appointments");
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, Vote>>(() => Object.fromEntries(view.options.map((o) => [o.id, o.myVote ?? null])));
  const [proposals, setProposals] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [locking, setLocking] = useState<string | null>(null);

  const changed = view.options.filter((o) => (draft[o.id] ?? null) !== (o.myVote ?? null));
  const dirty = changed.length > 0 || proposals.length > 0;
  const barVisible = Boolean(canVote && (dirty || declineButton));

  useEffect(() => {
    onBarVisibleChange?.(barVisible);
  }, [barVisible, onBarVisibleChange]);

  function addProposal() {
    const iso = vietnamToIso(date, time);
    if (!iso || new Date(iso).getTime() <= Date.now()) return setError(t("proposeInvalid"));
    if (view.responseDeadline && new Date(iso).getTime() <= new Date(view.responseDeadline).getTime()) return setError(tc("errors.option_before_deadline"));
    const taken = [...view.options.map((o) => new Date(o.startAt).getTime()), ...proposals.map((p) => new Date(p).getTime())];
    if (taken.includes(new Date(iso).getTime())) return setError(tc("errors.duplicate"));
    if (view.options.length + proposals.length >= MAX_TIME_OPTIONS) return setError(tc("errors.limit"));
    setError("");
    setProposals([...proposals, iso]);
    setDate("");
    setTime("");
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
        proposals: proposals.map((startAt) => ({ startAt })),
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
      <ul className="flex flex-col gap-stack">
        {view.options.map((option) => {
          const mine = draft[option.id] ?? null;
          // Everyone else's saved votes, plus this person's draft in place of their saved one.
          const others = option.votes.filter((v) => v.userId !== view.viewerId);
          const yes = others.filter((v) => v.vote === "yes").length + (mine === "yes" ? 1 : 0);
          const no = others.filter((v) => v.vote === "no").length + (mine === "no" ? 1 : 0);
          // Who has not answered this time yet (this person's unsaved pick counts as an answer).
          const waiting = view.participants.filter(
            (p) => (p.status === "invited" || p.status === "accepted") && (p.id === view.viewerId ? mine === null : !others.some((v) => v.userId === p.id)),
          ).length;
          return (
            <li key={option.id} className="flex flex-col gap-stack rounded-xl border bg-card p-inset-sm">
              <div className="flex items-stretch gap-stack">
                {/* With the buttons beside it, the text splits into two rows that line up with the two buttons: the time and place level with
                    the top one, the counts centred on the bottom one. */}
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-tight">
                  <div className="flex flex-col gap-tight">
                    <span className="type-item-title tabular-nums">{when(option.startAt)}</span>
                    {option.place ? <span className="break-words type-secondary text-muted-foreground">{option.place}</span> : null}
                    {option.proposedBy ? <span className="type-secondary text-muted-foreground">{t("proposedBy", { name: option.proposedBy.name })}</span> : null}
                  </div>
                  <div className={cn("flex items-center", onLock || onRemind ? "h-control" : "pt-stack")}>
                    <ul className="flex items-center gap-group type-secondary font-medium tabular-nums">
                      <li className="flex items-center gap-tight" aria-label={t("countYes", { count: yes })}>
                        <ThumbsUp className="size-icon-sm" aria-hidden />
                        <span aria-hidden>{yes}</span>
                      </li>
                      <li className="flex items-center gap-tight" aria-label={t("countNo", { count: no })}>
                        <ThumbsDown className="size-icon-sm" aria-hidden />
                        <span aria-hidden>{no}</span>
                      </li>
                      {waiting > 0 ? (
                        <li className="flex items-center gap-tight" aria-label={t("countWaiting", { count: waiting })}>
                          <Clock className="size-icon-sm" aria-hidden />
                          <span aria-hidden>{waiting}</span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>
                {/* Creator: nudge the people who have not voted on this time, or lock it in (nobody said Yes -> nobody could go, so it is off). */}
                {onLock || onRemind ? (
                  <div className="flex shrink-0 flex-col gap-stack">
                    {onRemind ? (
                      <Button type="button" variant="outline" size="icon" disabled={busy || option.waitingCount === 0 || option.recentlyReminded} aria-label={t("remindThisTime")} onClick={() => onRemind(option.id)}>
                        <BellRing aria-hidden />
                      </Button>
                    ) : null}
                    {onLock ? (
                      <Button type="button" variant="outline" size="icon" disabled={busy || votersOf(option.id).length === 0} aria-label={t("lockThisTime")} onClick={() => setLocking(option.id)}>
                        <UserLock aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {canVote ? (
                <div role="group" aria-label={t("yourVote")} className="flex gap-stack">
                  <Chip selected={mine === "yes"} disabled={pending} onClick={() => setDraft({ ...draft, [option.id]: mine === "yes" ? null : "yes" })}>
                    <ThumbsUp className="size-icon-sm" aria-hidden />
                    {t("yes")}
                  </Chip>
                  <Chip selected={mine === "no"} disabled={pending} onClick={() => setDraft({ ...draft, [option.id]: mine === "no" ? null : "no" })}>
                    <ThumbsDown className="size-icon-sm" aria-hidden />
                    {t("no")}
                  </Chip>
                </div>
              ) : null}
            </li>
          );
        })}

        {proposals.map((iso) => (
          <li key={iso} className="flex items-start gap-item rounded-xl border border-primary bg-accent p-inset-sm">
            <div className="flex min-w-0 flex-1 flex-col gap-stack">
              <span className="type-item-title tabular-nums">{when(iso)}</span>
              <span className="flex flex-wrap items-center gap-stack">
                <Badge variant="secondary">
                  {t("unsaved")}
                </Badge>
                <span className="type-secondary text-muted-foreground">{t("proposedYes")}</span>
              </span>
            </div>
            <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={t("removeProposal")} onClick={() => setProposals(proposals.filter((p) => p !== iso))}>
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      {canVote ? (
        <div className="flex flex-col gap-stack">
          <span className="type-label text-muted-foreground">
            <CalendarClock className="mr-stack inline size-icon-sm align-text-bottom" aria-hidden />
            {t("proposeLabel")}
          </span>
          <div className="flex gap-stack">
            <DateTimeField kind="date" label={t("proposeDate")} value={date} onChange={setDate} className="min-w-0 flex-1" />
            <DateTimeField kind="time" label={t("proposeTime")} value={time} onChange={setTime} className="w-time-field" />
            <Button type="button" variant="outline" size="icon" className="size-control shrink-0" disabled={pending} aria-label={t("proposeButton")} onClick={addProposal}>
              <Plus aria-hidden />
            </Button>
          </div>
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

      {barVisible ? (
        <>
          {/* The page leaves room at its very end for this fixed bar (`onBarVisibleChange`), so the last thing on the page can scroll
              clear of it. The room is not made here: it would open a gap in the middle of the page. */}
          <div data-bottom-fixed className="pointer-events-none fixed inset-x-0 bottom-[var(--nav-clearance)] z-30 px-inset">
            <div className="mx-auto flex max-w-form items-center gap-stack">
              {dirty ? (
                <Button type="button" variant="outline" size="icon" disabled={pending} onClick={discard} aria-label={t("discard")} className="pointer-events-auto size-control shrink-0 rounded-full">
                  <Undo2 aria-hidden />
                </Button>
              ) : null}
              {declineButton}
              {dirty ? (
                <Button type="button" size="cta" disabled={pending} onClick={save} className="pointer-events-auto min-w-0 flex-1">
                  {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Save aria-hidden />}
                  {t("save")}
                </Button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
