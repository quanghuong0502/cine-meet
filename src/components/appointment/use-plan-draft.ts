"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
  const [showtimeId, setShowtimeId] = useState<string | undefined>(view.showtimeId ?? undefined);
  const [seats, setSeats] = useState(() => new Map(view.seats.map((s) => [s.userId, s.seatCode])));
  const [lines, setLines] = useState<FoodLine[]>(() => view.fnb.map((l) => ({ ownerId: l.ownerId ?? undefined, kind: l.kind, refId: l.refId, quantity: l.quantity })));
  const [room, setRoom] = useState(plan?.room);
  const [food, setFood] = useState(plan?.food);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  /** Another showtime: the old seats and food belong to the old room, so they are cleared; the new room is read (nothing is written). */
  const changeShowtime = useCallback(
    async (id: string) => {
      if (id === showtimeId) return;
      const call = ++latest.current;
      setShowtimeId(id);
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
      setRoom(result.room);
      setFood(result.food);
    },
    [showtimeId, view.id, t],
  );

  const payload = useCallback(() => {
    const going = new Set(view.attendees.map((p) => p.id));
    return {
      showtimeId: showtimeId && showtimeId !== view.showtimeId ? showtimeId : undefined,
      assignments: [...seats].filter(([userId]) => going.has(userId)).map(([userId, seatCode]) => ({ userId, seatCode })),
      lines: lines.filter((l) => !l.ownerId || going.has(l.ownerId)),
    };
  }, [showtimeId, seats, lines, view.attendees, view.showtimeId]);

  return useMemo(() => ({ showtimeId, seats, setSeats, lines, setLines, room, food, loading, changeShowtime, payload }), [showtimeId, seats, lines, room, food, loading, changeShowtime, payload]);
}
export type PlanDraft = ReturnType<typeof usePlanDraft>;
