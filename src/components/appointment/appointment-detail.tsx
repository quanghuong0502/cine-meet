"use client";

import { Ban, CheckCheck, CircleCheck, LogOut, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelAppointmentAction,
  completeAppointmentAction,
  confirmPlanAction,
  declineInvitationAction,
  lockParticipantsAction,
  remindVotersAction,
  withdrawAction,
  type ActionResult,
} from "@/actions/appointments";
import { InviteMore } from "@/components/appointment/invite-more";
import { AppointmentStatusBadge } from "@/components/appointment/status-badge";
import { ReasonDialog } from "@/components/appointment/reason-dialog";
import { PollSection } from "@/components/appointment/poll-section";
import { CostSection } from "@/components/appointment/cost-section";
import { usePlanDraft } from "@/components/appointment/use-plan-draft";
import { PlanSection } from "@/components/appointment/plan-section";
import { PersonRow } from "@/components/friends/person-row";
import { ListThumb } from "@/components/list-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFixedBarClearance } from "@/lib/use-fixed-bar-clearance";
import { canWithdraw, isFinished, isOpenForReplies } from "@/lib/appointment/state";
import { formatDayCompact, formatDayLong, formatTime } from "@/lib/datetime";
import type { AppointmentView, ParticipantView } from "@/services/appointment.service";
import type { CostView, PlanData } from "@/services/appointment-plan.service";

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
  /** Showtimes, room and food for the creator while planning or confirmed. */
  plan?: PlanData | null;
  /** What it really cost each person, once the appointment is over. */
  costs?: CostView[];
}

export function AppointmentDetail({ view, friends = [], groups = [], plan = null, costs = [] }: DetailProps) {
  const t = useTranslations("appointments.detail");
  const tc = useTranslations("appointments");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  const draft = usePlanDraft(view, plan);
  // The strip at the end of the page that holds the poll's Save and Decline buttons (drawn into it by `PollSection`).
  const [barSlot, setBarSlot] = useState<HTMLDivElement | null>(null);
  // The buttons are fixed above the menu; the page keeps only as much room at its end as they actually cover (none on a short page).
  const { contentRef, barRef, clear } = useFixedBarClearance();

  const open = isOpenForReplies(view.status);
  // After the answer-by time the server refuses replies, so the controls are not offered at all.
  const canVote = open && view.myStatus !== null && !view.deadlinePassed;
  const finished = isFinished(view.status);
  const locked = view.chosenOptionId !== undefined;
  // Leave / cancel float above the menu (like the poll bar) so they stay in thumb reach while the page scrolls.
  const showWithdraw = view.myStatus === "accepted" && locked && canWithdraw(view.status);
  const canConfirm = view.isCreator && view.status === "PLANNING";
  const canComplete = view.isCreator && view.status === "CONFIRMED" && view.started;
  const chosen = view.options.find((o) => o.id === view.chosenOptionId);

  /** Runs a write, then tells the person what happened (or why not). Network trouble is said out loud. */
  function run(action: () => Promise<ActionResult<{ count?: number }>>, done: string | ((count?: number) => string), after?: () => void) {
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
      toast.success(typeof done === "function" ? done((result as { count?: number }).count) : done);
      after?.();
    });
  }

  const when = (iso: string) => `${formatDayLong(iso, locale)} · ${formatTime(iso, locale)}`;

  return (
    <div ref={contentRef} style={{ paddingBottom: clear }} className="flex flex-col gap-section">
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
        <>
        <section aria-labelledby="appt-time" className="flex flex-col gap-item">
          <h2 id="appt-time" className="type-heading">
            {t("chosenTime")}
          </h2>
          <div className="flex flex-col gap-tight rounded-xl border bg-card p-inset-sm">
            <span className="type-item-title tabular-nums">{when(chosen.startAt)}</span>
            {chosen.place ? <span className="break-words type-secondary text-muted-foreground">{chosen.place}</span> : null}
          </div>
        </section>
        {view.status !== "CANCELLED" && view.myStatus !== "excluded" && view.myStatus !== "dropped" ? <PlanSection view={view} plan={plan} run={run} busy={pending} draft={draft} /> : null}
        {view.status === "COMPLETED" ? <CostSection view={view} costs={costs} onSave={run} busy={pending} /> : null}
        </>
      ) : (
        <PollSection
          // After a save the server's options and votes change, which starts the draft again from what is now saved.
          key={view.options.map((o) => `${o.id}:${o.myVote ?? ""}`).join("|")}
          view={view}
          canVote={canVote}
          when={when}
          busy={pending}
          barSlot={barSlot}
          // The creator locks a time straight from its card (the dialog there asks first and lets them untick people).
          onLock={view.isCreator && open ? (optionId, attendeeIds) => run(() => lockParticipantsAction(view.id, { optionId, attendeeIds }), t("locked", { count: attendeeIds.length })) : undefined}
          onRemind={view.isCreator && open && !view.deadlinePassed ? (optionId) => run(() => remindVotersAction(view.id, optionId), (count) => t("reminded", { count: count ?? 0 })) : undefined}
          // Turning the invitation down sits in the bottom bar beside "Save answers": both are ways to finish answering.
          declineButton={
            canVote && view.myStatus !== "declined" ? (
              <Button type="button" variant="destructive" size="cta" disabled={pending} onClick={() => setDialog("decline")} aria-label={t("decline")} className="pointer-events-auto min-w-0 flex-1">
                <XCircle aria-hidden />
                {t("declineShort")}
              </Button>
            ) : null
          }
        />
      )}

      <section aria-labelledby="appt-people" className="flex flex-col gap-item">
        <h2 id="appt-people" className="type-heading">
          {t("people")}
        </h2>
        <ul className="flex flex-col gap-stack">
          <PersonRow name={view.creator.name} avatar={view.creator.avatar}>
            <Badge variant="secondary">
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

      {/* Fixed above the menu, always. The poll's Save and Decline are drawn into `barSlot` (inside this same box). */}
      <div ref={barRef} data-bottom-fixed className="pointer-events-none fixed inset-x-0 bottom-[var(--nav-clearance)] z-30 px-inset">
        <div className="mx-auto flex max-w-form flex-row gap-stack">
            {!finished && canConfirm ? (
              <Button type="button" size="cta" disabled={pending || draft.loading} onClick={() => run(() => confirmPlanAction(view.id, draft.payload()), t("plan.confirmed"))} className="pointer-events-auto min-w-0 flex-1">
                <CircleCheck aria-hidden />
                {t("plan.confirm")}
              </Button>
            ) : null}
            {!finished && canComplete ? (
              <Button type="button" size="cta" disabled={pending} onClick={() => run(() => completeAppointmentAction(view.id), t("plan.completed"))} className="pointer-events-auto min-w-0 flex-1">
                <CheckCheck aria-hidden />
                {t("plan.complete")}
              </Button>
            ) : null}
            {!finished && showWithdraw ? (
              <Button type="button" variant="destructive" size="cta" disabled={pending} onClick={() => setDialog("withdraw")} className="pointer-events-auto min-w-0 flex-1">
                <LogOut aria-hidden />
                {t("withdraw")}
              </Button>
            ) : null}
            {!finished && view.isCreator ? (
              <Button type="button" variant="destructive" size="cta" disabled={pending} onClick={() => setDialog("cancel")} className="pointer-events-auto min-w-0 flex-1">
                <Ban aria-hidden />
                {t("cancel")}
              </Button>
            ) : null}
          <div ref={setBarSlot} className="contents" />
        </div>
      </div>

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
    <Badge variant={participant.status === "accepted" ? "default" : "secondary"}>
      {t(key)}
    </Badge>
  );
}

