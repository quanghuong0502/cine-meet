"use client";

import { AltArrowDownIcon, AltArrowRightIcon, AltArrowUpIcon, Armchair2Icon, CloseCircleIcon, ConfettiIcon, ForbiddenCircleIcon, GarageIcon, LoaderIcon, Logout2Icon, MapPointIcon, ShareIcon, SquareTopDownIcon, TicketStarIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";
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
import { AppointmentStatusBadge } from "@/components/appointment/status-badge";
import { usePlanDraft } from "@/components/appointment/use-plan-draft";
import { LazyConfirmDialog, LazyReasonDialog } from "@/components/lazy-dialogs";
import { LoadingState } from "@/components/loading-state";
import { PersonRow } from "@/components/friends/person-row";
import { ListThumb } from "@/components/list-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFixedBarClearance } from "@/lib/use-fixed-bar-clearance";
import { canWithdraw, isFinished, isOpenForReplies } from "@/lib/appointment/state";
import { formatDayCompact, formatDayLong, formatTime } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";
import type { TimeSlot } from "@/lib/showtime/slots";
import { PX } from "@/lib/ui-sizes";
import { cn } from "@/lib/utils";
import type { AppointmentView, ParticipantView } from "@/services/appointment.service";
import type { CostView, PlanData } from "@/services/appointment-plan.service";

// Stage-gated sections are lazy-loaded so viewers only download code for the appointment's active lifecycle stage.
const InviteMore = dynamic(() => import("@/components/appointment/invite-more").then((m) => m.InviteMore), { ssr: false });
const PollSection = dynamic(() => import("@/components/appointment/poll-section").then((m) => m.PollSection), { loading: () => <LoadingState compact /> });
const PlanSection = dynamic(() => import("@/components/appointment/plan-section").then((m) => m.PlanSection), { loading: () => <LoadingState compact /> });
const CostSection = dynamic(() => import("@/components/appointment/cost-section").then((m) => m.CostSection), { loading: () => <LoadingState compact /> });
const RatingSection = dynamic(() => import("@/components/appointment/rating-section").then((m) => m.RatingSection), { ssr: false });

type Dialog = "decline" | "withdraw" | "cancel" | "confirm" | "complete" | null;

/**
 * The appointment screen. Constructive primary CTAs float above the menu; destructive actions (Decline, Withdraw, Cancel)
 * sit separated at the bottom of the scroll content to prevent accidental taps and keep 320px/150% layouts clean.
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
  /** This person's own existing ratings, once the appointment is over (design 3.4). */
  initialMovieRating?: number;
  initialSeatRatings?: Record<string, number>;
  /** Admin response deadline lead (minutes) & time slots for invitees proposing options in PollSection. */
  deadlineLeadMinutes?: number;
  timeSlots?: TimeSlot[];
}

export function AppointmentDetail({
  view,
  friends = [],
  groups = [],
  plan = null,
  costs = [],
  initialMovieRating = 0,
  initialSeatRatings = {},
  deadlineLeadMinutes = 60,
  timeSlots = [],
}: DetailProps) {
  const t = useTranslations("appointments.detail");
  const tc = useTranslations("appointments");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [nonGoingOpen, setNonGoingOpen] = useState(false);
  const draft = usePlanDraft(view, plan);
  // The strip at the end of the page that holds the poll's Save button (drawn into it by `PollSection`).
  const [barSlot, setBarSlot] = useState<HTMLDivElement | null>(null);
  // The buttons are fixed above the menu; the page keeps only as much room at its end as they actually cover (none on a short page).
  const { contentRef, barRef, clear } = useFixedBarClearance();

  const open = isOpenForReplies(view.status);
  // After the answer-by time the server refuses replies, so the controls are not offered at all.
  const canVote = open && view.myStatus !== null && !view.deadlinePassed;
  const finished = isFinished(view.status);
  const locked = view.chosenOptionId !== undefined;
  // Server rejects withdrawal once the showtime has started.
  const showWithdraw = view.myStatus === "accepted" && locked && canWithdraw(view.status) && !view.started;
  const showDecline = canVote && view.myStatus !== "declined";
  const canConfirm = view.isCreator && view.status === "PLANNING";
  const canComplete = view.isCreator && view.status === "CONFIRMED" && view.started;
  const chosen = view.options.find((o) => o.id === view.chosenOptionId);
  // Once there is a showtime, the money per person (which already names everyone) takes the place of the plain list of people.
  const costShowtime = view.isCreator && view.status === "PLANNING" ? draft.showtimeId : view.showtimeId;
  const showCosts = locked && !!chosen && !!costShowtime && (view.status === "PLANNING" || view.status === "CONFIRMED" || view.status === "COMPLETED") && view.myStatus !== "excluded" && view.myStatus !== "dropped";
  const nonGoing = view.participants.filter((p) => p.status === "declined" || p.status === "dropped" || p.status === "excluded");
  const hasDestructive = !finished && (showDecline || showWithdraw || view.isCreator);
  const unseated = view.attendees.filter((p) => !draft.seats.has(p.id));
  const draftTotal = draft.estimate.reduce((sum, e) => sum + e.ticket + e.fnb, 0);

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
  const mySeat = view.seats.find((s) => s.userId === view.viewerId)?.seatCode;
  const canSeeCosts = view.isCreator || view.myStatus === "accepted";
  const canShare = (view.status === "INVITING" || view.status === "CONFIRMED") && (view.isCreator || view.myStatus !== "excluded");
  const movieHref = `/movies/${view.movie.id}?back=${encodeURIComponent(`/appointments/${view.id}`)}`;

  async function shareAppointment() {
    const appUrl = typeof window !== "undefined" ? `${window.location.origin}/appointments/${view.id}` : `/appointments/${view.id}`;
    const lines: string[] = [view.movie.title];
    if (view.status === "CONFIRMED" && chosen) {
      lines.push(when(chosen.startAt));
      if (view.venue) {
        lines.push([view.venue.brandName, view.venue.branchName, view.venue.roomName].filter(Boolean).join(" · "));
      } else if (chosen.place) {
        lines.push(chosen.place);
      }
      if (view.seats.length > 0) {
        const nameOf = (uid: string) => view.attendees.find((a) => a.id === uid)?.name ?? "?";
        lines.push(view.seats.map((s) => `${nameOf(s.userId)}: ${s.seatCode}`).join(", "));
      }
      if (view.venue?.mapsUrl) lines.push(view.venue.mapsUrl);
    } else if (view.options.length > 0) {
      for (const opt of view.options) {
        lines.push(`• ${when(opt.startAt)}${opt.place ? ` (${opt.place})` : ""}`);
      }
    }
    const text = lines.join("\n");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: view.movie.title, text, url: appUrl });
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${appUrl}`);
      toast.success(t("shareCopied"));
    } catch {
      toast.error(tc("networkError"));
    }
  }

  return (
    <div ref={contentRef} style={{ paddingBottom: clear }} className="flex flex-col gap-section">
      <section className="flex items-start gap-item">
        <Link
          href={movieHref}
          className="shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80"
        >
          <ListThumb
            shape="poster"
            imageUrl={view.movie.posterUrl}
            sizes={`(min-width: ${PX.sm}px) ${PX.thumbPosterLg}px, ${PX.thumbPoster}px`}
            preload
            className="sm:w-thumb-poster-lg"
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-stack">
          <Link
            href={movieHref}
            className="inline-flex items-center gap-tight rounded-md transition-opacity outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-75"
          >
            <h2 className="min-w-0 break-words type-heading">{view.movie.title}</h2>
            <AltArrowRightIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          {/* The creator knows it is theirs (their name is in the list below), so "made by" is only said for other people's plans. */}
          {view.isCreator ? null : <span className="type-secondary text-muted-foreground">{tc("byName", { name: view.creator.name })}</span>}
          <span className="flex flex-wrap items-center gap-x-stack gap-y-tight">
            <AppointmentStatusBadge status={view.status} />
            {mySeat && locked && view.status !== "CANCELLED" ? (
              <Badge variant="accent" className="tabular-nums">
                <Armchair2Icon aria-hidden />
                {t("mySeat", { seat: mySeat })}
              </Badge>
            ) : null}
            {view.responseDeadline && open ? (
              <span className={cn("type-secondary tabular-nums", view.deadlinePassed ? "text-warning" : "text-muted-foreground")}>
                {t("answerBy", { time: `${formatDayCompact(view.responseDeadline, locale, new Date(), { midSentence: true })} · ${formatTime(view.responseDeadline, locale)}` })}
              </span>
            ) : null}
          </span>
          {/* The agreed time and place, short, right under the status. */}
          {locked && chosen ? (
            <span className="flex flex-col gap-tight">
              <span className="type-item-title tabular-nums">{when(chosen.startAt)}</span>
              {chosen.place ? <span className="break-words type-secondary text-muted-foreground">{chosen.place}</span> : null}
            </span>
          ) : null}
          {canShare ? (
            <div className="pt-hair">
              <Button type="button" variant="outline" size="sm" onClick={() => void shareAppointment()} className="rounded-full">
                <ShareIcon aria-hidden />
                {t("share")}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {locked && view.venue && view.status !== "CANCELLED" && canSeeCosts ? (
        <section aria-label={t("venueTitle")} className="flex flex-col gap-item rounded-xl border bg-card p-inset">
          <div className="flex flex-col gap-tight">
            <span className="type-item-title">
              {[view.venue.brandName, view.venue.branchName].filter(Boolean).join(" · ")}
            </span>
            {view.venue.address ? (
              <span className="flex items-start gap-stack type-secondary text-muted-foreground">
                <MapPointIcon className="mt-hair size-icon-sm shrink-0" aria-hidden />
                <span className="break-words">
                  {view.venue.address}
                  {view.venue.floor ? ` · ${view.venue.floor}` : ""}
                </span>
              </span>
            ) : null}
            {view.venue.parkingFee !== undefined || view.venue.parkingLocation || view.venue.parkingEntrance ? (
              <span className="flex items-start gap-stack type-secondary text-muted-foreground">
                <GarageIcon className="mt-hair size-icon-sm shrink-0" aria-hidden />
                <span className="break-words">
                  {[
                    view.venue.parkingFee !== undefined ? formatVnd(view.venue.parkingFee, locale) : null,
                    view.venue.parkingLocation,
                    view.venue.parkingEntrance,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-stack">
            {view.venue.mapsUrl ? (
              <Button asChild variant="secondary" size="sm" className="rounded-full">
                <a href={view.venue.mapsUrl} target="_blank" rel="noopener noreferrer">
                  <SquareTopDownIcon aria-hidden />
                  {t("directions")}
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link
                href={`/cinemas/${view.venue.branchId}/${view.venue.auditoriumId}?back=${encodeURIComponent(`/appointments/${view.id}`)}`}
                prefetch={false}
              >
                <Armchair2Icon aria-hidden />
                {t("openRoom", { room: view.venue.roomName })}
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {view.status === "CANCELLED" ? (
        <p role="status" className="rounded-xl border border-destructive/40 bg-destructive/10 p-inset-sm type-secondary">
          <ForbiddenCircleIcon className="mr-stack inline size-icon-sm align-text-bottom" aria-hidden />
          {view.cancelReason ? t("cancelledWithReason", { reason: view.cancelReason }) : t("cancelled")}
        </p>
      ) : null}

      {open && view.deadlinePassed && (view.myStatus !== null || view.isCreator) ? (
        <p role="status" className="rounded-xl border border-warning/40 bg-warning/10 p-inset-sm type-secondary">
          {view.isCreator ? t("deadlinePassedCreator") : t("deadlinePassed")}
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
          {view.status !== "CANCELLED" && view.myStatus !== "excluded" && view.myStatus !== "dropped" ? <PlanSection view={view} plan={plan} run={run} busy={pending} draft={draft} /> : null}
          {view.status === "COMPLETED" && canSeeCosts ? <CostSection view={view} costs={costs} onSave={run} busy={pending} /> : null}
          {view.status === "COMPLETED" && view.myStatus !== "excluded" && view.myStatus !== "dropped" ? (
            <RatingSection view={view} initialMovieRating={initialMovieRating} initialSeatRatings={initialSeatRatings} />
          ) : null}
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
          deadlineLeadMinutes={deadlineLeadMinutes}
          timeSlots={timeSlots}
          // The creator locks a time straight from its card (the dialog there asks first and lets them untick people).
          onLock={view.isCreator && open ? (optionId, attendeeIds) => run(() => lockParticipantsAction(view.id, { optionId, attendeeIds }), t("locked", { count: attendeeIds.length + 1 })) : undefined}
          onRemind={view.isCreator && open && !view.deadlinePassed ? (optionId) => run(() => remindVotersAction(view.id, optionId), (count) => t("reminded", { count: count ?? 0 })) : undefined}
        />
      )}

      {showCosts ? (
        nonGoing.length > 0 ? (
          <section className="flex flex-col gap-stack">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setNonGoingOpen((o) => !o)}
              aria-expanded={nonGoingOpen}
              className="self-start px-inset-xs text-muted-foreground"
            >
              {t("notGoingCount", { count: nonGoing.length })}
              {nonGoingOpen ? <AltArrowUpIcon className="size-icon-sm" aria-hidden /> : <AltArrowDownIcon className="size-icon-sm" aria-hidden />}
            </Button>
            {nonGoingOpen ? (
              <ul className="flex flex-col gap-stack">
                {nonGoing.map((p) => (
                  <PersonRow key={p.id} name={p.name} avatar={p.avatar} sub={p.declineReason ?? undefined}>
                    <ParticipantBadge participant={p} />
                  </PersonRow>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null
      ) : (
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
              <PersonRow key={p.id} name={p.name} avatar={p.avatar} sub={p.declineReason ?? undefined}>
                <ParticipantBadge participant={p} />
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      {view.isCreator && (open || view.status === "DRAFT") && !view.deadlinePassed ? (
        <InviteMore
          appointmentId={view.id}
          candidates={friends.filter((f) => f.id !== view.creator.id && !view.participants.some((p) => p.id === f.id))}
          groups={groups}
        />
      ) : null}

      {/* Destructive actions sit safely at the end of scroll content, well separated from constructive primary CTAs. */}
      {hasDestructive ? (
        <div className="flex flex-col gap-stack border-t pt-group">
          {showDecline ? (
            <Button type="button" variant="outline" size="cta-sm" disabled={pending} onClick={() => setDialog("decline")} className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <CloseCircleIcon aria-hidden />
              {t("decline")}
            </Button>
          ) : null}
          {showWithdraw ? (
            <Button type="button" variant="outline" size="cta-sm" disabled={pending} onClick={() => setDialog("withdraw")} className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <Logout2Icon aria-hidden />
              {t("withdraw")}
            </Button>
          ) : null}
          {view.isCreator ? (
            <Button type="button" variant="outline" size="cta-sm" disabled={pending} onClick={() => setDialog("cancel")} className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <ForbiddenCircleIcon aria-hidden />
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Fixed above the menu: strictly ONE constructive primary CTA (Confirm / Complete / Poll Save). */}
      <div ref={barRef} data-bottom-fixed className="pointer-events-none fixed inset-x-0 bottom-[var(--nav-clearance)] z-30 px-inset">
        <div className="mx-auto flex max-w-form flex-row gap-stack">
          {!finished && canConfirm ? (
            <Button
              type="button"
              size="cta"
              disabled={pending || draft.loading}
              onClick={() => {
                if (!draft.showtimeId) {
                  toast.error(tc("errors.needs_showtime"));
                  return;
                }
                if (unseated.length > 0) {
                  toast.error(tc("errors.needs_seat"));
                  return;
                }
                setDialog("confirm");
              }}
              className="pointer-events-auto min-w-0 flex-1 shadow-lg"
            >
              {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <TicketStarIcon aria-hidden />}
              {t("plan.confirm")}
            </Button>
          ) : null}
          {!finished && canComplete ? (
            <Button type="button" size="cta" disabled={pending} onClick={() => setDialog("complete")} className="pointer-events-auto min-w-0 flex-1 shadow-lg">
              {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <ConfettiIcon aria-hidden />}
              {t("plan.complete")}
            </Button>
          ) : null}
          <div ref={setBarSlot} className="contents" />
        </div>
      </div>

      {dialog === "confirm" ? (
        <LazyConfirmDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={t("plan.confirmDialogTitle")}
          description={t("plan.confirmDialogDescription", { count: view.attendees.length, total: formatVnd(draftTotal, locale) })}
          icon={<TicketStarIcon aria-hidden />}
          confirmLabel={t("plan.confirm")}
          pending={pending}
          onConfirm={() => run(() => confirmPlanAction(view.id, draft.payload()), t("plan.confirmed"))}
        />
      ) : null}
      {dialog === "complete" ? (
        <LazyConfirmDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={t("plan.completeDialogTitle")}
          description={t("plan.completeDialogDescription")}
          icon={<ConfettiIcon aria-hidden />}
          confirmLabel={t("plan.complete")}
          pending={pending}
          onConfirm={() => run(() => completeAppointmentAction(view.id), t("plan.completed"))}
        />
      ) : null}
      {dialog === "decline" ? (
        <LazyReasonDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={t("declineTitle")}
          description={t("declineDescription")}
          reasonLabel={t("reasonLabel")}
          reasonPlaceholder={t("reasonPlaceholder")}
          cancelLabel={t("back")}
          confirmLabel={t("declineConfirm")}
          pending={pending}
          icon={<CloseCircleIcon aria-hidden />}
          onConfirm={(reason) => run(() => declineInvitationAction(view.id, reason || undefined), t("declined"))}
        />
      ) : null}
      {dialog === "withdraw" ? (
        <LazyReasonDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={t("withdrawTitle")}
          description={t("withdrawDescription")}
          cancelLabel={t("back")}
          confirmLabel={t("withdrawConfirm")}
          pending={pending}
          icon={<Logout2Icon aria-hidden />}
          onConfirm={() => run(() => withdrawAction(view.id), t("withdrew"))}
        />
      ) : null}
      {dialog === "cancel" ? (
        <LazyReasonDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={t("cancelTitle")}
          description={t("cancelDescription")}
          reasonLabel={t("reasonLabel")}
          reasonPlaceholder={t("cancelReasonPlaceholder")}
          cancelLabel={t("back")}
          confirmLabel={t("cancelConfirm")}
          pending={pending}
          icon={<ForbiddenCircleIcon aria-hidden />}
          onConfirm={(reason) => run(() => cancelAppointmentAction(view.id, reason || undefined), t("cancelledToast"))}
        />
      ) : null}
    </div>
  );
}

function ParticipantBadge({ participant }: { participant: ParticipantView }) {
  const t = useTranslations("appointments.detail.participant");
  const overdue = participant.status === "invited" && participant.overdue;
  const key = participant.allNo ? "allNo" : overdue ? "overdue" : participant.status;
  if (participant.status === "accepted") {
    return <Badge variant="default">{t(key)}</Badge>;
  }
  if (overdue) {
    return (
      <Badge variant="secondary" className="bg-warning/15 text-warning">
        {t(key)}
      </Badge>
    );
  }
  if (participant.status === "declined" || participant.status === "dropped") {
    return <Badge variant="destructive">{t(key)}</Badge>;
  }
  return <Badge variant="secondary">{t(key)}</Badge>;
}

