"use client";

import {
  Armchair2Icon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CameraIcon,
  ClapperboardPlayIcon,
  CloseIcon,
  CompassIcon,
  EyeIcon,
  EyeScanIcon,
  FullScreenIcon,
  LightbulbIcon,
  LightbulbOffIcon,
  PinIcon,
  QuitFullScreenIcon,
  SmartphoneRotateOrientationIcon,
  StarsMinimalisticIcon,
  TransferHorizontalIcon,
  UsersGroupRoundedIcon,
  VideocameraIcon,
  VolumeCrossIcon,
  VolumeLoudIcon,
} from "@solar-icons/react/line-duotone";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { LoadingState } from "@/components/loading-state";
import { heatLevel, heatRange } from "@/components/seat-map/heat-color";
import type {
  Room3D,
  Room3DCameraPreset,
  Room3DCameraState,
  Room3DMeta,
  Room3DMode,
  SeatMarkKind3D,
} from "@/components/seat-map/room-3d-scene";
import { Button } from "@/components/ui/button";
import { parseYoutubeId, youtubeThumbnailUrl } from "@/lib/movie/youtube";
import {
  DEFAULT_ROOM_3D_APPEARANCE,
  normalizeRoom3DAppearance,
  type Room3DAppearance,
} from "@/lib/seat-layout/room-3d-appearance.defaults";
import {
  buildRoomScene,
  type Room3DConfig,
  type RoomScene,
  type SceneSeatType,
  type SeatNeighbourDir,
} from "@/lib/seat-layout/scene";
import type { LayoutGeometry, LayoutSeat } from "@/lib/seat-layout/types";
import { cn } from "@/lib/utils";

const PerspectiveSeatPicker = dynamic(
  () => import("@/components/seat-map/perspective-seat-picker").then((m) => m.PerspectiveSeatPicker),
  { ssr: false },
);

export interface Room3DSeatAction {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onAction: (code: string) => void;
}

interface Props {
  /** Optional stable layout identifier from callers like RoomSeatView. */
  layoutKey?: string;
  /** Optional prebuilt 3D scene passed by parents that already compute seat metrics. */
  prebuiltScene?: RoomScene;
  seats: LayoutSeat[];
  geometry: LayoutGeometry;
  roomConfig: Room3DConfig;
  appearance?: Room3DAppearance;
  roomMeta?: Room3DMeta;
  /** Optional movie trailer YouTube ID (e.g. from an appointment) played automatically on the 3D screen. */
  overrideYoutubeId?: string | null;
  seatTypes?: SceneSeatType[];
  marks?: Map<string, SeatMarkKind3D>;
  /** Seats held by other bookings/appointments (rendered muted in 3D). */
  reservedCodes?: Set<string>;
  /** Seats assigned to friends in a group appointment (rendered with name tags & seated silhouettes). */
  holderLabels?: Map<string, string>;
  /** Seats highlighted with glowing floor rings in Orbit mode (e.g. multi-selected seats in Admin Editor). */
  highlightedCodes?: Set<string>;
  /** Optional primary action button shown in the 3D HUD for the currently inspected seat (e.g. assign friend). */
  seatAction?: Room3DSeatAction;
  maxHeight?: string;
  /** Show viewer/front-person height controls (user view only; admin previews at standard 170 cm reference). */
  showHeightControls?: boolean;
  /** Optional initial camera mode (e.g. "seat" when opening 3D directly from a selected 2D seat card). */
  initialMode?: Room3DMode;
  /** Optional controlled viewer height so 2D seat metrics and 3D POV stay in sync. */
  viewerHeightCm?: number;
  onViewerHeightChange?: (cm: number) => void;
  heat: boolean;
  selected: string | null;
  onSelect: (code: string | null) => void;
  /** Optional fallback callback shown if WebGL fails to initialize. */
  onSwitch2D?: () => void;
}

const VIEWER_HEIGHTS = [155, 165, 175, 185] as const;
const FRONT_HEIGHTS = [160, 170, 180] as const;
const HEIGHT_STORAGE_KEY = "seatmate:viewerHeightCm";
const CAMERA_PRESETS: readonly Room3DCameraPreset[] = ["overview", "entrance", "frontRow", "booth"];

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

function angleDeltaDeg(current: number, reference: number): number {
  let d = current - reference;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

type DeviceOrientationPermissionAPI = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/**
 * Interactive cinema-grade 3D auditorium viewer (lazy-loading vanilla `three` only when mounted).
 * Combines dark-theater HUD, house-lights dimmer, animated velvet curtains, perspective seat picker,
 * sightline laser check, A↔B seat comparison, camera bookmarks, POV snapshot, gyroscope look-around,
 * and smooth parabolic fly-to-seat transitions — keeping GPU strictly on-demand for iPhone PWA stability.
 */
export function Room3DView({
  layoutKey,
  prebuiltScene,
  seats,
  geometry,
  roomConfig,
  appearance = DEFAULT_ROOM_3D_APPEARANCE,
  roomMeta,
  overrideYoutubeId,
  seatTypes = [],
  marks,
  reservedCodes,
  holderLabels,
  highlightedCodes,
  seatAction,
  maxHeight = "52dvh",
  showHeightControls = false,
  initialMode = "orbit",
  viewerHeightCm: controlledViewerHeightCm,
  onViewerHeightChange,
  heat,
  selected,
  onSelect,
  onSwitch2D,
}: Props) {
  const t = useTranslations("cinemas.room");
  const inlineHostRef = useRef<HTMLDivElement>(null);
  const portalHostRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room3D | null>(null);
  const savedCameraRef = useRef<{ layoutKey: string | undefined; state: Room3DCameraState } | null>(null);
  const syncedRef = useRef<{
    heat: boolean;
    selected: string | null;
    activeMode: Room3DMode;
    audience: boolean;
    lightsUp: boolean;
    viewerHeightCm: number;
    frontHeightCm: number;
    marks: Map<string, SeatMarkKind3D> | undefined;
    reservedCodes: Set<string> | undefined;
    holderLabels: Map<string, string> | undefined;
    highlightedCodes: Set<string> | undefined;
    sightline: boolean;
    appearanceKey: string;
    ytMuted: boolean;
  } | null>(null);

  const startInSeat = initialMode === "seat" && Boolean(selected);
  const [mode, setMode] = useState<Room3DMode>(startInSeat ? "seat" : "orbit");
  const [lightsUp, setLightsUp] = useState(!startInSeat);
  const [audience, setAudience] = useState(true);
  const [sightline, setSightline] = useState(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [cameraReq, setCameraReq] = useState<{ preset: Room3DCameraPreset; seq: number } | null>(null);
  const [pinnedCode, setPinnedCode] = useState<string | null>(null);
  const [gyroOn, setGyroOn] = useState(false);
  const [snapBusy, setSnapBusy] = useState(false);
  const [useTrailerOverride, setUseTrailerOverride] = useState(true);
  const [unmutedYoutubeId, setUnmutedYoutubeId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hudExpanded, setHudExpanded] = useState(true);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [localViewerHeightCm, setLocalViewerHeightCm] = useState<number>(() => (showHeightControls ? readSavedViewerHeight() : 170));
  const viewerHeightCm = controlledViewerHeightCm ?? localViewerHeightCm;
  const [frontHeightCm, setFrontHeightCm] = useState<number>(170);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [gyroSupported] = useState<boolean>(
    () => typeof window !== "undefined" && "DeviceOrientationEvent" in window && ("ontouchstart" in window || navigator.maxTouchPoints > 0),
  );
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
      setCameraMenuOpen(false);
      setSightline(false);
      setHoveredCode(null);
      onSelect(code);
      setMode("seat");
      setLightsUp(false);
    },
    [onSelect],
  );

  const enterOverview = useCallback(() => {
    setPickerOpen(false);
    setGyroOn(false);
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

  const toggleSightline = useCallback(() => {
    const targetCode = selected ?? scene.bestSeatCode;
    if (!targetCode) return;
    setSightline((prev) => {
      const next = !prev;
      if (next) {
        if (!selected) onSelect(targetCode);
        setGyroOn(false);
        setCameraMenuOpen(false);
        setMode("orbit");
        setLightsUp(true);
      }
      return next;
    });
  }, [selected, scene.bestSeatCode, onSelect]);

  const selectCameraPreset = useCallback((preset: Room3DCameraPreset) => {
    setCameraMenuOpen(false);
    setGyroOn(false);
    setMode("orbit");
    setLightsUp(true);
    setCameraReq((prev) => ({ preset, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const stepSeat = useCallback(
    (dir: SeatNeighbourDir) => {
      if (!selected) return;
      const next = scene.neighbourOf(selected, dir);
      if (next) onSelect(next);
    },
    [selected, scene, onSelect],
  );

  const effectiveAppearance = useMemo(() => {
    const normalized = normalizeRoom3DAppearance(appearance);
    const trailerId = overrideYoutubeId ? parseYoutubeId(overrideYoutubeId) : null;
    if (trailerId && useTrailerOverride) {
      return {
        ...normalized,
        screenSource: "youtube" as const,
        screenYoutubeUrl: trailerId,
      };
    }
    return normalized;
  }, [appearance, overrideYoutubeId, useTrailerOverride]);

  const appearanceKey = useMemo(() => JSON.stringify(effectiveAppearance), [effectiveAppearance]);
  const youtubeId =
    effectiveAppearance.screenSource === "youtube" ? parseYoutubeId(effectiveAppearance.screenYoutubeUrl) : null;
  const hasYoutube = youtubeId !== null;
  const hasTrailerOverride = Boolean(overrideYoutubeId && parseYoutubeId(overrideYoutubeId));
  const ytMuted = !hasYoutube || unmutedYoutubeId !== youtubeId;

  const latest = useRef({
    heat,
    selected,
    activeMode,
    audience,
    lightsUp,
    viewerHeightCm,
    frontHeightCm,
    marks,
    reservedCodes,
    holderLabels,
    highlightedCodes,
    sightline,
    subtitleText,
    roomMeta,
    appearance: effectiveAppearance,
    youtubeId,
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
      reservedCodes,
      holderLabels,
      highlightedCodes,
      sightline,
      subtitleText,
      roomMeta,
      appearance: effectiveAppearance,
      youtubeId,
      ytMuted,
      enterSeat,
    };
  });

  const toggleYoutubeAudio = useCallback(() => {
    const activeId = latest.current.youtubeId;
    if (!activeId) return;
    const nextMuted = !latest.current.ytMuted;
    // Update refs before state so the prop-sync effect skips duplicate async calls, keeping Safari/iOS user activation intact.
    if (syncedRef.current) syncedRef.current.ytMuted = nextMuted;
    latest.current.ytMuted = nextMuted;
    setUnmutedYoutubeId(nextMuted ? null : activeId);
    roomRef.current?.setYoutubeMuted(nextMuted);
  }, []);

  // Mobile Gyroscope look-around listener (strictly active only while enabled inside seat POV).
  useEffect(() => {
    if (!gyroOn || activeMode !== "seat") return;
    let baseAlpha: number | null = null;
    let baseBeta: number | null = null;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null) return;
      if (baseAlpha === null || baseBeta === null) {
        baseAlpha = e.alpha;
        baseBeta = e.beta;
        return;
      }
      const dYaw = (angleDeltaDeg(e.alpha, baseAlpha) * Math.PI) / 180;
      const dPitch = ((e.beta - baseBeta) * Math.PI) / 180;
      roomRef.current?.setLookOffset(dYaw * 0.9, dPitch * 0.75);
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      roomRef.current?.setLookOffset(0, 0);
    };
  }, [gyroOn, activeMode]);

  // Trigger quick camera bookmark flights inside effect (keeps render helpers ref-free for React Compiler).
  useEffect(() => {
    if (!cameraReq || status !== "ready") return;
    roomRef.current?.setCameraPreset(cameraReq.preset);
  }, [cameraReq, status]);

  const toggleGyro = useCallback(async () => {
    if (gyroOn) {
      setGyroOn(false);
      return;
    }
    const api = typeof DeviceOrientationEvent !== "undefined" ? (DeviceOrientationEvent as DeviceOrientationPermissionAPI) : undefined;
    if (api && typeof api.requestPermission === "function") {
      try {
        const res = await api.requestPermission();
        if (res !== "granted") {
          toast.error(t("gyroDenied"));
          return;
        }
      } catch {
        toast.error(t("gyroDenied"));
        return;
      }
    }
    setGyroOn(true);
  }, [gyroOn, t]);

  // Lazily load vanilla three.js and build the WebGL scene only when the room layout changes.
  useEffect(() => {
    const target = (expanded ? portalHostRef.current : inlineHostRef.current) ?? inlineHostRef.current;
    if (!target) return;
    let cancelled = false;
    const restoredCamera =
      savedCameraRef.current && savedCameraRef.current.layoutKey === layoutKey ? savedCameraRef.current.state : null;
    if (!restoredCamera) setStatus("loading");
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
          reservedCodes: latest.current.reservedCodes,
          holderLabels: latest.current.holderLabels,
          highlightedCodes: latest.current.highlightedCodes,
          sightline: latest.current.sightline,
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
          reservedCodes: initState.reservedCodes,
          holderLabels: initState.holderLabels,
          highlightedCodes: initState.highlightedCodes,
          initialCameraState: restoredCamera,
          sightline: initState.sightline,
          roomMeta: latest.current.roomMeta,
          subtitleText: latest.current.subtitleText,
          appearance: latest.current.appearance,
          youtubeMuted: initState.ytMuted,
          onYoutubeMutedChange: (muted) => {
            if (syncedRef.current) syncedRef.current.ytMuted = muted;
            latest.current.ytMuted = muted;
            setUnmutedYoutubeId(muted ? null : latest.current.youtubeId);
          },
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
      if (roomRef.current) {
        savedCameraRef.current = { layoutKey, state: roomRef.current.getCameraState() };
      }
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
    if (prev.reservedCodes !== reservedCodes || prev.holderLabels !== holderLabels) {
      prev.reservedCodes = reservedCodes;
      prev.holderLabels = holderLabels;
      room.setOccupancy(reservedCodes, holderLabels);
    }
    if (prev.highlightedCodes !== highlightedCodes) {
      prev.highlightedCodes = highlightedCodes;
      room.setHighlightedCodes(highlightedCodes);
    }
    if (prev.sightline !== sightline) {
      prev.sightline = sightline;
      room.setSightline(sightline);
    }
    if (prev.ytMuted !== ytMuted) {
      prev.ytMuted = ytMuted;
      room.setYoutubeMuted(ytMuted);
    }
    if (prev.appearanceKey !== appearanceKey) {
      prev.appearanceKey = appearanceKey;
      room.setAppearance(effectiveAppearance);
    }
  }, [
    heat,
    selected,
    activeMode,
    audience,
    lightsUp,
    viewerHeightCm,
    frontHeightCm,
    marks,
    reservedCodes,
    holderLabels,
    highlightedCodes,
    sightline,
    effectiveAppearance,
    appearanceKey,
    ytMuted,
    status,
  ]);

  // Keyboard navigation: arrow keys step adjacent seats in POV; Escape closes picker → camera menu → fullscreen → seat view.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === "Escape") {
        if (pickerOpen) {
          e.preventDefault();
          setPickerOpen(false);
        } else if (cameraMenuOpen) {
          e.preventDefault();
          setCameraMenuOpen(false);
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
  }, [pickerOpen, cameraMenuOpen, expanded, activeMode, selected, stepSeat, enterOverview]);

  function pickViewerHeight(cm: number) {
    setLocalViewerHeightCm(cm);
    onViewerHeightChange?.(cm);
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
  const metrics = selected ? scene.viewMetricsOf(selected, viewerHeightCm) : null;
  const selectedSeat = selected ? seatByCode.get(selected) : undefined;
  const pinnedSeat = pinnedCode ? seatByCode.get(pinnedCode) : undefined;
  const pinnedMetrics = pinnedCode ? scene.viewMetricsOf(pinnedCode, viewerHeightCm) : null;
  const hoveredSeat = hoveredCode ? seatByCode.get(hoveredCode) : undefined;
  const seatQualityKey =
    selectedSeat !== undefined ? qualityKeyOf(heatLevel(selectedSeat.score, range.min, range.max)) : null;

  async function handleSnapshot() {
    if (!roomRef.current || snapBusy) return;
    setSnapBusy(true);
    try {
      const header = [roomMeta?.brandName, roomMeta?.roomName].filter(Boolean).join(" · ");
      const title = selectedSeat
        ? [header || "SeatMate 3D", t("seatBadge", { code: selectedSeat.code })].join(" — ")
        : header || "SeatMate 3D";
      const subtitle = metrics
        ? t("viewMetrics", {
            distance: metrics.distanceM.toFixed(1),
            horizontal: Math.round(metrics.horizontalDeg),
            vertical: Math.max(0, Math.round(metrics.verticalTopDeg)),
          })
        : t("orbit");
      const badge = selectedSeat ? t("seatScoreShort", { score: Math.round(selectedSeat.score) }) : undefined;
      const blob = await roomRef.current.captureSnapshot({
        title,
        subtitle,
        badge,
        youtubeThumbnailUrl: youtubeId ? youtubeThumbnailUrl(youtubeId) : undefined,
      });
      if (!blob) {
        toast.error(t("snapshotFailed"));
        return;
      }
      const fileName = selectedSeat ? `seatmate-${selectedSeat.code.toLowerCase()}.png` : "seatmate-3d.png";
      const file = new File([blob], fileName, { type: "image/png" });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        toast.success(t("snapshotSaved"));
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        toast.error(t("snapshotFailed"));
      }
    } finally {
      setSnapBusy(false);
    }
  }

  const togglePinCompare = useCallback(() => {
    if (!selected) return;
    setPinnedCode((prev) => (prev === selected ? null : selected));
  }, [selected]);

  const swapComparedSeats = useCallback(() => {
    if (!pinnedCode || !selected || pinnedCode === selected) return;
    const target = pinnedCode;
    setPinnedCode(selected);
    enterSeat(target);
  }, [pinnedCode, selected, enterSeat]);

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
            <div className="flex min-w-0 flex-col items-start gap-tight">
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
                      {selectedSeat.flags.map((flag) => (
                        <span
                          key={flag}
                          className={cn(
                            "rounded-full px-inset-xs py-hair type-micro",
                            flag === "broken"
                              ? "bg-red-600/90 text-white"
                              : flag === "obstructed"
                                ? "bg-amber-500/90 text-black"
                                : "bg-emerald-500/90 text-black",
                          )}
                        >
                          {t(`flags.${flag}`)}
                        </span>
                      ))}
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
                        : sightline && selectedSeat
                          ? t("sightlineBanner", { code: selectedSeat.code })
                          : t("orbit")}
                    </span>
                  </div>
                )}
              </div>

              {/* A ↔ B Seat Comparison Pill */}
              {pinnedSeat ? (
                <div className="pointer-events-auto flex flex-wrap items-center gap-tight rounded-2xl border border-white/20 bg-black/85 px-inset-sm py-tight text-white">
                  {selectedSeat && selectedSeat.code !== pinnedSeat.code && metrics && pinnedMetrics ? (
                    <>
                      <button
                        type="button"
                        onClick={swapComparedSeats}
                        className="inline-flex min-h-target items-center gap-tight rounded-xl bg-primary px-inset-xs type-tag text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
                      >
                        <TransferHorizontalIcon className="size-icon-sm shrink-0" aria-hidden />
                        <span className="tabular-nums">
                          {selectedSeat.code} ⇄ {pinnedSeat.code}
                        </span>
                      </button>
                      <span className="type-micro text-white/80 tabular-nums">
                        {t("compareSummary", {
                          a: selectedSeat.code,
                          aScore: Math.round(selectedSeat.score),
                          b: pinnedSeat.code,
                          bScore: Math.round(pinnedSeat.score),
                          distDiff: `${metrics.distanceM.toFixed(1)}m / ${pinnedMetrics.distanceM.toFixed(1)}m`,
                        })}
                      </span>
                    </>
                  ) : (
                    <span className="type-micro text-white/85 tabular-nums">
                      {t("comparePinned", { code: pinnedSeat.code })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPinnedCode(null)}
                    aria-label={t("compareClear")}
                    className="inline-flex size-target shrink-0 items-center justify-center rounded-full text-white/75 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
                  >
                    <CloseIcon className="size-icon-xs" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>

            {/* Right cluster: Movie trailer toggle + YouTube audio pill + Snapshot + Inline Expand */}
            <div className="flex shrink-0 items-center gap-tight">
              {hasTrailerOverride ? (
                <button
                  type="button"
                  onClick={() => setUseTrailerOverride((v) => !v)}
                  aria-pressed={useTrailerOverride}
                  aria-label={t("movieTrailer")}
                  title={t("movieTrailer")}
                  className={cn(
                    "pointer-events-auto inline-flex h-target shrink-0 items-center gap-tight rounded-full border px-inset-xs type-tag whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                    useTrailerOverride
                      ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-white/20 bg-black/80 text-white/85 hover:bg-black hover:text-white",
                  )}
                >
                  <ClapperboardPlayIcon className="size-icon-sm shrink-0" aria-hidden />
                  <span className="hidden sm:inline">{t("movieTrailerShort")}</span>
                </button>
              ) : null}

              {hasYoutube ? (
                <button
                  type="button"
                  onClick={toggleYoutubeAudio}
                  aria-label={ytMuted ? t("youtubeUnmute") : t("youtubeMute")}
                  aria-pressed={!ytMuted}
                  title={ytMuted ? t("youtubeUnmute") : t("youtubeMute")}
                  className={cn(
                    "pointer-events-auto inline-flex h-target shrink-0 items-center gap-tight rounded-full border px-inset-sm type-label whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                    ytMuted
                      ? "border-white/25 bg-black/85 text-white hover:bg-black"
                      : "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {ytMuted ? (
                    <VolumeCrossIcon className="size-icon-sm shrink-0" aria-hidden />
                  ) : (
                    <VolumeLoudIcon className="size-icon-sm shrink-0" aria-hidden />
                  )}
                  <span>{ytMuted ? t("youtubeUnmuteShort") : t("youtubeMuteShort")}</span>
                </button>
              ) : null}

              <button
                type="button"
                disabled={snapBusy}
                onClick={() => void handleSnapshot()}
                aria-label={t("snapshot")}
                title={t("snapshot")}
                className="pointer-events-auto inline-flex size-target shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white/90 transition-colors hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-40"
              >
                <CameraIcon className="size-icon-sm" aria-hidden />
              </button>

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
            {/* Optional primary seat action (e.g. assign friend in Appointment SeatPlanner) */}
            {seatAction && selectedSeat ? (
              <button
                type="button"
                disabled={seatAction.disabled}
                onClick={() => seatAction.onAction(selectedSeat.code)}
                className={cn(
                  "pointer-events-auto inline-flex h-target items-center gap-tight rounded-full border px-inset type-label transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-50",
                  seatAction.active
                    ? "border-white/25 bg-black/85 text-white hover:bg-black"
                    : "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                <span>{seatAction.label}</span>
              </button>
            ) : null}

            {/* Camera preset quick-jump strip */}
            {cameraMenuOpen ? (
              <div
                role="group"
                aria-label={t("cameraPresetsLabel")}
                className="pointer-events-auto flex max-w-full items-center gap-tight overflow-x-auto overscroll-x-contain rounded-full border border-white/15 bg-black/85 p-tight text-white"
              >
                {CAMERA_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => selectCameraPreset(preset)}
                    className="inline-flex h-target shrink-0 items-center rounded-full px-inset-sm type-tag whitespace-nowrap text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
                  >
                    {t(`cameraPresets.${preset}`)}
                  </button>
                ))}
              </div>
            ) : null}

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
                onClick={() => {
                  setCameraMenuOpen(false);
                  setPickerOpen((v) => !v);
                }}
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

              {selected ? (
                <DockButton
                  active={activeMode === "seat"}
                  label={activeMode === "seat" ? t("orbit") : t("fromSeat", { code: selected })}
                  showText={isFullscreen}
                  onClick={() => {
                    if (activeMode === "seat") enterOverview();
                    else enterSeat(selected);
                  }}
                >
                  {activeMode === "seat" ? (
                    <CompassIcon className="size-icon-sm" aria-hidden />
                  ) : (
                    <EyeIcon className="size-icon-sm" aria-hidden />
                  )}
                </DockButton>
              ) : null}

              <DockButton
                active={cameraMenuOpen}
                label={t("cameraPresetsLabel")}
                shortLabel={t("cameraShort")}
                showText={isFullscreen}
                onClick={() => setCameraMenuOpen((v) => !v)}
              >
                <VideocameraIcon className="size-icon-sm" aria-hidden />
              </DockButton>

              <DockButton
                active={sightline}
                label={t("sightline")}
                showText={isFullscreen}
                onClick={toggleSightline}
              >
                <EyeScanIcon className="size-icon-sm" aria-hidden />
              </DockButton>

              {selected ? (
                <DockButton
                  active={pinnedCode === selected}
                  label={t("comparePin")}
                  showText={isFullscreen}
                  onClick={togglePinCompare}
                >
                  <PinIcon className="size-icon-sm" aria-hidden />
                </DockButton>
              ) : null}

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

              {activeMode === "seat" && gyroSupported ? (
                <DockButton
                  active={gyroOn}
                  label={t("gyro")}
                  showText={isFullscreen}
                  onClick={() => void toggleGyro()}
                >
                  <SmartphoneRotateOrientationIcon className="size-icon-sm" aria-hidden />
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
