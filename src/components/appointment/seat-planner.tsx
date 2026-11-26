"use client";

import { StarsMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { assignSeatsAction, type ActionResult } from "@/actions/appointments";
import { SeatMap, type SeatMapSeatType } from "@/components/seat-map/seat-map";
import { PersonChip } from "@/components/appointment/person-chip";
import { getInitials } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { suggestTogether } from "@/lib/appointment/suggest";
import { formatVnd } from "@/lib/money";
import type { LayoutSeat } from "@/lib/seat-layout/types";
import type { AppointmentView } from "@/services/appointment.service";
import type { PlanData } from "@/services/appointment-plan.service";

type Room = NonNullable<PlanData["room"]>;

/** "Suggest seats side by side" is hidden for now (the logic stays); set to true to bring the button back. */
const SHOW_SUGGEST = false;

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

  const chipStripRef = useRef<HTMLDivElement>(null);
  const seatByCode = useMemo(() => new Map(room.seats.map((s) => [s.code, s])), [room.seats]);
  const taken = useMemo(() => new Set(room.taken), [room.taken]);
  const types = useMemo<SeatMapSeatType[]>(() => room.seatTypes.map(({ id, name, nameEn, color }) => ({ id, name: locale === "en" && nameEn ? nameEn : name, color })), [room.seatTypes, locale]);

  // Disambiguate colliding initials (e.g. "Minh Anh" & "Mai An" -> "MA1", "MA2") so seats stay distinguishable on the map.
  const uniqueInitials = useMemo(() => {
    const raw = view.attendees.map((p) => ({ id: p.id, base: getInitials(p.name) }));
    const counts = new Map<string, number>();
    for (const r of raw) counts.set(r.base, (counts.get(r.base) ?? 0) + 1);
    const seen = new Map<string, number>();
    return new Map(
      raw.map((r) => {
        if ((counts.get(r.base) ?? 0) <= 1) return [r.id, r.base];
        const next = (seen.get(r.base) ?? 0) + 1;
        seen.set(r.base, next);
        return [r.id, `${r.base}${next}`];
      }),
    );
  }, [view.attendees]);

  const holderLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const [userId, code] of draft) labels.set(code, [labels.get(code), uniqueInitials.get(userId) ?? "?"].filter(Boolean).join("+"));
    return labels;
  }, [draft, uniqueInitials]);
  const selectedCodes = useMemo(() => (draft.get(active) ? new Set([draft.get(active)!]) : undefined), [draft, active]);

  // Auto-scroll the active attendee's chip into view when seat selection advances to the next unseated person.
  useEffect(() => {
    const el = chipStripRef.current?.querySelector(`[data-person-chip="${active}"]`);
    if (el instanceof HTMLElement) el.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [active]);

  const seatedCount = view.attendees.filter((p) => draft.has(p.id)).length;
  const activeSeatCode = draft.get(active);
  const activeSeat = activeSeatCode ? seatByCode.get(activeSeatCode) : undefined;
  const activeSeatType = activeSeat ? types.find((type) => type.id === activeSeat.type)?.name : undefined;
  const activeSeatPrice = activeSeatCode ? room.prices[activeSeatCode] : undefined;

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
      <div className="flex items-center justify-between gap-stack">
        <h2 id="appt-seats" className="type-heading">
          {t("seatsTitle")}
        </h2>
        <Badge variant={seatedCount === view.attendees.length ? "accent" : "secondary"} className="tabular-nums">
          {seatedCount}/{view.attendees.length}
        </Badge>
      </div>
      <div ref={chipStripRef} role="group" aria-label={t("whoIsSeated")} className="scroll-strip flex gap-stack pb-tight">
        {view.attendees.map((p) => (
          <div key={p.id} data-person-chip={p.id} className="shrink-0">
            <PersonChip person={{ name: p.name, avatar: p.avatar }} selected={active === p.id} onClick={() => setActive(p.id)} trailing={draft.get(p.id) ?? t("noSeat")} />
          </div>
        ))}
      </div>
      <SeatMap showHeatmap={heat} geometry={room.geometry} seats={room.seats} seatTypes={types} selectedCodes={selectedCodes} reservedCodes={taken} holderLabels={holderLabels} onSeatTap={onSeatTap} maxHeight="46dvh" />
      {activeSeatCode ? (
        <p className="type-caption text-muted-foreground tabular-nums">
          {[activeSeatCode, activeSeatType, activeSeatPrice !== undefined ? formatVnd(activeSeatPrice, locale) : null].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <div className="flex min-h-target items-center justify-between gap-group">
        <Label htmlFor="seat-heat" className="text-muted-foreground">
          {t("layerScore")}
        </Label>
        <Switch id="seat-heat" checked={heat} onCheckedChange={setHeat} />
      </div>
      {SHOW_SUGGEST ? (
        <Button type="button" variant="outline" size="cta" disabled={busy} onClick={suggest}>
          <StarsMinimalisticIcon aria-hidden />
          {t("suggest")}
        </Button>
      ) : null}
    </section>
  );
}
