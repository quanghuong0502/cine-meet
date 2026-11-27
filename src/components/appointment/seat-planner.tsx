"use client";

import { StarsMinimalisticIcon } from "@solar-icons/react/line-duotone";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { assignSeatsAction, type ActionResult } from "@/actions/appointments";
import { PersonChip } from "@/components/appointment/person-chip";
import { LoadingState } from "@/components/loading-state";
import { preloadRoom3D } from "@/components/seat-map/preload-room-3d";
import { SeatMap, type SeatMapSeatType } from "@/components/seat-map/seat-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getInitials } from "@/components/user-avatar";
import { suggestTogether } from "@/lib/appointment/suggest";
import { formatVnd } from "@/lib/money";
import type { SceneSeatType } from "@/lib/seat-layout/scene";
import type { LayoutSeat } from "@/lib/seat-layout/types";
import { cn } from "@/lib/utils";
import type { AppointmentView } from "@/services/appointment.service";
import type { PlanData } from "@/services/appointment-plan.service";

const Room3DView = dynamic(() => import("@/components/seat-map/room-3d-view").then((m) => m.Room3DView), {
  ssr: false,
  loading: () => (
    <div className="relative flex aspect-[4/3] w-full items-center justify-center rounded-xl border bg-card">
      <LoadingState compact className="h-full min-h-0" />
    </div>
  ),
});

type Room = NonNullable<PlanData["room"]>;

/** "Suggest seats side by side" is hidden for now (the logic stays); set to true to bring the button back. */
const SHOW_SUGGEST = true;

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
 * The creator seats everyone: tap a person, then tap a seat (tap again to take them off) — in either 2D map or live 3D
 * auditorium view (with movie trailer playback and friends' floating seat tags).
 */
export function SeatPlanner({ view, room, onSave, busy, onDraft, initialSeats }: Props) {
  const t = useTranslations("appointments.detail.plan");
  const tr = useTranslations("cinemas.room");
  const locale = useLocale();
  const [draft, setDraft] = useState(() => initialSeats ?? new Map(view.seats.map((s) => [s.userId, s.seatCode])));
  const firstFree = (map: Map<string, string>) => view.attendees.find((p) => !map.has(p.id))?.id ?? view.attendees[0]?.id ?? "";
  // 2D starts with Heatmap on to scan best seats; 3D starts with real auditorium finishes & friends' colors.
  const [heat2d, setHeat2d] = useState(true);
  const [heat3d, setHeat3d] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [active, setActive] = useState(() => firstFree(draft));
  const [inspected3d, setInspected3d] = useState<string | null>(() => draft.get(firstFree(draft)) ?? null);
  const heat = view3d ? heat3d : heat2d;
  const setHeat = (next: boolean) => (view3d ? setHeat3d(next) : setHeat2d(next));

  const chipStripRef = useRef<HTMLDivElement>(null);
  const seatByCode = useMemo(() => new Map(room.seats.map((s) => [s.code, s])), [room.seats]);
  const taken = useMemo(() => new Set(room.taken), [room.taken]);
  const creatorMarks = useMemo(
    () => (room.marks && Object.keys(room.marks).length > 0 ? new Map(Object.entries(room.marks)) : undefined),
    [room.marks],
  );
  const types = useMemo<SeatMapSeatType[]>(
    () => room.seatTypes.map(({ id, name, nameEn, color }) => ({ id, name: locale === "en" && nameEn ? nameEn : name, color })),
    [room.seatTypes, locale],
  );
  const sceneTypes = useMemo<SceneSeatType[]>(
    () => room.seatTypes.map(({ id, color, color3d, style }) => ({ id, color, color3d, style })),
    [room.seatTypes],
  );

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

  const shortNames = useMemo(() => {
    return new Map(
      view.attendees.map((p) => {
        const parts = p.name.trim().split(/\s+/);
        const lastWord = parts[parts.length - 1] ?? p.name;
        return [p.id, lastWord.slice(0, 10)];
      }),
    );
  }, [view.attendees]);

  const holderLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const [userId, code] of draft) labels.set(code, [labels.get(code), uniqueInitials.get(userId) ?? "?"].filter(Boolean).join("+"));
    return labels;
  }, [draft, uniqueInitials]);

  const holderLabels3D = useMemo(() => {
    const labels = new Map<string, string>();
    for (const [userId, code] of draft) labels.set(code, [labels.get(code), shortNames.get(userId) ?? "?"].filter(Boolean).join(" & "));
    return labels;
  }, [draft, shortNames]);

  const selectedCodes = useMemo(() => (draft.get(active) ? new Set([draft.get(active)!]) : undefined), [draft, active]);

  // Auto-scroll the active attendee's chip into view when seat selection advances to the next unseated person.
  useEffect(() => {
    const el = chipStripRef.current?.querySelector(`[data-person-chip="${active}"]`);
    if (el instanceof HTMLElement) el.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [active]);

  const seatedCount = view.attendees.filter((p) => draft.has(p.id)).length;
  const activePerson = view.attendees.find((p) => p.id === active);
  const activeSeatCode = draft.get(active);
  const displayCode = view3d ? (inspected3d ?? activeSeatCode) : activeSeatCode;
  const displaySeat = displayCode ? seatByCode.get(displayCode) : undefined;
  const displaySeatType = displaySeat ? types.find((type) => type.id === displaySeat.type)?.name : undefined;
  const displaySeatPrice = displayCode ? room.prices[displayCode] : undefined;

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

  const inspectedSeatObj = inspected3d ? seatByCode.get(inspected3d) : undefined;
  const inspectedAssignedToActive = Boolean(inspected3d && draft.get(active) === inspected3d);
  const seatAction3D =
    view3d && activePerson && inspectedSeatObj
      ? {
          label: inspectedAssignedToActive
            ? t("unassignSeat3d", { name: shortNames.get(activePerson.id) ?? activePerson.name, code: inspectedSeatObj.code })
            : t("assignSeat3d", { name: shortNames.get(activePerson.id) ?? activePerson.name, code: inspectedSeatObj.code }),
          active: inspectedAssignedToActive,
          disabled: busy || taken.has(inspectedSeatObj.code) || inspectedSeatObj.flags.includes("broken"),
          onAction: (code: string) => {
            const seatObj = seatByCode.get(code);
            if (seatObj) onSeatTap(seatObj);
          },
        }
      : undefined;

  return (
    <section aria-labelledby="appt-seats" className="flex flex-col gap-item">
      <div className="flex flex-wrap items-center justify-between gap-stack">
        <div className="flex items-center gap-stack">
          <h2 id="appt-seats" className="type-heading">
            {t("seatsTitle")}
          </h2>
          <Badge variant={seatedCount === view.attendees.length ? "accent" : "secondary"} className="tabular-nums">
            {seatedCount}/{view.attendees.length}
          </Badge>
        </div>

        <div role="radiogroup" aria-label={tr("viewLabel")} className="inline-grid grid-cols-2 rounded-full bg-muted p-tight">
          <button
            type="button"
            role="radio"
            aria-checked={!view3d}
            onClick={() => setView3d(false)}
            className={cn(
              "flex min-h-target items-center justify-center rounded-full px-inset-sm type-label whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              !view3d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tr("view2d")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view3d}
            onPointerEnter={preloadRoom3D}
            onTouchStart={preloadRoom3D}
            onFocus={preloadRoom3D}
            onClick={() => {
              setInspected3d(draft.get(active) ?? null);
              setView3d(true);
            }}
            className={cn(
              "flex min-h-target items-center justify-center rounded-full px-inset-sm type-label whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              view3d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tr("view3d")}
          </button>
        </div>
      </div>

      <div ref={chipStripRef} role="group" aria-label={t("whoIsSeated")} className="scroll-strip flex gap-stack pb-tight">
        {view.attendees.map((p) => (
          <div key={p.id} data-person-chip={p.id} className="shrink-0">
            <PersonChip
              person={{ name: p.name, avatar: p.avatar }}
              selected={active === p.id}
              onClick={() => {
                setActive(p.id);
                if (view3d && draft.has(p.id)) setInspected3d(draft.get(p.id) ?? null);
              }}
              trailing={draft.get(p.id) ?? t("noSeat")}
            />
          </div>
        ))}
      </div>

      {view3d ? (
        <Room3DView
          layoutKey={room.layoutId}
          seats={room.seats}
          geometry={room.geometry}
          roomConfig={room.room3d}
          appearance={room.room3dAppearance}
          roomMeta={{ roomName: room.roomName, brandName: room.brandName }}
          overrideYoutubeId={view.movie.trailerVideoId ?? null}
          seatTypes={sceneTypes}
          marks={creatorMarks}
          reservedCodes={taken}
          holderLabels={holderLabels3D}
          seatAction={seatAction3D}
          showHeightControls
          heat={heat}
          selected={inspected3d}
          onSelect={setInspected3d}
          onSwitch2D={() => setView3d(false)}
          maxHeight="46dvh"
        />
      ) : (
        <SeatMap
          showHeatmap={heat}
          geometry={room.geometry}
          seats={room.seats}
          seatTypes={types}
          marks={creatorMarks}
          selectedCodes={selectedCodes}
          reservedCodes={taken}
          holderLabels={holderLabels}
          onSeatTap={onSeatTap}
          maxHeight="46dvh"
        />
      )}

      {displayCode ? (
        <p className="type-caption text-muted-foreground tabular-nums">
          {[displayCode, displaySeatType, displaySeatPrice !== undefined ? formatVnd(displaySeatPrice, locale) : null].filter(Boolean).join(" · ")}
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
