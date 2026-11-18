"use client";

import { Ban, CalendarClock, LoaderCircle, LogOut, Plus, ThumbsDown, ThumbsUp, UserLock, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelAppointmentAction,
  declineInvitationAction,
  lockParticipantsAction,
  proposeOptionAction,
  setVoteAction,
  withdrawAction,
  type ActionResult,
} from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { AppointmentStatusBadge } from "@/components/appointment/status-badge";
import { ReasonDialog } from "@/components/appointment/reason-dialog";
import { PersonRow } from "@/components/friends/person-row";
import { ListThumb } from "@/components/list-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vietnamToIso } from "@/lib/appointment/datetime";
import { canWithdraw, isFinished, isOpenForReplies, yesVoterIds } from "@/lib/appointment/state";
import { formatDayLong, formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { AppointmentView, OptionView, ParticipantView } from "@/services/appointment.service";

const CONTROL = "h-control rounded-xl bg-card px-inset type-body";
type Dialog = "decline" | "withdraw" | "cancel" | null;

/**
 * The appointment screen. What it shows depends on who is looking and the step:
 * an invited person votes, suggests another time or turns it down; the creator sees the totals, picks one time and the final
 * list (locks it), or cancels; after locking an attendee can still leave. Every write says what happened in a toast.
 */
export function AppointmentDetail({ view }: { view: AppointmentView }) {
  const t = useTranslations("appointments.detail");
  const tc = useTranslations("appointments");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);

  const open = isOpenForReplies(view.status);
  const canVote = open && view.myStatus !== null;
  const finished = isFinished(view.status);
  const locked = view.chosenOptionId !== undefined;
  const chosen = view.options.find((o) => o.id === view.chosenOptionId);
  const nameOf = new Map(view.participants.map((p) => [p.id, p.name]));

  /** Runs a write, then tells the person what happened (or why not). Network trouble is said out loud. */
  function run(action: () => Promise<ActionResult>, done: string, after?: () => void) {
    start(async () => {
      const result = await action().catch(() => null);
      setDialog(null);
      if (!result) {
        toast.error(tc("networkError"));
        return;
      }
      if (!result.ok) {
        toast.error(tc(`errors.${result.error}`));
        return;
      }
      toast.success(done);
      after?.();
    });
  }

  const when = (iso: string) => `${formatDayLong(iso, locale)} · ${formatTime(iso, locale)}`;

  return (
    <div className="flex flex-col gap-section">
      <section className="flex items-start gap-item">
        <ListThumb imageUrl={view.movie.posterUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-stack">
          <h2 className="break-words type-heading">{view.movie.title}</h2>
          <span className="type-secondary text-muted-foreground">{view.isCreator ? tc("byMe") : tc("byName", { name: view.creator.name })}</span>
          <span className="flex flex-wrap items-center gap-stack">
            <AppointmentStatusBadge status={view.status} />
            {view.responseDeadline && open ? (
              <Badge variant="outline" className="h-auto py-hair type-tag">
                {t("answerBy", { time: when(view.responseDeadline) })}
              </Badge>
            ) : null}
          </span>
        </div>
      </section>

      {view.status === "CANCELLED" ? (
        <p role="status" className="rounded-xl border border-destructive/40 bg-destructive/10 p-inset-sm type-secondary">
          <Ban className="mr-stack inline size-icon-sm align-text-bottom" aria-hidden />
          {view.cancelReason ? t("cancelledWithReason", { reason: view.cancelReason }) : t("cancelled")}
        </p>
      ) : null}

      {view.myStatus === "declined" && open ? (
        <p role="status" className="rounded-xl border bg-card p-inset-sm type-secondary">
          {t("youDeclined")}
        </p>
      ) : null}
      {view.myStatus === "excluded" ? (
        <p role="status" className="rounded-xl border bg-card p-inset-sm type-secondary">
          {t("youExcluded")}
        </p>
      ) : null}
      {view.myStatus === "dropped" ? (
        <p role="status" className="rounded-xl border bg-card p-inset-sm type-secondary">
          {t("youLeft")}
        </p>
      ) : null}

      {locked && chosen ? (
        <section aria-labelledby="appt-time" className="flex flex-col gap-item">
          <h2 id="appt-time" className="type-heading">
            {t("chosenTime")}
          </h2>
          <div className="flex flex-col gap-tight rounded-xl border bg-card p-inset-sm">
            <span className="type-item-title tabular-nums">{when(chosen.startAt)}</span>
            {chosen.place ? <span className="break-words type-secondary text-muted-foreground">{chosen.place}</span> : null}
          </div>
        </section>
      ) : (
        <PollSection
          view={view}
          canVote={canVote}
          pending={pending}
          nameOf={nameOf}
          when={when}
          onVote={(option, vote) => run(() => setVoteAction(view.id, option.id, vote), t("voteSaved"))}
          onPropose={(iso) => run(() => proposeOptionAction(view.id, { startAt: iso }), t("proposed"))}
        />
      )}

      <section aria-labelledby="appt-people" className="flex flex-col gap-item">
        <h2 id="appt-people" className="type-heading">
          {t("people")}
        </h2>
        <ul className="flex flex-col gap-stack">
          <PersonRow name={view.creator.name} avatar={view.creator.avatar}>
            <Badge variant="secondary" className="h-auto py-hair type-tag">
              {t("creator")}
            </Badge>
          </PersonRow>
          {view.participants.map((p) => (
            <PersonRow key={p.id} name={p.name} avatar={p.avatar}>
              <ParticipantBadge participant={p} />
            </PersonRow>
          ))}
        </ul>
      </section>

      {view.isCreator && open ? (
        <LockPanel view={view} pending={pending} onLock={(optionId, attendeeIds) => run(() => lockParticipantsAction(view.id, { optionId, attendeeIds }), t("locked", { count: attendeeIds.length }))} />
      ) : null}

      {!finished ? (
        <div className="flex flex-col gap-stack">
          {canVote && view.myStatus !== "declined" ? (
            <Button type="button" variant="destructive" size="cta-sm" disabled={pending} onClick={() => setDialog("decline")}>
              <XCircle aria-hidden />
              {t("decline")}
            </Button>
          ) : null}
          {view.myStatus === "accepted" && locked && canWithdraw(view.status) ? (
            <Button type="button" variant="destructive" size="cta-sm" disabled={pending} onClick={() => setDialog("withdraw")}>
              <LogOut aria-hidden />
              {t("withdraw")}
            </Button>
          ) : null}
          {view.isCreator ? (
            <Button type="button" variant="destructive" size="cta-sm" disabled={pending} onClick={() => setDialog("cancel")}>
              <Ban aria-hidden />
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <ReasonDialog
        open={dialog === "decline"}
        onOpenChange={(next) => !next && setDialog(null)}
        title={t("declineTitle")}
        description={t("declineDescription")}
        reasonLabel={t("reasonLabel")}
        reasonPlaceholder={t("reasonPlaceholder")}
        cancelLabel={t("back")}
        confirmLabel={t("declineConfirm")}
        pending={pending}
        icon={<XCircle aria-hidden />}
        onConfirm={(reason) => run(() => declineInvitationAction(view.id, reason || undefined), t("declined"))}
      />
      <ReasonDialog
        open={dialog === "withdraw"}
        onOpenChange={(next) => !next && setDialog(null)}
        title={t("withdrawTitle")}
        description={t("withdrawDescription")}
        cancelLabel={t("back")}
        confirmLabel={t("withdrawConfirm")}
        pending={pending}
        icon={<LogOut aria-hidden />}
        onConfirm={() => run(() => withdrawAction(view.id), t("withdrew"))}
      />
      <ReasonDialog
        open={dialog === "cancel"}
        onOpenChange={(next) => !next && setDialog(null)}
        title={t("cancelTitle")}
        description={t("cancelDescription")}
        reasonLabel={t("reasonLabel")}
        reasonPlaceholder={t("cancelReasonPlaceholder")}
        cancelLabel={t("back")}
        confirmLabel={t("cancelConfirm")}
        pending={pending}
        icon={<Ban aria-hidden />}
        onConfirm={(reason) => run(() => cancelAppointmentAction(view.id, reason || undefined), t("cancelledToast"))}
      />
    </div>
  );
}

function ParticipantBadge({ participant }: { participant: ParticipantView }) {
  const t = useTranslations("appointments.detail.participant");
  const key = participant.status === "invited" && participant.overdue ? "overdue" : participant.status;
  return (
    <Badge variant={participant.status === "accepted" ? "default" : "secondary"} className="h-auto py-hair type-tag">
      {t(key)}
    </Badge>
  );
}

interface PollProps {
  view: AppointmentView;
  canVote: boolean;
  pending: boolean;
  nameOf: Map<string, string>;
  when: (iso: string) => string;
  onVote: (option: OptionView, vote: "yes" | "no" | null) => void;
  onPropose: (iso: string) => void;
}

/** The candidate times with how people voted; a person who may still answer gets Yes and No on each, and can suggest another time. */
function PollSection({ view, canVote, pending, nameOf, when, onVote, onPropose }: PollProps) {
  const t = useTranslations("appointments.detail");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");

  function propose() {
    const iso = vietnamToIso(date, time);
    if (!iso || new Date(iso).getTime() <= Date.now()) {
      setError(t("proposeInvalid"));
      return;
    }
    setError("");
    onPropose(iso);
    setDate("");
    setTime("");
  }

  return (
    <section aria-labelledby="appt-poll" className="flex flex-col gap-item">
      <h2 id="appt-poll" className="type-heading">
        {t("times")}
      </h2>
      <ul className="flex flex-col gap-stack">
        {view.options.map((option) => {
          const yes = option.votes.filter((v) => v.vote === "yes");
          const no = option.votes.filter((v) => v.vote === "no");
          return (
            <li key={option.id} className="flex flex-col gap-stack rounded-xl border bg-card p-inset-sm">
              <div className="flex flex-col gap-tight">
                <span className="type-item-title tabular-nums">{when(option.startAt)}</span>
                {option.place ? <span className="break-words type-secondary text-muted-foreground">{option.place}</span> : null}
                {option.proposedBy ? <span className="type-secondary text-muted-foreground">{t("proposedBy", { name: option.proposedBy.name })}</span> : null}
              </div>
              <p className="type-secondary text-muted-foreground">
                {t("tally", { yes: yes.length, no: no.length })}
                {yes.length > 0 ? ` · ${yes.map((v) => nameOf.get(v.userId) ?? view.creator.name).join(", ")}` : ""}
              </p>
              {canVote ? (
                <div role="group" aria-label={t("yourVote")} className="flex gap-stack">
                  <Chip selected={option.myVote === "yes"} disabled={pending} onClick={() => onVote(option, option.myVote === "yes" ? null : "yes")}>
                    <ThumbsUp className="size-icon-sm" aria-hidden />
                    {t("yes")}
                  </Chip>
                  <Chip selected={option.myVote === "no"} disabled={pending} onClick={() => onVote(option, option.myVote === "no" ? null : "no")}>
                    <ThumbsDown className="size-icon-sm" aria-hidden />
                    {t("no")}
                  </Chip>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canVote ? (
        <div className="flex flex-col gap-stack">
          <span className="type-label text-muted-foreground">
            <CalendarClock className="mr-stack inline size-icon-sm align-text-bottom" aria-hidden />
            {t("proposeLabel")}
          </span>
          <div className="flex gap-stack">
            <Input type="date" aria-label={t("proposeDate")} value={date} onChange={(e) => setDate(e.target.value)} className={cn(CONTROL, "min-w-0 flex-1 text-left [&::-webkit-date-and-time-value]:text-left")} />
            <Input type="time" aria-label={t("proposeTime")} value={time} onChange={(e) => setTime(e.target.value)} className={cn(CONTROL, "w-auto text-left [&::-webkit-date-and-time-value]:text-left")} />
            <Button type="button" variant="outline" size="icon" disabled={pending} aria-label={t("proposeButton")} onClick={propose}>
              {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Plus aria-hidden />}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="type-secondary text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Creator only: choose the time, then the final people (starts as the ones who said yes to it), then lock. */
function LockPanel({ view, pending, onLock }: { view: AppointmentView; pending: boolean; onLock: (optionId: string, attendeeIds: string[]) => void }) {
  const t = useTranslations("appointments.detail");
  const locale = useLocale();
  const [optionId, setOptionId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const eligible = view.participants.filter((p) => p.status === "invited" || p.status === "accepted");

  const option = view.options.find((o) => o.id === optionId);
  const attendees = picked ?? (option ? yesVoterIds(option.votes).filter((id) => eligible.some((p) => p.id === id)) : []);

  function chooseOption(id: string) {
    setOptionId(id);
    setPicked(null); // each time starts from the people who said yes to it
  }
  const toggle = (id: string) => setPicked(attendees.includes(id) ? attendees.filter((a) => a !== id) : [...attendees, id]);

  return (
    <section aria-labelledby="appt-lock" className="flex flex-col gap-item">
      <h2 id="appt-lock" className="type-heading">
        {t("lockTitle")}
      </h2>
      <div role="radiogroup" aria-label={t("lockPickTime")} className="flex flex-wrap gap-stack">
        {view.options.map((o) => (
          <Chip key={o.id} role="radio" selected={optionId === o.id} onClick={() => chooseOption(o.id)}>
            {formatDayLong(o.startAt, locale)} · {formatTime(o.startAt, locale)}
          </Chip>
        ))}
      </div>
      {option ? (
        <>
          <span id="appt-lock-people" className="type-label text-muted-foreground">
            {t("lockPickPeople")}
          </span>
          {eligible.length === 0 ? (
            <p className="type-secondary text-muted-foreground">{t("lockNobody")}</p>
          ) : (
            <div role="group" aria-labelledby="appt-lock-people" className="flex flex-wrap gap-stack">
              {eligible.map((p) => (
                <Chip key={p.id} selected={attendees.includes(p.id)} onClick={() => toggle(p.id)}>
                  {p.name}
                </Chip>
              ))}
            </div>
          )}
          <Button type="button" size="cta" disabled={pending || attendees.length === 0} onClick={() => onLock(option.id, attendees)}>
            {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <UserLock aria-hidden />}
            {t("lockButton", { count: attendees.length })}
          </Button>
        </>
      ) : null}
    </section>
  );
}

