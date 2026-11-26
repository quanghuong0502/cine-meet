"use client";

import { Armchair2Icon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, CloseIcon, CompassIcon, EyeIcon, FullScreenIcon, LightbulbIcon, LightbulbOffIcon, QuitFullScreenIcon, StarsMinimalisticIcon, UsersGroupRoundedIcon, VolumeCrossIcon, VolumeLoudIcon } from "@solar-icons/react/line-duotone";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { LoadingState } from "@/components/loading-state";
import { heatLevel, heatRange } from "@/components/seat-map/heat-color";
import type { Room3D, Room3DMode, SeatMarkKind3D } from "@/components/seat-map/room-3d-scene";
import { Button } from "@/components/ui/button";
import { parseYoutubeId } from "@/lib/movie/youtube";
import { buildRoomScene, type Room3DConfig, type RoomScene, type SceneSeatType, type SeatNeighbourDir } from "@/lib/seat-layout/scene";
import {
  DEFAULT_ROOM_3D_APPEARANCE,
  normalizeRoom3DAppearance,
  type Room3DAppearance,
} from "@/lib/seat-layout/room-3d-appearance.defaults";
import type { LayoutGeometry, LayoutSeat } from "@/lib/seat-layout/types";
import { cn } from "@/lib/utils";

const PerspectiveSeatPicker = dynamic(
  () => import("@/components/seat-map/perspective-seat-picker").then((m) => m.PerspectiveSeatPicker),
  { ssr: false },
);

interface Props {
  /** Optional stable layout identifier from callers like RoomSeatView. */
  layoutKey?: string;
  /** Optional prebuilt 3D scene passed by parents that already compute seat metrics. */
  prebuiltScene?: RoomScene;
  seats: LayoutSeat[];
  geometry: LayoutGeometry;
  roomConfig: Room3DConfig;
  appearance?: Room3DAppearance;
  seatTypes?: SceneSeatType[];
  marks?: Map<string, SeatMarkKind3D>;
  maxHeight?: string;
  /** Show viewer/front-person height controls (user view only; admin previews at standard 170 cm reference). */
  showHeightControls?: boolean;
  heat: boolean;
  selected: string | null;
  onSelect: (code: string | null) => void;
  /** Optional fallback callback shown if WebGL fails to initialize. */
  onSwitch2D?: () => void;
}

const VIEWER_HEIGHTS = [155, 165, 175, 185] as const;
const FRONT_HEIGHTS = [160, 170, 180] as const;
const HEIGHT_STORAGE_KEY = "seatmate:viewerHeightCm";

function formatHeight(cm: number): string {
  const m = Math.floor(cm / 100);
  const rem = String(cm % 100).padStart(2, "0");
  return `${m}m${rem}`;
}

function readSavedViewerHeight(): number {
  if (typeof window === "undefined") return 165;
  try {
    const saved = Number(window.localStorage.getItem(HEIGHT_STORAGE_KEY));
    if (VIEWER_HEIGHTS.includes(saved as (typeof VIEWER_HEIGHTS)[number])) return saved;
  } catch {
    // Ignore storage access restrictions (e.g. private browsing).
  }
  return 165;
}

function qualityKeyOf(level: number): "best" | "great" | "good" | "fair" | "poor" {
  if (level >= 0.85) return "best";
  if (level >= 0.68) return "great";
  if (level >= 0.48) return "good";
  if (level >= 0.28) return "fair";
  return "poor";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Interactive cinema-grade 3D auditorium viewer (lazy-loading vanilla `three` only when mounted).
 * Combines CinemaView's dark-theater HUD, house-lights dimmer, perspective seat picker, and best-seat jump
 * with Codrops SeatPreview's smooth parabolic fly-to-seat camera transitions — while keeping GPU usage
 * strictly on-demand for iPhone standalone PWA stability.
 */
export function Room3DView({
  layoutKey,
  prebuiltScene,
  seats,
  geometry,
  roomConfig,
  appearance = DEFAULT_ROOM_3D_APPEARANCE,
  seatTypes = [],
  marks,
  maxHeight = "52dvh",
  showHeightControls = false,
  heat,
  selected,
  onSelect,
  onSwitch2D,
}: Props) {
  const t = useTranslations("cinemas.room");
  const inlineHostRef = useRef<HTMLDivElement>(null);
  const portalHostRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room3D | null>(null);
  const syncedRef = useRef<{
    heat: boolean;
    selected: string | null;
    activeMode: Room3DMode;
    audience: boolean;
    lightsUp: boolean;
    viewerHeightCm: number;
    frontHeightCm: number;
    marks: Map<string, SeatMarkKind3D> | undefined;
    appearanceKey: string;
    ytMuted: boolean;
  } | null>(null);

  const [mode, setMode] = useState<Room3DMode>("orbit");
  const [lightsUp, setLightsUp] = useState(true);
  const [audience, setAudience] = useState(true);
  const [ytMuted, setYtMuted] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hudExpanded, setHudExpanded] = useState(true);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [viewerHeightCm, setViewerHeightCm] = useState<number>(() => (showHeightControls ? readSavedViewerHeight() : 170));
  const [frontHeightCm, setFrontHeightCm] = useState<number>(170);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const subtitleText = t("sampleSubtitle");

  // Without a selected seat there is nothing to look from, whatever mode was chosen earlier.
  const activeMode: Room3DMode = selected ? mode : "orbit";

  const scene = useMemo(
    () => prebuiltScene ?? buildRoomScene(seats, geometry, roomConfig, seatTypes),
    [prebuiltScene, seats, geometry, roomConfig, seatTypes],
  );
  const range = useMemo(() => heatRange(seats), [seats]);
  const seatByCode = useMemo(() => new Map(seats.map((s) => [s.code, s])), [seats]);

  const enterSeat = useCallback(
    (code: string) => {
      setPickerOpen(false);
      setHoveredCode(null);
      onSelect(code);
      setMode("seat");
      setLightsUp(false);
    },
    [onSelect],
  );

  const enterOverview = useCallback(() => {
    setPickerOpen(false);
    setMode("orbit");
    setLightsUp(true);
  }, []);

  const toggleSeat = useCallback(
    (code: string) => {
      if (activeMode === "seat" && selected === code) {
        onSelect(null);
        enterOverview();
        return;
      }
      enterSeat(code);
    },
    [activeMode, selected, onSelect, enterOverview, enterSeat],
  );

  const toggleBestSeat = useCallback(() => {
    if (!scene.bestSeatCode) return;
    if (activeMode === "seat" && selected === scene.bestSeatCode) {
      onSelect(null);
      enterOverview();
      return;
    }
    enterSeat(scene.bestSeatCode);
  }, [scene.bestSeatCode, activeMode, selected, onSelect, enterOverview, enterSeat]);

  const toggleLights = useCallback(() => {
    setLightsUp((prev) => !prev);
  }, []);

  const stepSeat = useCallback(
    (dir: SeatNeighbourDir) => {
      if (!selected) return;
      const next = scene.neighbourOf(selected, dir);
      if (next) onSelect(next);
    },
    [selected, scene, onSelect],
  );

  const safeAppearance = useMemo(() => normalizeRoom3DAppearance(appearance), [appearance]);
  const appearanceKey = useMemo(() => JSON.stringify(safeAppearance), [safeAppearance]);
  const hasYoutube =
    safeAppearance.screenSource === "youtube" && Boolean(parseYoutubeId(safeAppearance.screenYoutubeUrl));

  const latest = useRef({
    heat,
    selected,
    activeMode,
    audience,
    lightsUp,
    viewerHeightCm,
    frontHeightCm,
    marks,
    subtitleText,
    appearance: safeAppearance,
    ytMuted,
    enterSeat,
  });
  useEffect(() => {
    latest.current = {
      heat,
      selected,
      activeMode,
      audience,
      lightsUp,
      viewerHeightCm,
      frontHeightCm,
      marks,
      subtitleText,
      appearance: safeAppearance,
      ytMuted,
      enterSeat,
    };
  });

  // Lazily load vanilla three.js and build the WebGL scene only when the room layout changes.
  useEffect(() => {
    const target = (expanded ? portalHostRef.current : inlineHostRef.current) ?? inlineHostRef.current;
    if (!target) return;
    let cancelled = false;
    setStatus("loading");
    import("@/components/seat-map/room-3d-scene")
      .then(({ createRoom3D }) => {
        if (cancelled) return;
        const mountTarget = (portalHostRef.current ?? inlineHostRef.current) ?? target;
        const initState = {
          heat: latest.current.heat,
          selected: latest.current.selected,
          activeMode: latest.current.activeMode,
          audience: latest.current.audience,
          lightsUp: latest.current.lightsUp,
          viewerHeightCm: latest.current.viewerHeightCm,
          frontHeightCm: latest.current.frontHeightCm,
          marks: latest.current.marks,
          appearanceKey: JSON.stringify(latest.current.appearance),
          ytMuted: latest.current.ytMuted,
        };
        roomRef.current = createRoom3D(mountTarget, scene, {
          range,
          heat: initState.heat,
          selected: initState.selected,
          initialMode: initState.activeMode,
          audience: initState.audience,
          lightsUp: initState.lightsUp,
          viewerHeightCm: initState.viewerHeightCm,
          frontHeightCm: initState.frontHeightCm,
          marks: initState.marks,
          subtitleText: latest.current.subtitleText,
          appearance: latest.current.appearance,
          youtubeMuted: initState.ytMuted,
          onPick: (code) => latest.current.enterSeat(code),
          onHover: (code) => setHoveredCode(code),
          onFailed: () => setStatus("failed"),
        });
        syncedRef.current = initState;
        setStatus((s) => (s === "failed" ? s : "ready"));
      })
      .catch((err) => {
        console.error("[Room3D] initialization error:", err);
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      syncedRef.current = null;
      roomRef.current?.dispose();
      roomRef.current = null;
    };
    // `expanded` and `appearance` intentionally omitted: fullscreen uses `mountTo` and UI appearance uses in-place `setAppearance`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, scene, range]);

  // Reparent the live WebGL canvas seamlessly between inline box and fullscreen body portal.
  useLayoutEffect(() => {
    const target = expanded ? portalHostRef.current : inlineHostRef.current;
    if (target && roomRef.current) {
      roomRef.current.mountTo(target);
    }
  }, [expanded, status]);

  // Lock page scroll behind fullscreen theater modal.
  useEffect(() => {
    if (!expanded) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [expanded]);

  // Sync only changed interactive props into the existing GPU scene (skips redundant repaints right after init).
  // Order matters: `setSelected` runs before `setMode` so entering seat POV already has the target seat code.
  useEffect(() => {
    const room = roomRef.current;
    const prev = syncedRef.current;
    if (!room || !prev) return;
    if (prev.heat !== heat) {
      prev.heat = heat;
      room.setHeat(heat);
    }
    if (prev.selected !== selected) {
      prev.selected = selected;
      room.setSelected(selected);
    }
    if (prev.activeMode !== activeMode) {
      prev.activeMode = activeMode;
      room.setMode(activeMode);
    }
    if (prev.audience !== audience) {
      prev.audience = audience;
      room.setAudience(audience);
    }
    if (prev.lightsUp !== lightsUp) {
      prev.lightsUp = lightsUp;
      room.setLightsUp(lightsUp);
    }
    if (prev.viewerHeightCm !== viewerHeightCm || prev.frontHeightCm !== frontHeightCm) {
      prev.viewerHeightCm = viewerHeightCm;
      prev.frontHeightCm = frontHeightCm;
      room.setHeights(viewerHeightCm, frontHeightCm);
    }
    if (prev.marks !== marks) {
      prev.marks = marks;
      room.setMarks(marks);
    }
    if (prev.appearanceKey !== appearanceKey) {
      prev.appearanceKey = appearanceKey;
      room.setAppearance(safeAppearance);
    }
    if (prev.ytMuted !== ytMuted) {
      prev.ytMuted = ytMuted;
      room.setYoutubeMuted(ytMuted);
    }
  }, [heat, selected, activeMode, audience, lightsUp, viewerHeightCm, frontHeightCm, marks, safeAppearance, appearanceKey, ytMuted, status]);

  // Keyboard navigation: arrow keys step adjacent seats in POV; Escape closes picker → fullscreen → seat view.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === "Escape") {
        if (pickerOpen) {
          e.preventDefault();
          setPickerOpen(false);
        } else if (expanded) {
          e.preventDefault();
          setExpanded(false);
        } else if (activeMode === "seat") {
          e.preventDefault();
          enterOverview();
        }
        return;
      }
      if (activeMode !== "seat" || pickerOpen || !selected) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        stepSeat("front");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        stepSeat("back");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepSeat("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepSeat("right");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickerOpen, expanded, activeMode, selected, stepSeat, enterOverview]);

  function pickViewerHeight(cm: number) {
    setViewerHeightCm(cm);
    try {
      window.localStorage.setItem(HEIGHT_STORAGE_KEY, String(cm));
    } catch {
      // Ignore storage access restrictions.
    }
  }

  const canFront = Boolean(selected && scene.neighbourOf(selected, "front"));
  const canBack = Boolean(selected && scene.neighbourOf(selected, "back"));
  const canLeft = Boolean(selected && scene.neighbourOf(selected, "left"));
  const canRight = Boolean(selected && scene.neighbourOf(selected, "right"));
  const metrics = activeMode === "seat" && selected ? scene.viewMetricsOf(selected, viewerHeightCm) : null;
  const selectedSeat = selected ? seatByCode.get(selected) : undefined;
  const hoveredSeat = hoveredCode ? seatByCode.get(hoveredCode) : undefined;
  const seatQualityKey =
    selectedSeat !== undefined ? qualityKeyOf(heatLevel(selectedSeat.score, range.min, range.max)) : null;

  const stopCanvasPointer = (e: React.PointerEvent) => e.stopPropagation();

  const renderOverlayUI = (isFullscreen: boolean) => {
    if (status === "failed") return null;

    return (
      <>
        {status === "loading" ? (
          <LoadingState compact className="absolute inset-0 z-30 h-full min-h-0 bg-black/75 p-inset-sm [&_p]:text-white/80" />
        ) : null}

        {/* Top floating translucent Cinema HUD */}
        {!pickerOpen ? (
          <div
            onPointerDown={stopCanvasPointer}
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-stack p-inset-xs",
              isFullscreen &&
                "pt-(--inset-top) pl-[max(var(--spacing-inset),env(safe-area-inset-left))] pr-[max(var(--spacing-inset),env(safe-area-inset-right))]",
            )}
          >
            {/* Left cluster: explicit Close pill in fullscreen + Seat / Overview status pill */}
            <div className="flex min-w-0 items-start gap-stack">
              {isFullscreen ? (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  aria-label={t("collapse3d")}
                  className="pointer-events-auto inline-flex h-target shrink-0 items-center gap-tight rounded-full border border-white/20 bg-black/85 px-inset-sm type-label text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
                >
                  <CloseIcon className="size-icon-sm" aria-hidden />
                  <span>{t("collapse3d")}</span>
                </button>
              ) : null}

              {activeMode === "seat" && selectedSeat ? (
                <button
                  type="button"
                  onClick={() => setHudExpanded((v) => !v)}
                  className="pointer-events-auto flex max-w-full min-w-0 flex-col items-start gap-hair rounded-2xl border border-white/15 bg-black/80 px-inset-sm py-inset-xs text-left text-white transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
                >
                  <span className="flex flex-wrap items-center gap-stack">
                    <span className="type-label text-white tabular-nums">{t("seatBadge", { code: selectedSeat.code })}</span>
                    <span className="rounded-full bg-white/15 px-inset-xs py-hair type-micro text-white tabular-nums">
                      {t("seatScoreShort", { score: Math.round(selectedSeat.score) })}
                      {seatQualityKey ? ` · ${t(`quality.${seatQualityKey}`)}` : ""}
                    </span>
                  </span>
                  {hudExpanded && metrics ? (
                    <span className="flex flex-wrap items-center gap-x-stack gap-y-hair type-micro text-white/75 tabular-nums">
                      <span>
                        {t("viewMetrics", {
                          distance: metrics.distanceM.toFixed(1),
                          horizontal: Math.round(metrics.horizontalDeg),
                          vertical: Math.max(0, Math.round(metrics.verticalTopDeg)),
                        })}
                      </span>
                      {metrics.neckStrain ? <span className="text-amber-400">{t("neckStrainHint")}</span> : null}
                    </span>
                  ) : null}
                  {hudExpanded && isFullscreen ? (
                    <span className="type-micro text-white/50">{t("dragToLookHint")}</span>
                  ) : null}
                </button>
              ) : (
                <div className="pointer-events-none flex min-w-0 items-center gap-stack rounded-full border border-white/15 bg-black/75 px-inset-sm py-inset-xs text-white">
                  <span className="truncate type-tag text-white/90 tabular-nums">
                    {hoveredSeat
                      ? t("hoverSeatHint", { code: hoveredSeat.code, score: Math.round(hoveredSeat.score) })
                      : t("orbit")}
                  </span>
                </div>
              )}
            </div>

            {/* Inline Expand button (in fullscreen, exit lives safely at top-left AND inside the bottom thumb dock) */}
            {!isFullscreen ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label={t("expand3d")}
                title={t("expand3d")}
                className="pointer-events-auto inline-flex size-target shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white/90 transition-colors hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
              >
                <FullScreenIcon className="size-icon" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Bottom floating dark-glass cinema control dock */}
        {!pickerOpen ? (
          <div
            onPointerDown={stopCanvasPointer}
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-stack p-inset-xs",
              isFullscreen &&
                "pb-(--inset-bottom) pl-[max(var(--spacing-inset),env(safe-area-inset-left))] pr-[max(var(--spacing-inset),env(safe-area-inset-right))]",
            )}
          >
            {/* Adjacent-seat stepper inside fullscreen POV */}
            {isFullscreen && activeMode === "seat" && selected ? (
              <div
                role="group"
                aria-label={t("stepSeatLabel")}
                className="pointer-events-auto flex items-center gap-tight rounded-full border border-white/15 bg-black/80 p-tight"
              >
                <DockIconButton
                  label={t("stepFront")}
                  disabled={!canFront}
                  onClick={() => stepSeat("front")}
                >
                  <ArrowUpIcon className="size-icon-sm" aria-hidden />
                </DockIconButton>
                <DockIconButton
                  label={t("stepBack")}
                  disabled={!canBack}
                  onClick={() => stepSeat("back")}
                >
                  <ArrowDownIcon className="size-icon-sm" aria-hidden />
                </DockIconButton>
                <DockIconButton
                  label={t("stepLeft")}
                  disabled={!canLeft}
                  onClick={() => stepSeat("left")}
                >
                  <ArrowLeftIcon className="size-icon-sm" aria-hidden />
                </DockIconButton>
                <DockIconButton
                  label={t("stepRight")}
                  disabled={!canRight}
                  onClick={() => stepSeat("right")}
                >
                  <ArrowRightIcon className="size-icon-sm" aria-hidden />
                </DockIconButton>
              </div>
            ) : null}

            {/* Primary CinemaView-style floating dock */}
            <div
              role="toolbar"
              aria-label={t("viewLabel")}
              className="pointer-events-auto flex max-w-full items-center gap-tight overflow-x-auto overscroll-x-contain rounded-2xl border border-white/15 bg-black/85 p-tight text-white shadow-menu"
            >
              <DockButton
                active={pickerOpen}
                label={t("chooseSeat")}
                showText={isFullscreen}
                onClick={() => setPickerOpen((v) => !v)}
              >
                <Armchair2Icon className="size-icon-sm" aria-hidden />
              </DockButton>

              {scene.bestSeatCode ? (
                <DockButton
                  active={activeMode === "seat" && selected === scene.bestSeatCode}
                  label={t("bestSeat")}
                  showText={isFullscreen}
                  onClick={toggleBestSeat}
                >
                  <StarsMinimalisticIcon className="size-icon-sm" aria-hidden />
                </DockButton>
              ) : null}

              <DockButton
                active={activeMode === "seat"}
                label={activeMode === "seat" ? t("orbit") : (selected ? t("fromSeat", { code: selected }) : t("bestSeat"))}
                showText={isFullscreen}
                onClick={() => {
                  if (activeMode === "seat") enterOverview();
                  else if (selected) enterSeat(selected);
                  else toggleBestSeat();
                }}
              >
                {activeMode === "seat" ? (
                  <CompassIcon className="size-icon-sm" aria-hidden />
                ) : (
                  <EyeIcon className="size-icon-sm" aria-hidden />
                )}
              </DockButton>

              <DockButton
                active={lightsUp}
                label={lightsUp ? t("lightsOff") : t("lightsOn")}
                shortLabel={t("lightsShort")}
                showText={isFullscreen}
                onClick={toggleLights}
              >
                {lightsUp ? (
                  <LightbulbIcon className="size-icon-sm" aria-hidden />
                ) : (
                  <LightbulbOffIcon className="size-icon-sm" aria-hidden />
                )}
              </DockButton>

              {hasYoutube ? (
                <DockButton
                  active={!ytMuted}
                  label={ytMuted ? t("youtubeUnmute") : t("youtubeMute")}
                  shortLabel={t("youtubeAudioShort")}
                  showText={isFullscreen}
                  onClick={() => setYtMuted((v) => !v)}
                >
                  {ytMuted ? (
                    <VolumeCrossIcon className="size-icon-sm" aria-hidden />
                  ) : (
                    <VolumeLoudIcon className="size-icon-sm" aria-hidden />
                  )}
                </DockButton>
              ) : null}

              {activeMode === "seat" ? (
                <DockButton
                  active={audience}
                  label={t("audienceFront")}
                  showText={isFullscreen}
                  onClick={() => setAudience((v) => !v)}
                >
                  <UsersGroupRoundedIcon className="size-icon-sm" aria-hidden />
                </DockButton>
              ) : null}

              {isFullscreen ? (
                <DockButton
                  active={false}
                  label={t("collapse3d")}
                  showText={isFullscreen}
                  onClick={() => setExpanded(false)}
                >
                  <QuitFullScreenIcon className="size-icon-sm" aria-hidden />
                </DockButton>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* 3D-tilted interactive seat picker overlay */}
        {pickerOpen ? (
          <PerspectiveSeatPicker
            seats={seats}
            geometry={geometry}
            seatTypes={seatTypes}
            heat={heat}
            selected={selected}
            bestSeatCode={scene.bestSeatCode}
            marks={marks}
            expanded={isFullscreen}
            onPick={toggleSeat}
            onPickBest={toggleBestSeat}
            onClose={() => setPickerOpen(false)}
          />
        ) : null}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-stack">
      {/* Inline dark cinema stage */}
      <div
        role="region"
        aria-label={t("threeDLabel")}
        style={{ touchAction: "none", aspectRatio: "4 / 3", maxHeight }}
        className="relative w-full overflow-hidden rounded-xl border border-border bg-black select-none"
      >
        <div ref={inlineHostRef} className="absolute inset-0" />
        {!expanded ? renderOverlayUI(false) : null}
      </div>

      {/* Fullscreen Cinema Theater Portal (escapes any `transform-gpu` sticky ancestor cleanly) */}
      {expanded && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("threeDLabel")}
              style={{ touchAction: "none" }}
              className="fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-hidden bg-black select-none"
            >
              <div ref={portalHostRef} className="absolute inset-0" />
              {renderOverlayUI(true)}
            </div>,
            document.body,
          )
        : null}

      {status === "failed" ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-stack">
          <p className="type-secondary text-destructive">{t("threeDFailed")}</p>
          {onSwitch2D ? (
            <Button type="button" variant="outline" size="sm" onClick={onSwitch2D}>
              {t("view2d")}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Compact inline seat-stepping + user-only height controls (kept strictly hidden in Admin when not needed) */}
          {activeMode === "seat" && selected ? (
            <div className="flex flex-col gap-stack">
              <div role="group" aria-label={t("stepSeatLabel")} className="flex flex-wrap items-center gap-stack">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canFront}
                  onClick={() => stepSeat("front")}
                  aria-label={t("stepFront")}
                >
                  <ArrowUpIcon className="size-icon-sm" aria-hidden />
                  {t("stepFront")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canBack}
                  onClick={() => stepSeat("back")}
                  aria-label={t("stepBack")}
                >
                  <ArrowDownIcon className="size-icon-sm" aria-hidden />
                  {t("stepBack")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!canLeft}
                  onClick={() => stepSeat("left")}
                  aria-label={t("stepLeft")}
                >
                  <ArrowLeftIcon className="size-icon-sm" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!canRight}
                  onClick={() => stepSeat("right")}
                  aria-label={t("stepRight")}
                >
                  <ArrowRightIcon className="size-icon-sm" aria-hidden />
                </Button>
              </div>

              {showHeightControls ? (
                <div className="flex flex-wrap items-center gap-x-group gap-y-stack">
                  <div role="group" aria-label={t("myHeightLabel")} className="flex flex-wrap items-center gap-stack">
                    <span className="type-secondary text-muted-foreground">{t("myHeight")}</span>
                    {VIEWER_HEIGHTS.map((cm) => (
                      <Chip
                        key={cm}
                        selected={viewerHeightCm === cm}
                        onClick={() => pickViewerHeight(cm)}
                        className="px-inset-sm tabular-nums"
                      >
                        {formatHeight(cm)}
                      </Chip>
                    ))}
                  </div>

                  {audience ? (
                    <div role="group" aria-label={t("frontHeightLabel")} className="flex flex-wrap items-center gap-stack">
                      <span className="type-secondary text-muted-foreground">{t("frontHeight")}</span>
                      {FRONT_HEIGHTS.map((cm) => (
                        <Chip
                          key={cm}
                          selected={frontHeightCm === cm}
                          onClick={() => setFrontHeightCm(cm)}
                          className="px-inset-sm tabular-nums"
                        >
                          {formatHeight(cm)}
                        </Chip>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

interface DockButtonProps {
  active: boolean;
  label: string;
  shortLabel?: string;
  showText: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function DockButton({ active, label, shortLabel, showText, onClick, children }: DockButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex h-target min-w-target shrink-0 items-center justify-center gap-tight rounded-xl px-inset-xs type-tag whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
        active ? "bg-primary text-primary-foreground" : "text-white/80 hover:bg-white/15 hover:text-white",
      )}
    >
      {children}
      {showText ? <span className="hidden sm:inline">{shortLabel ?? label}</span> : null}
    </button>
  );
}

interface DockIconButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function DockIconButton({ label, disabled, onClick, children }: DockIconButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex size-target shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
