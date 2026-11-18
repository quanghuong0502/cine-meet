"use client";

import { ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { beginPlanningAction, chooseShowtimeAction, type ActionResult } from "@/actions/appointments";
import { EstimateList } from "@/components/appointment/estimate-list";
import { FoodPlanner } from "@/components/appointment/food-planner";
import { SeatPlanner } from "@/components/appointment/seat-planner";
import { ShowtimePicker, type ShowtimeChoice } from "@/components/appointment/showtime-picker";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { vietnamDayKey } from "@/lib/datetime";
import { PX } from "@/lib/ui-sizes";
import type { AppointmentView } from "@/services/appointment.service";
import type { PlanData } from "@/services/appointment-plan.service";

interface Props {
  view: AppointmentView;
  /** Only the creator, while planning or confirmed, gets this. */
  plan: PlanData | null;
  run: (action: () => Promise<ActionResult>, done: string, after?: () => void) => void;
  busy: boolean;
}

/**
 * Stage 2 of an appointment. The creator picks the showtime, seats everyone, adds food and confirms (the confirm button floats above the
 * menu, in the parent). Everyone else sees where people sit and what it costs. Showtime, seats and food stay editable after confirming.
 */
export function PlanSection({ view, plan, run, busy }: Props) {
  const t = useTranslations("appointments.detail.plan");
  const [changing, setChanging] = useState(false);

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
  const current = plan?.showtimes.find((s) => s.id === view.showtimeId);
  // The chosen showtime may not be in the list (it is not offered earlier than the agreed time), so its place is also read from the chosen time.
  const chosenPlace = view.options.find((o) => o.id === view.chosenOptionId)?.place;

  if (view.status === "PARTICIPANTS_LOCKED") {
    return view.isCreator ? (
      <Button type="button" size="cta" disabled={busy} onClick={() => run(() => beginPlanningAction(view.id), t("begun"))}>
        <ClipboardList aria-hidden />
        {t("begin")}
      </Button>
    ) : (
      <p role="status" className="rounded-xl border bg-card p-inset-sm type-secondary">
        {t("waitingForCreator")}
      </p>
    );
  }

  if (view.status !== "PLANNING" && view.status !== "CONFIRMED" && view.status !== "COMPLETED") return null;

  const editable = view.isCreator && plan !== null;
  const pickerOpen = editable && (changing || !view.showtimeId);

  return (
    <>
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
            <ShowtimePicker
              showtimes={choices}
              selectedIds={view.showtimeId ? [view.showtimeId] : []}
              initialDay={current ? vietnamDayKey(current.startAt) : undefined}
              hideDays
              onToggle={(id) => run(() => chooseShowtimeAction(view.id, id), t("showtimeSaved"), () => setChanging(false))}
            />
          ) : (
            <Button type="button" variant="outline" size="cta" disabled={busy} onClick={() => setChanging(true)}>
              {t("changeShowtime")}
            </Button>
          )}
        </section>
      ) : null}

      {editable && plan.room ? <SeatPlanner key={view.seats.map((s) => `${s.userId}:${s.seatCode}`).join("|")} view={view} room={plan.room} onSave={run} busy={busy} /> : null}
      {editable && plan.room ? <FoodPlanner key={view.fnb.map((l) => `${l.id}`).join("|")} view={view} food={plan.food} onSave={run} busy={busy} /> : null}

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

      {view.showtimeId ? <EstimateList view={view} title={view.status === "COMPLETED" ? t("estimateTitleDone") : t("estimateTitle")} /> : null}
    </>
  );
}
