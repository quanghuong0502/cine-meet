"use client";

import { AltArrowDownIcon, AltArrowUpIcon, CupPaperIcon, LoaderIcon, StarsMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { beginPlanningAction, type ActionResult } from "@/actions/appointments";
import { EstimateList } from "@/components/appointment/estimate-list";
import { LazyConfirmDialog } from "@/components/lazy-dialogs";
import { LoadingState } from "@/components/loading-state";
import type { PlanDraft } from "@/components/appointment/use-plan-draft";
import type { ShowtimeChoice } from "@/components/appointment/showtime-picker";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { vietnamDayKey } from "@/lib/datetime";
import { formatVnd } from "@/lib/money";
import { PX } from "@/lib/ui-sizes";
import type { AppointmentView } from "@/services/appointment.service";
import type { PlanData } from "@/services/appointment-plan.service";

const FoodPlanner = dynamic(() => import("@/components/appointment/food-planner").then((m) => m.FoodPlanner), { ssr: false });
const SeatPlanner = dynamic(() => import("@/components/appointment/seat-planner").then((m) => m.SeatPlanner), {
  ssr: false,
  loading: () => <LoadingState compact />,
});
const ShowtimePicker = dynamic(() => import("@/components/appointment/showtime-picker").then((m) => m.ShowtimePicker), { ssr: false });

interface Props {
  view: AppointmentView;
  /** Only the creator, while planning or confirmed, gets this. */
  plan: PlanData | null;
  run: (action: () => Promise<ActionResult>, done: string, after?: () => void) => void;
  busy: boolean;
  /** What the creator is trying while planning; nothing in it is saved until the plan is confirmed. */
  draft: PlanDraft;
}

/**
 * Stage 2 of an appointment. The creator picks the showtime, seats everyone, adds food and confirms (the confirm button floats above the
 * menu, in the parent). Everyone else sees where people sit, what food was ordered and what it costs.
 */
export function PlanSection({ view, plan, run, busy, draft }: Props) {
  const t = useTranslations("appointments.detail.plan");
  const td = useTranslations("confirmDialog");
  const locale = useLocale();
  const [changing, setChanging] = useState(false);
  const [pendingShowtimeId, setPendingShowtimeId] = useState<string | null>(null);
  const [foodOpen, setFoodOpen] = useState(() => draft.lines.length > 0);
  const [estimateOpen, setEstimateOpen] = useState(false);

  const choices = useMemo<ShowtimeChoice[]>(
    () =>
      (plan?.showtimes ?? []).map((s) => ({
        id: s.id,
        startAt: s.startAt,
        endAt: s.endAt,
        branchId: s.branch.id,
        branchName: s.branch.name,
        roomName: s.auditorium.name,
        formatName: s.format.name,
        price: s.price,
        priceMin: s.priceMin,
        priceMax: s.priceMax,
      })),
    [plan?.showtimes],
  );
  const planning = view.status === "PLANNING";
  const showtimeId = planning ? draft.showtimeId : view.showtimeId;
  const current = plan?.showtimes.find((s) => s.id === showtimeId);
  // The chosen showtime may not be in the list (it is not offered earlier than the agreed time), so its place is also read from the chosen time.
  const chosenPlace = view.options.find((o) => o.id === view.chosenOptionId)?.place;

  if (view.status === "PARTICIPANTS_LOCKED") {
    return view.isCreator ? (
      <Button type="button" size="cta" disabled={busy} onClick={() => run(() => beginPlanningAction(view.id), t("begun"))}>
        {busy ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <StarsMinimalisticIcon aria-hidden />}
        {busy ? td("pending") : t("begin")}
      </Button>
    ) : (
      <p role="status" className="rounded-xl border bg-card p-inset-sm type-secondary">
        {t("waitingForCreator")}
      </p>
    );
  }

  if (view.status !== "PLANNING" && view.status !== "CONFIRMED" && view.status !== "COMPLETED") return null;

  const editable = view.isCreator && plan !== null;
  const pickerOpen = editable && (changing || !showtimeId);
  const seatedCount = view.attendees.filter((p) => draft.seats.has(p.id)).length;
  const foodCount = draft.lines.reduce((sum, l) => sum + l.quantity, 0);
  const draftTotal = draft.estimate.reduce((sum, e) => sum + e.ticket + e.fnb, 0);
  const nameOf = (id: string | null) => (id ? view.attendees.find((p) => p.id === id)?.name ?? t("foodShared") : t("foodShared"));

  function handleSelectShowtime(id: string) {
    if (id === showtimeId) {
      setChanging(false);
      return;
    }
    if (draft.seats.size > 0 || draft.lines.length > 0) {
      setPendingShowtimeId(id);
      return;
    }
    setChanging(false);
    void draft.changeShowtime(id);
  }

  return (
    <>
      {editable && planning && showtimeId ? (
        <div className="flex flex-wrap items-center justify-between gap-stack rounded-xl border bg-card px-inset py-inset-sm type-secondary">
          <span className="tabular-nums">
            {t("draftProgress", { seated: seatedCount, total: view.attendees.length, food: foodCount })}
          </span>
          <span className="type-item-title text-primary-text tabular-nums">{formatVnd(draftTotal, locale)}</span>
        </div>
      ) : null}

      {editable && !view.showtimeFixed ? (
        <section aria-labelledby="appt-showtime" className="flex flex-col gap-item">
          <h2 id="appt-showtime" className="type-heading">
            {t("showtimeTitle")}
          </h2>
          {!pickerOpen && (current || chosenPlace) ? (
            <p className="break-words rounded-xl border bg-card p-inset-sm type-secondary">
              {current ? `${current.branch.name} · ${current.auditorium.name} · ${current.format.name}` : chosenPlace}
            </p>
          ) : null}
          {pickerOpen ? (
            <div className="flex flex-col gap-stack">
              <ShowtimePicker
                showtimes={choices}
                selectedIds={showtimeId ? [showtimeId] : []}
                initialDay={current ? vietnamDayKey(current.startAt) : undefined}
                hideDays
                onToggle={handleSelectShowtime}
              />
              {changing && showtimeId ? (
                <Button type="button" variant="ghost" size="cta-sm" onClick={() => setChanging(false)}>
                  {td("cancel")}
                </Button>
              ) : null}
            </div>
          ) : (
            <Button type="button" variant="outline" size="cta-sm" disabled={busy} onClick={() => setChanging(true)}>
              {t("changeShowtime")}
            </Button>
          )}
        </section>
      ) : null}

      {editable && planning && draft.loading ? <LoadingState compact /> : null}
      {editable && planning && !draft.loading && draft.room && draft.food ? (
        <>
          <SeatPlanner key={`draft-seats:${draft.showtimeId}`} view={view} room={draft.room} onSave={run} busy={busy} initialSeats={draft.seats} onDraft={draft.setSeats} />
          <section className="flex flex-col gap-item">
            <button
              type="button"
              onClick={() => setFoodOpen((o) => !o)}
              aria-expanded={foodOpen}
              className="flex min-h-target w-full items-center justify-between gap-stack rounded-xl border bg-card px-inset py-inset-sm text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
            >
              <span className="flex items-center gap-stack">
                <CupPaperIcon className="size-icon text-primary-text" aria-hidden />
                <span className="type-heading">{t("foodTitle")}</span>
                {foodCount > 0 ? <Badge variant="accent" className="tabular-nums">{foodCount}</Badge> : null}
              </span>
              {foodOpen ? <AltArrowUpIcon className="size-icon text-muted-foreground" aria-hidden /> : <AltArrowDownIcon className="size-icon text-muted-foreground" aria-hidden />}
            </button>
            {foodOpen ? (
              <FoodPlanner key={`draft-food:${draft.showtimeId}`} view={view} food={draft.food} onSave={run} busy={busy} initialLines={draft.lines} onDraft={draft.setLines} hideHeading />
            ) : null}
          </section>
        </>
      ) : null}

      {!editable ? (
        <section aria-labelledby="appt-where" className="flex flex-col gap-item">
          <h2 id="appt-where" className="type-heading">
            {t("whereTitle")}
          </h2>
          <ul className="flex flex-col gap-stack">
            {view.attendees.map((p) => {
              const codes = view.seats.filter((s) => s.userId === p.id).map((s) => s.seatCode);
              return (
                <li key={p.id} className="flex items-center gap-item rounded-xl border bg-card p-inset-sm">
                  <UserAvatar name={p.name} image={p.avatar} size={PX.avatar} />
                  <span className="min-w-0 flex-1 break-words type-item-title">{p.name}</span>
                  <span className="shrink-0 type-item-title tabular-nums">{codes.length > 0 ? codes.join(", ") : t("noSeat")}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Ordered food stays visible after confirming/completing so everyone can check what to pick up at the counter. */}
      {!editable && view.fnb.length > 0 ? (
        <section aria-labelledby="appt-ordered-food" className="flex flex-col gap-item">
          <h2 id="appt-ordered-food" className="type-heading">
            {t("foodOrderedTitle")}
          </h2>
          <ul className="flex flex-col gap-stack">
            {view.fnb.map((line, index) => (
              <li key={`${line.ownerId ?? "shared"}-${line.kind}-${line.refId}-${index}`} className="flex items-center justify-between gap-item rounded-xl border bg-card p-inset-sm">
                <div className="flex min-w-0 flex-1 flex-col gap-tight">
                  <span className="break-words type-item-title">
                    {line.name} <span className="text-muted-foreground tabular-nums">×{line.quantity}</span>
                  </span>
                  <span className="type-caption text-muted-foreground">{nameOf(line.ownerId ?? null)}</span>
                </div>
                <span className="shrink-0 type-item-title tabular-nums">{formatVnd(line.unitPrice * line.quantity, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showtimeId ? (
        view.status === "COMPLETED" ? (
          <div className="flex flex-col gap-item">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEstimateOpen((o) => !o)}
              aria-expanded={estimateOpen}
              className="self-start px-inset-xs text-muted-foreground"
            >
              {t("estimateTitleDone")}
              {estimateOpen ? <AltArrowUpIcon className="size-icon-sm" aria-hidden /> : <AltArrowDownIcon className="size-icon-sm" aria-hidden />}
            </Button>
            {estimateOpen ? <EstimateList view={view} title={t("estimateTitleDone")} /> : null}
          </div>
        ) : (
          <EstimateList view={view} estimate={editable && planning ? draft.estimate : undefined} title={t("estimateTitle")} />
        )
      ) : null}

      {pendingShowtimeId !== null ? (
        <LazyConfirmDialog
          open
          onOpenChange={(next) => !next && setPendingShowtimeId(null)}
          title={t("changeShowtimeConfirmTitle")}
          description={t("changeShowtimeConfirmDescription")}
          tone="destructive"
          confirmLabel={t("changeShowtime")}
          onConfirm={() => {
            const target = pendingShowtimeId;
            setPendingShowtimeId(null);
            setChanging(false);
            if (target) void draft.changeShowtime(target);
          }}
        />
      ) : null}
    </>
  );
}
