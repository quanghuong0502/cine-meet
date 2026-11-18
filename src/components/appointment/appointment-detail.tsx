"use client";

import { Ban, LoaderCircle, LogOut, UserLock, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelAppointmentAction,
  declineInvitationAction,
  lockParticipantsAction,
  withdrawAction,
  type ActionResult,
} from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { InviteMore } from "@/components/appointment/invite-more";
import { AppointmentStatusBadge } from "@/components/appointment/status-badge";
import { ReasonDialog } from "@/components/appointment/reason-dialog";
import { PollSection } from "@/components/appointment/poll-section";
import { PersonRow } from "@/components/friends/person-row";
import { ListThumb } from "@/components/list-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canWithdraw, isFinished, isOpenForReplies, yesVoterIds } from "@/lib/appointment/state";
import { formatDayCompact, formatDayLong, formatTime } from "@/lib/datetime";
import type { AppointmentView, ParticipantView } from "@/services/appointment.service";

type Dialog = "decline" | "withdraw" | "cancel" | null;

/**
 * The appointment screen. What it shows depends on who is looking and the step:
 * an invited person votes, suggests another time or turns it down; the creator sees the totals, picks one time and the final
 * list (locks it), or cancels; after locking an attendee can still leave. Every write says what happened in a toast.
 */
interface DetailProps {
  view: AppointmentView;
  /** The creator's friends and groups, for "invite more" (empty for everyone else). */
  friends?: { id: string; name: string }[];
  groups?: { id: string; name: string; memberIds: string[] }[];
}

export function AppointmentDetail({ view, friends = [], groups = [] }: DetailProps) {
  const t = useTranslations("appointments.detail");
  const tc = useTranslations("appointments");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);

  const open = isOpenForReplies(view.status);
  // After the answer-by time the server refuses replies, so the controls are not offered at all.
  const canVote = open && view.myStatus !== null && !view.deadlinePassed;
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
        <ListThumb shape="poster" imageUrl={view.movie.posterUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-stack">
          <h2 className="break-words type-heading">{view.movie.title}</h2>
          {/* The creator knows it is theirs (their name is in the list below), so "made by" is only said for other people's plans. */}
          {view.isCreator ? null : <span className="type-secondary text-muted-foreground">{tc("byName", { name: view.creator.name })}</span>}
          <span className="flex flex-wrap items-center gap-x-stack gap-y-tight">
            <AppointmentStatusBadge status={view.status} />
            {view.responseDeadline && open ? (
              <span className="type-secondary text-muted-foreground tabular-nums">
                {t("answerBy", { time: `${formatDayCompact(view.responseDeadline, locale, new Date(), { midSentence: true })} · ${formatTime(view.responseDeadline, locale)}` })}
              </span>
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

      {open && view.myStatus !== null && view.deadlinePassed ? (
        <p role="status" className="rounded-xl border bg-card p-inset-sm type-secondary">
          {t("deadlinePassed")}
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
          // After a save the server's options and votes change, which starts the draft again from what is now saved.
          key={view.options.map((o) => `${o.id}:${o.myVote ?? ""}`).join("|")}
          view={view}
          canVote={canVote}
          nameOf={nameOf}
          when={when}
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

      {view.isCreator && (open || view.status === "DRAFT") && !view.deadlinePassed ? (
        <InviteMore
          appointmentId={view.id}
          candidates={friends.filter((f) => f.id !== view.creator.id && !view.participants.some((p) => p.id === f.id))}
          groups={groups}
        />
      ) : null}

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

/**
 * Creator only: choose the time, then the final people, then lock. Only the people who voted Yes for the chosen time are offered
 * (all of them ticked); the creator can untick some, but cannot add someone who did not say yes to that time.
 */
function LockPanel({ view, pending, onLock }: { view: AppointmentView; pending: boolean; onLock: (optionId: string, attendeeIds: string[]) => void }) {
  const t = useTranslations("appointments.detail");
  const locale = useLocale();
  const [optionId, setOptionId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const option = view.options.find((o) => o.id === optionId);
  // Only people who said yes to this time (and have not turned the invitation down since).
  const yesIds = option ? yesVoterIds(option.votes) : [];
  const voters = view.participants.filter((p) => (p.status === "invited" || p.status === "accepted") && yesIds.includes(p.id));
  const attendees = picked ?? voters.map((p) => p.id);

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
          {voters.length === 0 ? (
            <p className="type-secondary text-muted-foreground">{t("lockNobody")}</p>
          ) : (
            <div role="group" aria-labelledby="appt-lock-people" className="flex flex-wrap gap-stack">
              {voters.map((p) => (
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

