"use client";

import { StarIcon as StarFilledIcon } from "@solar-icons/react/bold";
import { BoxIcon, ForbiddenCircleIcon, LoaderIcon, StarIcon, TrashBinMinimalisticIcon } from "@solar-icons/react/line-duotone";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { LoadingState } from "@/components/loading-state";
import { SeatMap, type SeatMapSeatType } from "@/components/seat-map/seat-map";
import { SittingHistorySummary } from "@/components/sitting-history-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildRoomScene, type SceneSeatType } from "@/lib/seat-layout/scene";
import { cn } from "@/lib/utils";
import { SEAT_MARK_TAGS, type SeatMarkKind, type SeatMarkTag } from "@/models/seat-mark-constants";
import type { LayoutSeat } from "@/lib/seat-layout/types";
import type { RoomView } from "@/services/cinema.service";
import type { SeatMarkView } from "@/services/seat-mark.service";
import type { SittingHistoryRow } from "@/services/viewing-history.service";
import type { MarkActionResult } from "@/app/(user)/cinemas/actions";

const Room3DView = dynamic(() => import("@/components/seat-map/room-3d-view").then((m) => m.Room3DView), {
  ssr: false,
  loading: () => (
    <div className="relative flex aspect-[4/3] w-full items-center justify-center rounded-xl border bg-card">
      <LoadingState compact className="h-full min-h-0" />
    </div>
  ),
});

interface Props {
  view: RoomView;
  marks: { active: SeatMarkView[]; old: SeatMarkView[] };
  sitting?: SittingHistoryRow[];
  saveAction: (input: unknown) => Promise<MarkActionResult>;
  removeAction: (auditoriumId: string, seatCode: string) => Promise<MarkActionResult>;
}

type Marks = { active: SeatMarkView[]; old: SeatMarkView[] };
type Change = { type: "save"; mark: SeatMarkView } | { type: "remove"; seatCode: string };

function applyChange(current: Marks, change: Change): Marks {
  const without = (list: SeatMarkView[], code: string) => list.filter((m) => m.seatCode !== code);
  if (change.type === "remove") return { active: without(current.active, change.seatCode), old: without(current.old, change.seatCode) };
  return { active: [...without(current.active, change.mark.seatCode), change.mark], old: without(current.old, change.mark.seatCode) };
}

/**
 * Read-only seat map of a room with two layers (the system's seat score, and my own marks) and an inline panel to mark a seat.
 * The panel is a section of the page, not a sheet: a note field inside a bottom sheet fights the keyboard on an installed iPhone app.
 */
export function RoomSeatView({ view, marks: serverMarks, sitting = [], saveAction, removeAction }: Props) {
  const t = useTranslations("cinemas.room");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const [heat, setHeat] = useState(true);
  const [showMine, setShowMine] = useState(true);
  const [view3d, setView3d] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [marks, change] = useOptimistic(serverMarks, applyChange);
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const mapTypes = useMemo<SeatMapSeatType[]>(() => view.seatTypes.map(({ id, name, nameEn, color }) => ({ id, name: locale === "en" && nameEn ? nameEn : name, color })), [view.seatTypes, locale]);
  const sceneTypes = useMemo<SceneSeatType[]>(() => view.seatTypes.map(({ id, color, style }) => ({ id, color, style })), [view.seatTypes]);
  const needScene = selected !== null || view3d;
  const metricsScene = useMemo(
    () => (needScene ? buildRoomScene(view.seats, view.geometry, view.room3d, sceneTypes) : null),
    [needScene, view.seats, view.geometry, view.room3d, sceneTypes],
  );
  const seatByCode = useMemo(() => new Map(view.seats.map((s) => [s.code, s])), [view.seats]);
  const markByCode = useMemo(() => new Map(marks.active.map((m) => [m.seatCode, m])), [marks.active]);
  const sittingByCode = useMemo(() => new Map(sitting.map((row) => [row.seatCode, row])), [sitting]);
  const mapMarks = useMemo(() => (showMine ? new Map(marks.active.map((m) => [m.seatCode, m.kind])) : undefined), [marks.active, showMine]);
  const seat = selected ? seatByCode.get(selected) : undefined;
  const seatMetrics = seat && metricsScene ? metricsScene.viewMetricsOf(seat.code, 170) : null;
  const selectedSet = useMemo(() => (selected ? new Set([selected]) : undefined), [selected]);

  // Bring the panel into view after a seat is tapped in 2D (skip in 3D so stepping seats never yanks the 3D viewport off screen).
  useEffect(() => {
    if (selected && !view3d) panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, view3d]);

  function save(mark: SeatMarkView) {
    setShowMine(true);
    startTransition(async () => {
      change({ type: "save", mark });
      const result = await saveAction({ auditoriumId: view.auditorium.id, layoutId: view.layoutId, seatCode: mark.seatCode, kind: mark.kind, tags: mark.tags, note: mark.note || undefined }).catch(() => null);
      if (result?.ok) toast.success(t("saved"));
      else toast.error(t("saveFailed"));
    });
  }

  function remove(seatCode: string) {
    startTransition(async () => {
      change({ type: "remove", seatCode });
      const result = await removeAction(view.auditorium.id, seatCode).catch(() => null);
      if (result?.ok) toast.success(t("removed"));
      else toast.error(t("saveFailed"));
    });
  }

  return (
    <div className="flex flex-col gap-group">
      <SittingHistorySummary rows={sitting} selected={selected} onSelect={(code) => setSelected(code)} />

      <div className="flex flex-wrap items-center justify-between gap-stack">
        <div role="radiogroup" aria-label={t("viewLabel")} className="inline-grid grid-cols-2 rounded-full bg-muted p-tight">
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
            {t("view2d")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view3d}
            onClick={() => setView3d(true)}
            className={cn(
              "flex min-h-target items-center justify-center rounded-full px-inset-sm type-label whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              view3d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("view3d")}
          </button>
        </div>

        <div role="group" aria-label={t("layers")} className="flex flex-wrap gap-stack">
          <Chip
            selected={heat}
            onClick={() => setHeat((v) => !v)}
            className={heat ? "border-transparent bg-accent text-accent-foreground" : undefined}
          >
            {t("layerScore")}
          </Chip>
          {marks.active.length > 0 ? (
            <Chip
              selected={showMine}
              onClick={() => setShowMine((v) => !v)}
              className={showMine ? "border-transparent bg-accent text-accent-foreground" : undefined}
            >
              {showMine ? <StarFilledIcon className="size-icon-sm shrink-0" aria-hidden /> : <StarIcon className="size-icon-sm shrink-0" aria-hidden />}
              <span className="tabular-nums">
                {t("layerMine")} ({marks.active.length})
              </span>
            </Chip>
          ) : null}
        </div>
      </div>

      {view3d ? (
        <Room3DView
          layoutKey={view.layoutId}
          prebuiltScene={metricsScene ?? undefined}
          seats={view.seats}
          geometry={view.geometry}
          roomConfig={view.room3d}
          seatTypes={sceneTypes}
          marks={mapMarks}
          showHeightControls
          heat={heat}
          selected={selected}
          onSelect={setSelected}
          onSwitch2D={() => setView3d(false)}
        />
      ) : (
        <SeatMap
          geometry={view.geometry}
          seats={view.seats}
          seatTypes={mapTypes}
          showHeatmap={heat}
          marks={mapMarks}
          selectedCodes={selectedSet}
          onSeatTap={(s) => setSelected((current) => (current === s.code ? null : s.code))}
          maxHeight="55dvh"
        />
      )}

      <div ref={panelRef} className="scroll-mb-[var(--nav-clearance)]">
        {seat ? (
          <SeatPanel
            key={seat.code}
            seat={seat}
            typeName={mapTypes.find((type) => type.id === seat.type)?.name ?? ""}
            metrics={seatMetrics}
            pastVisit={sittingByCode.get(seat.code)}
            existing={markByCode.get(seat.code)}
            pending={isPending}
            view3d={view3d}
            onOpen3D={() => setView3d(true)}
            onSave={save}
            onRemove={() => remove(seat.code)}
            onClose={() => setSelected(null)}
          />
        ) : (
          <p className="type-secondary text-muted-foreground">{t("tapSeat")}</p>
        )}
      </div>

      {marks.old.length > 0 ? (
        <section aria-label={t("oldMarks")} className="flex flex-col gap-stack">
          <h2 className="type-heading">{t("oldMarks")}</h2>
          <p className="type-secondary text-muted-foreground">{t("oldMarksDescription")}</p>
          <ul className="flex flex-col gap-stack">
            {marks.old.map((mark) => (
              <li key={mark.seatCode} className="flex min-w-0 items-center rounded-xl border bg-card pr-inset-xs">
                <div className="flex min-h-row min-w-0 flex-1 flex-col justify-center gap-tight py-inset-sm pl-inset">
                  <span className="flex items-center gap-stack type-item-title">
                    {mark.kind === "favorite" ? <StarFilledIcon className="size-icon-sm text-seat-favorite" aria-hidden /> : <ForbiddenCircleIcon className="size-icon-sm text-destructive" aria-hidden />}
                    {mark.seatCode}
                    <span className="type-secondary text-muted-foreground">{t(mark.kind === "favorite" ? "favorite" : "avoid")}</span>
                  </span>
                  {mark.note ? <span className="break-words type-secondary text-muted-foreground">{mark.note}</span> : null}
                </div>
                <Button type="button" variant="ghost" size="icon" disabled={isPending} onClick={() => remove(mark.seatCode)} aria-label={`${tc("delete")}: ${mark.seatCode}`} className="size-target shrink-0 text-muted-foreground">
                  <TrashBinMinimalisticIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

interface PanelProps {
  seat: LayoutSeat;
  typeName: string;
  metrics: { distanceM: number; horizontalDeg: number; verticalTopDeg: number; neckStrain: boolean } | null;
  pastVisit?: SittingHistoryRow;
  existing?: SeatMarkView;
  pending: boolean;
  view3d: boolean;
  onOpen3D: () => void;
  onSave: (mark: SeatMarkView) => void;
  onRemove: () => void;
  onClose: () => void;
}

function SeatPanel({ seat, typeName, metrics, pastVisit, existing, pending, view3d, onOpen3D, onSave, onRemove, onClose }: PanelProps) {
  const t = useTranslations("cinemas.room");
  const td = useTranslations("confirmDialog");
  const [kind, setKind] = useState<SeatMarkKind | null>(existing?.kind ?? null);
  const [tags, setTags] = useState<SeatMarkTag[]>(existing?.tags ?? []);
  const [note, setNote] = useState(existing?.note ?? "");
  // Shown after the person taps Save without choosing Like or Avoid; a mark needs one of them.
  const [kindMissing, setKindMissing] = useState(false);
  const chooseKind = (next: SeatMarkKind) => {
    setKind(next);
    setKindMissing(false);
  };
  const flags = seat.flags.map((flag) => t(`flags.${flag}`));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!kind) {
      setKindMissing(true);
      return;
    }
    onSave({ seatCode: seat.code, kind, tags, note: note.trim() });
  }

  function handleRemove() {
    setKind(null);
    setTags([]);
    setNote("");
    setKindMissing(false);
    onRemove();
  }

  return (
    <form onSubmit={handleSubmit} aria-label={t("seatTitle", { code: seat.code })} className="flex flex-col gap-group rounded-xl border bg-card p-inset">
      <div className="flex items-start justify-between gap-stack">
        <div className="flex min-w-0 flex-col gap-tight">
          <h2 className="type-heading">{t("seatTitle", { code: seat.code })}</h2>
          <p className="type-secondary text-muted-foreground tabular-nums">
            {[typeName, `${t("score", { score: seat.score })}/100`, ...flags].filter(Boolean).join(" · ")}
          </p>
          {metrics ? (
            <p className="type-caption text-muted-foreground tabular-nums">
              {t("viewMetrics", {
                distance: metrics.distanceM.toFixed(1),
                horizontal: Math.round(metrics.horizontalDeg),
                vertical: Math.max(0, Math.round(metrics.verticalTopDeg)),
              })}
            </p>
          ) : null}
          {pastVisit ? (
            <p className="inline-flex flex-wrap items-center gap-tight type-caption text-primary-text tabular-nums">
              <span>{t("sittingHistory.seatVisits", { count: pastVisit.count })}</span>
              {pastVisit.rating ? (
                <span className="inline-flex items-center gap-hair">
                  · {pastVisit.rating}/5
                  <StarFilledIcon className="size-icon-xs text-seat-favorite" aria-hidden />
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-stack">
          {!view3d ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpen3D} className="rounded-full">
              <BoxIcon className="size-icon-sm" aria-hidden />
              {t("view3d")}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-target shrink-0">
            {t("close")}
          </Button>
        </div>
      </div>

      <div role="radiogroup" aria-label={t("kindLabel")} className="flex gap-stack">
        <Chip role="radio" selected={kind === "favorite"} disabled={pending} onClick={() => chooseKind("favorite")} className={cn("min-w-0 flex-1 px-inset-xs", kindMissing && "border-destructive")}>
          {kind === "favorite" ? <StarFilledIcon className="size-icon-sm shrink-0" aria-hidden /> : <StarIcon className="size-icon-sm shrink-0" aria-hidden />}
          <span className="truncate">{t("favorite")}</span>
        </Chip>
        <Chip role="radio" selected={kind === "avoid"} disabled={pending} onClick={() => chooseKind("avoid")} className={cn("min-w-0 flex-1 px-inset-xs", kindMissing && "border-destructive")}>
          <ForbiddenCircleIcon className="size-icon-sm shrink-0" aria-hidden />
          <span className="truncate">{t("avoid")}</span>
        </Chip>
      </div>

      {kindMissing ? (
        <p role="alert" className="-mt-stack type-secondary text-destructive">
          {t("kindRequired")}
        </p>
      ) : null}

      <div role="group" aria-label={t("tagsLabel")} className="flex flex-wrap gap-stack">
        {SEAT_MARK_TAGS.map((tag) => (
          <Chip key={tag} selected={tags.includes(tag)} disabled={pending} onClick={() => setTags((c) => (c.includes(tag) ? c.filter((x) => x !== tag) : [...c, tag]))}>
            <span className="truncate">{t(`tags.${tag}`)}</span>
          </Chip>
        ))}
      </div>

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        disabled={pending}
        placeholder={t("notePlaceholder")}
        aria-label={t("noteLabel")}
        autoComplete="off"
        enterKeyHint="done"
        className="h-control rounded-xl bg-background px-inset type-body"
      />

      <div className="flex flex-col gap-stack sm:flex-row-reverse">
        <Button type="submit" size="cta" disabled={pending} className="min-w-0 sm:flex-1">
          {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : null}
          {pending ? td("pending") : t("saveMark")}
        </Button>
        {existing ? (
          <Button type="button" variant="outline" size="cta-sm" disabled={pending} onClick={handleRemove} className="border-destructive/40 text-destructive sm:min-h-control sm:w-auto sm:shrink-0">
            <TrashBinMinimalisticIcon aria-hidden />
            {t("removeMark")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
