"use client";

import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { assignSeatsAction, type ActionResult } from "@/actions/appointments";
import { SeatMap, type SeatMapSeatType } from "@/components/seat-map/seat-map";
import { UserAvatar, getInitials } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { suggestTogether } from "@/lib/appointment/suggest";
import { PX } from "@/lib/ui-sizes";
import { cn } from "@/lib/utils";
import type { LayoutSeat } from "@/lib/seat-layout/types";
import type { AppointmentView } from "@/services/appointment.service";
import type { PlanData } from "@/services/appointment-plan.service";

type Room = NonNullable<PlanData["room"]>;

interface Props {
  view: AppointmentView;
  room: Room;
  /** Runs the write and reports it (toast, busy state) like every other action on the screen. */
  onSave: (action: () => Promise<ActionResult>, done: string) => void;
  busy: boolean;
  /** While the plan is being made nothing is saved: every change goes here instead, and the seats shown start from `initialSeats`. */
  onDraft?: (next: Map<string, string>) => void;
  initialSeats?: Map<string, string>;
}

/**
 * The creator seats everyone: tap a person, then tap a seat (tap again to take them off). While the plan is being made a tap only changes the draft (saved on confirm); after confirming each tap is saved straight
 * away, so a seat somebody else just took is refused on the spot. A couple seat holds two. The map shows the first letters of who sits where.
 */
export function SeatPlanner({ view, room, onSave, busy, onDraft, initialSeats }: Props) {
  const t = useTranslations("appointments.detail.plan");
  const locale = useLocale();
  const [draft, setDraft] = useState(() => initialSeats ?? new Map(view.seats.map((s) => [s.userId, s.seatCode])));
  const firstFree = (map: Map<string, string>) => view.attendees.find((p) => !map.has(p.id))?.id ?? view.attendees[0]?.id ?? "";
  // Seat score colours are on by default: they show which seats are the best ones to give people.
  const [heat, setHeat] = useState(true);
  const [active, setActive] = useState(() => firstFree(draft));

  const seatByCode = useMemo(() => new Map(room.seats.map((s) => [s.code, s])), [room.seats]);
  const taken = useMemo(() => new Set(room.taken), [room.taken]);
  const types = useMemo<SeatMapSeatType[]>(() => room.seatTypes.map(({ id, name, nameEn, color }) => ({ id, name: locale === "en" && nameEn ? nameEn : name, color })), [room.seatTypes, locale]);
  const nameOf = (userId: string) => view.attendees.find((p) => p.id === userId)?.name ?? "?";

  const holderLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const [userId, code] of draft) labels.set(code, [labels.get(code), getInitials(nameOf(userId))].filter(Boolean).join("+"));
    return labels;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, view.attendees]);
  const selectedCodes = useMemo(() => (draft.get(active) ? new Set([draft.get(active)!]) : undefined), [draft, active]);

  function save(next: Map<string, string>, previous: Map<string, string>) {
    setDraft(next);
    if (onDraft) {
      onDraft(next);
      return;
    }
    onSave(
      async () => {
        const result = await assignSeatsAction(view.id, { assignments: [...next].map(([userId, seatCode]) => ({ userId, seatCode })) });
        // Refused (seat just taken, broken...): put the plan back to what the server holds.
        if (!result.ok) setDraft(previous);
        return result;
      },
      t("seatsSaved"),
    );
  }

  function onSeatTap(seat: LayoutSeat) {
    if (busy || !active) return;
    if (taken.has(seat.code) || seat.flags.includes("broken")) {
      toast.error(t(taken.has(seat.code) ? "seatTakenByOthers" : "seatBroken"));
      return;
    }
    const next = new Map(draft);
    if (next.get(active) === seat.code) next.delete(active);
    else {
      const holders = [...next].filter(([userId, code]) => code === seat.code && userId !== active).length;
      if (holders >= seat.span) {
        toast.error(t("seatFull"));
        return;
      }
      next.set(active, seat.code);
    }
    save(next, draft);
    // Move on only while somebody still has no seat; once everyone is seated the choice stays where it is.
    const unseated = view.attendees.find((p) => !next.has(p.id));
    if (next.has(active) && unseated && unseated.id !== active) setActive(unseated.id);
  }

  function suggest() {
    const codes = suggestTogether(room.seats, taken, view.attendees.length);
    if (!codes) {
      toast.error(t("noRunTogether"));
      return;
    }
    const next = new Map<string, string>();
    let index = 0;
    for (const code of codes) {
      for (let place = 0; place < (seatByCode.get(code)?.span ?? 1) && index < view.attendees.length; place++) next.set(view.attendees[index++]!.id, code);
    }
    save(next, draft);
  }

  return (
    <section aria-labelledby="appt-seats" className="flex flex-col gap-item">
      <h2 id="appt-seats" className="type-heading">
        {t("seatsTitle")}
      </h2>
      <div role="group" aria-label={t("whoIsSeated")} className="scroll-strip flex gap-stack pb-tight">
        {view.attendees.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={active === p.id}
            onClick={() => setActive(p.id)}
            className={cn(
              "flex min-h-target shrink-0 items-center gap-stack rounded-full border py-tight pr-inset pl-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active === p.id ? "border-transparent bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            <UserAvatar name={p.name} image={p.avatar} size={PX.avatar} />
            <span className="type-label">{p.name}</span>
            <span className="type-label tabular-nums">{draft.get(p.id) ?? t("noSeat")}</span>
          </button>
        ))}
      </div>
      <SeatMap showHeatmap={heat} geometry={room.geometry} seats={room.seats} seatTypes={types} selectedCodes={selectedCodes} reservedCodes={taken} holderLabels={holderLabels} onSeatTap={onSeatTap} />
      <div className="flex min-h-target items-center justify-between gap-group">
        <Label htmlFor="seat-heat" className="text-muted-foreground">
          {t("layerScore")}
        </Label>
        <Switch id="seat-heat" checked={heat} onCheckedChange={setHeat} />
      </div>
      <Button type="button" variant="outline" size="cta" disabled={busy} onClick={suggest}>
        <Sparkles aria-hidden />
        {t("suggest")}
      </Button>
    </section>
  );
}
