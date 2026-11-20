"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { estimateCosts } from "@/lib/appointment/cost";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { loadPlanRoomAction } from "@/actions/appointments";
import type { AppointmentView } from "@/services/appointment.service";
import type { PlanData } from "@/services/appointment-plan.service";

export interface FoodLine {
  ownerId?: string;
  kind: "item" | "combo";
  refId: string;
  quantity: number;
}

/**
 * What the creator is trying while the plan is being made (showtime, seats, food). None of it is saved until "Confirm plan":
 * it lives here, on the screen, and `payload()` is what the confirm sends in one go.
 */
export function usePlanDraft(view: AppointmentView, plan: PlanData | null) {
  const t = useTranslations("appointments.detail.plan");
  // What the creator explicitly tried on screen (`changeShowtime`). `undefined` means nothing was picked here: the showtime,
  // room and food are then read straight from the server (`view`/`plan`) on every render instead of being copied into state
  // once on mount. This screen mounts as soon as the appointment page opens, well before there is an agreed time or a plan to
  // show (both still null/undefined then); locking the poll on a time that already pointed at a showtime, or beginning
  // planning, can make real values appear later without remounting this component — deriving them fresh each render (rather
  // than an effect copying them into state, which React would run one render too late) is what makes that, and the cost
  // estimate that needs it, appear without a reload.
  const [pickedShowtimeId, setPickedShowtimeId] = useState<string | undefined>(undefined);
  const [pickedRoom, setPickedRoom] = useState<PlanData["room"] | undefined>(undefined);
  const [pickedFood, setPickedFood] = useState<PlanData["food"] | undefined>(undefined);
  const showtimeId = pickedShowtimeId ?? view.showtimeId ?? undefined;
  const room = pickedShowtimeId === undefined ? plan?.room : pickedRoom;
  const food = pickedShowtimeId === undefined ? plan?.food : pickedFood;
  const [seats, setSeats] = useState(() => new Map(view.seats.map((s) => [s.userId, s.seatCode])));
  const [lines, setLines] = useState<FoodLine[]>(() => view.fnb.map((l) => ({ ownerId: l.ownerId ?? undefined, kind: l.kind, refId: l.refId, quantity: l.quantity })));
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);
  // The showtime `pickedRoom`/`pickedFood` actually belong to, once one was explicitly picked. Set only on success, so a
  // failed load leaves this behind `pickedShowtimeId` and picking the very same showtime again is not skipped as "nothing
  // changed" (it would otherwise never retry).
  const loadedFor = useRef<string | undefined>(undefined);

  /** Another showtime: the old seats and food belong to the old room, so they are cleared; the new room is read (nothing is written). */
  const changeShowtime = useCallback(
    async (id: string) => {
      if (id === pickedShowtimeId && id === loadedFor.current) return;
      const call = ++latest.current;
      setPickedShowtimeId(id);
      setSeats(new Map());
      setLines([]);
      setLoading(true);
      const result = await loadPlanRoomAction(view.id, id).catch(() => null);
      if (call !== latest.current) return;
      setLoading(false);
      if (!result || !result.ok) {
        toast.error(t("roomFailed"));
        return;
      }
      loadedFor.current = id;
      setPickedRoom(result.room);
      setPickedFood(result.food);
    },
    [pickedShowtimeId, view.id, t],
  );

  const payload = useCallback(() => {
    const going = new Set(view.attendees.map((p) => p.id));
    return {
      showtimeId: showtimeId && showtimeId !== view.showtimeId ? showtimeId : undefined,
      assignments: [...seats].filter(([userId]) => going.has(userId)).map(([userId, seatCode]) => ({ userId, seatCode })),
      lines: lines.filter((l) => !l.ownerId || going.has(l.ownerId)),
    };
  }, [showtimeId, seats, lines, view.attendees, view.showtimeId]);

  /** What each person pays for what is on the screen right now (ticket and food), worked out here so it follows every tap. */
  const estimate = useMemo(() => {
    const going = view.attendees.map((p) => p.id);
    const holders = new Map<string, string[]>();
    for (const [userId, code] of seats) if (going.includes(userId)) holders.set(code, [...(holders.get(code) ?? []), userId]);
    const unitPrice = (l: FoodLine) => (l.kind === "combo" ? food?.combos : food?.items)?.find((x) => x.id === l.refId)?.price ?? 0;
    const { perUser } = estimateCosts({
      attendeeIds: going,
      seats: [...holders].map(([seatCode, holderIds]) => ({ seatCode, price: room?.prices[seatCode] ?? 0, holderIds })),
      food: lines.map((l) => ({ ownerId: l.ownerId ?? null, unitPrice: unitPrice(l), quantity: l.quantity })),
    });
    return perUser.map((p) => ({ userId: p.userId, ticket: p.ticket, fnb: p.fnb, other: 0 }));
  }, [seats, lines, room, food, view.attendees]);

  return useMemo(() => ({ showtimeId, seats, setSeats, lines, setLines, room, food, loading, changeShowtime, payload, estimate }), [showtimeId, seats, lines, room, food, loading, changeShowtime, payload, estimate]);
}
export type PlanDraft = ReturnType<typeof usePlanDraft>;
