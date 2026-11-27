"use client";

import { AltArrowDownIcon, AltArrowUpIcon, CheckIcon, GalleryIcon, LoaderIcon, RestartIcon } from "@solar-icons/react/line-duotone";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { getScreenImageUploadTicket, getSurfaceTextureUploadTicket } from "@/actions/uploads";
import { saveRoom3DAppearanceAction } from "@/app/admin/settings/room-3d/actions";
import { ChoiceGroup } from "@/components/admin/auditorium-editor/chips";
import { ImageUpload, UploadBusyContext } from "@/components/image-upload";
import { LazyConfirmDialog } from "@/components/lazy-dialogs";
import { LoadingState } from "@/components/loading-state";
import { RemoteImage } from "@/components/remote-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { parseYoutubeId, youtubeThumbnailUrl } from "@/lib/movie/youtube";
import { DEFAULT_CINEMA_DIMENSIONS, type CinemaDimensionDefaults } from "@/lib/seat-layout/dimensions.defaults";
import {
  AISLE_LED_COLORS,
  applyRoom3DPreset,
  CARPET_STYLES,
  CEILING_STYLES,
  COVE_LED_PLACEMENTS,
  DEFAULT_ROOM_3D_APPEARANCE,
  DOOR_STYLES,
  EXIT_SIGN_COLORS,
  EXIT_SIGN_TEXTS,
  LIGHT_ACCENT_COLORS,
  MAX_SCREEN_URL_LENGTH,
  MAX_SUBTITLE_LENGTH,
  MAX_SURFACE_IMAGE_REPEAT,
  MIN_SURFACE_IMAGE_REPEAT,
  MOVIE_AMBIENT_LEVELS,
  normalizeRoom3DAppearance,
  PROJECTOR_BEAM_INTENSITIES,
  ROOM_3D_COLOR_SWATCHES,
  ROOM_3D_PRESETS,
  ROW_MARKER_PLACEMENTS,
  SCREEN_BORDER_STYLES,
  SCREEN_CONTENT_PRESETS,
  SCREEN_MASKINGS,
  SCREEN_SOURCES,
  SEAT_FINISHES,
  STARLIGHT_COLORS,
  SUBTITLE_COLORS,
  SURFACE_IMAGE_REPEAT_PRESETS,
  WALL_STYLES,
  type Room3DAppearance,
  type Room3DPresetId,
} from "@/lib/seat-layout/room-3d-appearance.defaults";
import type { Room3DConfig, SceneSeatType } from "@/lib/seat-layout/scene";
import type { LayoutConfig, SeatTypeInfo } from "@/lib/seat-layout/types";
import { PX } from "@/lib/ui-sizes";
import { cn } from "@/lib/utils";
import { buildLayoutPreview } from "@/services/seat-layout-build";

const PREVIEW_MAX_HEIGHT = "44dvh";

const Room3DView = dynamic(() => import("@/components/seat-map/room-3d-view").then((m) => m.Room3DView), {
  ssr: false,
  loading: () => (
    <div
      style={{ aspectRatio: "4 / 3", maxHeight: PREVIEW_MAX_HEIGHT }}
      className="relative flex w-full items-center justify-center rounded-xl border bg-card"
    >
      <LoadingState compact className="h-full min-h-0" />
    </div>
  ),
});

interface PreviewSeatType extends SeatTypeInfo {
  color: string | null;
  color3d: string | null;
}

const SAMPLE_SEAT_TYPES: PreviewSeatType[] = [
  { id: "std", name: "Standard", capacity: 1, style: "standard", color: "#8e1e36", color3d: "#8e1e36" },
  { id: "vip", name: "VIP", capacity: 1, style: "vip", color: "#b45309", color3d: "#b45309" },
  { id: "couple", name: "Sweetbox", capacity: 2, style: "vip", color: "#be185d", color3d: "#be185d" },
];

const LUXURY_SEAT_TYPES: PreviewSeatType[] = [
  { id: "lux-recliner", name: "Recliner", capacity: 1, style: "recliner", color: "#9a3412", color3d: "#7c2d12" },
  { id: "lux-4dx", name: "4DX", capacity: 1, style: "4dx", color: "#1d4ed8", color3d: "#1e3a5f" },
  { id: "lux-bed", name: "L'Amour", capacity: 2, style: "bed", color: "#9d174d", color3d: "#831843" },
];

type SampleRoomKind = "standard" | "large" | "luxury" | "sideAisle";
const SAMPLE_ROOM_KINDS: readonly SampleRoomKind[] = ["standard", "large", "luxury", "sideAisle"];

function buildSampleConfig(types: PreviewSeatType[], kind: SampleRoomKind): LayoutConfig {
  if (kind === "luxury") {
    return {
      rows: 5,
      cols: 8,
      rowLabelOrder: "front_to_back",
      colNumbering: "left_to_right",
      defaultSeatType: "lux-recliner",
      screen: {
        positionPct: 50,
        widthPct: 90,
        distance: "medium",
        shape: "scope",
        mount: "high",
        tilt: "slight",
      },
      seatRecline: "deep",
      rowPitch: "vip",
      stadiumFromRow: 1,
      stepsPerRow: 2,
      aisles: {
        verticalAfterCols: [4],
        horizontalAfterRows: [],
      },
      entrances: [
        { side: "left", position: "front" },
        { side: "right", position: "back" },
      ],
      overrides: [
        { row: "A", cols: [1, 2, 3, 4, 5, 6, 7, 8], type: "lux-4dx" },
        { row: "B", cols: [1, 2, 3, 4, 5, 6, 7, 8], type: "lux-4dx" },
        { row: "E", cols: [1, 2, 3, 4, 5, 6, 7, 8], type: "lux-bed" },
      ],
    };
  }

  const singles = types.filter((t) => t.capacity === 1);
  const couples = types.filter((t) => t.capacity === 2);
  const std = singles.find((t) => t.style === "standard") ?? singles[0] ?? types[0];
  const vip =
    singles.find((t) => t.id !== std.id && (t.style === "vip" || t.style === "recliner")) ??
    singles.find((t) => t.id !== std.id);
  const extra =
    singles.find((t) => t.id !== std.id && t.id !== vip?.id) ??
    couples.find((t) => t.id !== std.id && t.id !== vip?.id);
  const couple = couples[0];

  if (kind === "large") {
    const overrides: LayoutConfig["overrides"] = [];
    if (vip) {
      for (const row of ["E", "F", "G", "H"]) {
        overrides.push({ row, cols: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13], type: vip.id });
      }
    }
    if (couple) {
      overrides.push({ row: "K", cols: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], type: couple.id });
    }
    return {
      rows: 10,
      cols: 16,
      rowLabelOrder: "front_to_back",
      colNumbering: "left_to_right",
      defaultSeatType: std.id,
      screen: {
        positionPct: 50,
        widthPct: 88,
        distance: "medium",
        shape: "standard",
        mount: "mid",
        tilt: "flat",
      },
      seatRecline: "slight",
      rowPitch: "standard",
      stadiumFromRow: 1,
      stepsPerRow: 2,
      aisles: {
        verticalAfterCols: [3, 13],
        horizontalAfterRows: [4],
      },
      entrances: [
        { side: "left", position: "front" },
        { side: "right", position: "front" },
        { side: "left", position: "back" },
      ],
      overrides,
    };
  }

  if (kind === "sideAisle") {
    const overrides: LayoutConfig["overrides"] = [];
    if (vip) {
      overrides.push({ row: "D", cols: [3, 4, 5, 6, 7, 8], type: vip.id });
      overrides.push({ row: "E", cols: [3, 4, 5, 6, 7, 8], type: vip.id });
    }
    if (couple) {
      overrides.push({ row: "F", cols: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], type: couple.id });
    }
    return {
      rows: 6,
      cols: 10,
      rowLabelOrder: "front_to_back",
      colNumbering: "left_to_right",
      defaultSeatType: std.id,
      screen: {
        positionPct: 50,
        widthPct: 86,
        distance: "near",
        shape: "scope",
        mount: "mid",
        tilt: "flat",
      },
      seatRecline: "slight",
      rowPitch: "standard",
      stadiumFromRow: 1,
      stepsPerRow: 2,
      aisles: {
        verticalAfterCols: [],
        horizontalAfterRows: [],
        sideAisles: ["right"],
      },
      entrances: [
        { side: "right", position: "front" },
        { side: "right", position: "back" },
      ],
      overrides,
    };
  }

  const overrides: LayoutConfig["overrides"] = [];
  if (vip) {
    overrides.push({ row: "D", cols: [4, 5, 6, 7, 8, 9], type: vip.id });
    overrides.push({ row: "E", cols: [4, 5, 6, 7, 8, 9], type: vip.id });
  }
  if (extra && extra.id !== couple?.id) {
    overrides.push({ row: "F", cols: [4, 5, 6, 7, 8, 9], type: extra.id });
  }
  if (couple) {
    overrides.push({ row: "G", cols: [4, 5, 6, 7, 8, 9], type: couple.id });
  }

  return {
    rows: 7,
    cols: 12,
    rowLabelOrder: "front_to_back",
    colNumbering: "left_to_right",
    defaultSeatType: std.id,
    screen: {
      positionPct: 50,
      widthPct: 86,
      distance: "medium",
      shape: "scope",
      mount: "mid",
      tilt: "flat",
    },
    seatRecline: "slight",
    rowPitch: "standard",
    stadiumFromRow: 1,
    stepsPerRow: 2,
    aisles: {
      verticalAfterCols: [3, 9],
      horizontalAfterRows: [],
    },
    entrances: [
      { side: "left", position: "front" },
      { side: "right", position: "back" },
    ],
    overrides,
  };
}

const CONTROL_INPUT = "h-control rounded-xl bg-background px-inset type-body";

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="flex flex-col rounded-xl border bg-card/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-target items-center justify-between gap-item rounded-xl px-inset-sm py-inset-xs text-left transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="type-item-title">{title}</span>
        {open ? (
          <AltArrowUpIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <AltArrowDownIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      {open ? <div className="flex flex-col gap-field border-t px-inset-sm py-inset">{children}</div> : null}
    </section>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex min-h-target items-center justify-between gap-group">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ColorSwatchField({
  id,
  label,
  pickLabel,
  value,
  swatches,
  onChange,
}: {
  id: string;
  label: string;
  pickLabel: string;
  value: string;
  swatches: readonly string[];
  onChange: (hex: string) => void;
}) {
  const upper = value.toUpperCase();
  const pickerVal = /^#[0-9A-F]{6}$/.test(upper) ? upper.toLowerCase() : swatches[0].toLowerCase();
  return (
    <div className="flex flex-col gap-item">
      <div className="flex items-baseline justify-between gap-stack">
        <Label htmlFor={id} className="text-muted-foreground">
          {label}
        </Label>
        <span className="type-caption text-muted-foreground tabular-nums">{upper}</span>
      </div>
      <div className="flex flex-wrap items-center gap-stack">
        {swatches.map((hex) => {
          const active = upper === hex.toUpperCase();
          return (
            <button
              key={hex}
              type="button"
              aria-label={`${label}: ${hex}`}
              aria-pressed={active}
              onClick={() => onChange(hex.toUpperCase())}
              style={{ backgroundColor: hex }}
              className={cn(
                "flex size-target items-center justify-center rounded-full border-2 text-white transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
                active ? "border-primary" : "border-border",
              )}
            >
              {active ? <CheckIcon className="size-icon-sm" aria-hidden /> : null}
            </button>
          );
        })}
        <input
          id={id}
          type="color"
          aria-label={`${pickLabel}: ${label}`}
          value={pickerVal}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-target w-swatch shrink-0 cursor-pointer rounded-full border bg-card p-tight"
        />
      </div>
    </div>
  );
}

function SurfaceTextureField({
  id,
  name,
  label,
  urlLabel,
  placeholder,
  hint,
  invalidText,
  value,
  invalid,
  onChange,
  repeatId,
  repeatLabel,
  repeatHint,
  repeat,
  onRepeatChange,
}: {
  id: string;
  name: string;
  label: string;
  urlLabel: string;
  placeholder: string;
  hint: string;
  invalidText: string;
  value: string;
  invalid: boolean;
  onChange: (next: string) => void;
  repeatId: string;
  repeatLabel: string;
  repeatHint: string;
  repeat: number;
  onRepeatChange: (next: number) => void;
}) {
  const hasImage = value.trim().length > 0;
  return (
    <div className="flex flex-col gap-item rounded-xl border bg-background/50 p-inset-sm">
      <span className="type-label leading-none! text-muted-foreground">{label}</span>
      <ImageUpload
        name={name}
        value={value}
        onChange={onChange}
        getTicket={getSurfaceTextureUploadTicket}
        preview={(url) => {
          const validPreview = url && (url.startsWith("blob:") || isValidHttpUrl(url)) ? url : "";
          return (
            <div className="relative flex aspect-square w-swatch items-center justify-center overflow-hidden rounded-xl border bg-muted">
              {validPreview ? (
                <RemoteImage src={validPreview} alt="" fill sizes={`${PX.swatch}px`} className="object-cover" />
              ) : (
                <GalleryIcon className="size-icon-lg text-muted-foreground" aria-hidden />
              )}
            </div>
          );
        }}
      />
      <div className="flex flex-col gap-tight">
        <Label htmlFor={id} className="text-muted-foreground">
          {urlLabel}
        </Label>
        <Input
          id={id}
          type="url"
          value={value}
          maxLength={MAX_SCREEN_URL_LENGTH}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          className={CONTROL_INPUT}
        />
        {invalid ? (
          <p className="type-caption text-destructive">{invalidText}</p>
        ) : (
          <p className="type-caption text-muted-foreground">{hint}</p>
        )}
      </div>
      {hasImage ? (
        <div className="flex flex-col gap-tight border-t pt-inset-xs">
          <div className="flex items-baseline justify-between gap-tight">
            <Label htmlFor={repeatId} className="text-muted-foreground">
              {repeatLabel}
            </Label>
            <span className="type-caption tabular-nums text-muted-foreground">
              {repeat}×
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-tight">
            <ChoiceGroup
              label={repeatLabel}
              value={String(repeat)}
              onChange={(next) => onRepeatChange(Number(next))}
              options={SURFACE_IMAGE_REPEAT_PRESETS.map((n) => ({
                value: String(n),
                label: `${n}×`,
              }))}
            />
            <Input
              id={repeatId}
              type="number"
              inputMode="numeric"
              min={MIN_SURFACE_IMAGE_REPEAT}
              max={MAX_SURFACE_IMAGE_REPEAT}
              step={1}
              value={repeat}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(parsed)) {
                  onRepeatChange(Math.max(MIN_SURFACE_IMAGE_REPEAT, Math.min(MAX_SURFACE_IMAGE_REPEAT, parsed)));
                }
              }}
              className="h-control w-swatch rounded-xl bg-card px-inset-xs text-center type-body tabular-nums"
            />
          </div>
          <p className="type-caption text-muted-foreground">{repeatHint}</p>
        </div>
      ) : null}
    </div>
  );
}

interface Props {
  initial: Room3DAppearance;
  dimensionDefaults?: CinemaDimensionDefaults;
  seatTypes?: PreviewSeatType[];
}

export function Room3DAppearanceForm({
  initial,
  dimensionDefaults = DEFAULT_CINEMA_DIMENSIONS,
  seatTypes,
}: Props) {
  const t = useTranslations("admin.room3dAppearance");
  const tc = useTranslations("admin.common");
  const [draft, setDraft] = useState<Room3DAppearance>(() => normalizeRoom3DAppearance(initial));
  const [previewAppearance, setPreviewAppearance] = useState<Room3DAppearance>(() =>
    normalizeRoom3DAppearance(initial),
  );
  const [heat, setHeat] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sampleRoomKind, setSampleRoomKind] = useState<SampleRoomKind>("standard");
  const [appliedPreset, setAppliedPreset] = useState<Room3DPresetId | null>(null);
  const [prePresetDraft, setPrePresetDraft] = useState<Room3DAppearance | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(0);
  const reportUpload = useCallback((busy: boolean) => setUploadCount((n) => Math.max(0, n + (busy ? 1 : -1))), []);
  const uploading = uploadCount > 0;
  const [pending, startSaving] = useTransition();

  // Lightly debounce live 3D UI updates while dragging color pickers or typing subtitles/links.
  useEffect(() => {
    const id = window.setTimeout(() => setPreviewAppearance(draft), 60);
    return () => window.clearTimeout(id);
  }, [draft]);

  const set = (patch: Partial<Room3DAppearance>) => {
    setAppliedPreset(null);
    setPrePresetDraft(null);
    setDraft((prev) => ({ ...prev, ...patch }));
  };
  const togglePreset = (presetId: Room3DPresetId) => {
    if (appliedPreset === presetId) {
      // Clicking the active preset again turns it off and restores the pre-preset configuration.
      setAppliedPreset(null);
      setDraft(prePresetDraft ?? normalizeRoom3DAppearance(initial));
      setPrePresetDraft(null);
      return;
    }
    const base = prePresetDraft ?? draft;
    if (!prePresetDraft) setPrePresetDraft(draft);
    setAppliedPreset(presetId);
    setDraft(applyRoom3DPreset(base, presetId, { keepScreenSource: base.screenSource !== "preset" }));
  };
  const trimmedImageUrl = draft.screenImageUrl.trim();
  const imageUrlInvalid = trimmedImageUrl.length > 0 && !isValidHttpUrl(trimmedImageUrl);
  const trimmedWallImageUrl = draft.wallImageUrl.trim();
  const wallImageUrlInvalid = trimmedWallImageUrl.length > 0 && !isValidHttpUrl(trimmedWallImageUrl);
  const trimmedCeilingImageUrl = draft.ceilingImageUrl.trim();
  const ceilingImageUrlInvalid = trimmedCeilingImageUrl.length > 0 && !isValidHttpUrl(trimmedCeilingImageUrl);
  const trimmedCarpetImageUrl = draft.carpetImageUrl.trim();
  const carpetImageUrlInvalid = trimmedCarpetImageUrl.length > 0 && !isValidHttpUrl(trimmedCarpetImageUrl);
  const trimmedYoutubeUrl = draft.screenYoutubeUrl.trim();
  const parsedYoutubeId = useMemo(
    () => (trimmedYoutubeUrl ? parseYoutubeId(trimmedYoutubeUrl) : null),
    [trimmedYoutubeUrl],
  );
  const youtubeUrlInvalid = trimmedYoutubeUrl.length > 0 && parsedYoutubeId === null;

  const activeSeatTypes = useMemo(() => {
    if (sampleRoomKind === "luxury") return LUXURY_SEAT_TYPES;
    return seatTypes && seatTypes.length > 0 ? seatTypes : SAMPLE_SEAT_TYPES;
  }, [seatTypes, sampleRoomKind]);
  const sampleConfig = useMemo(() => buildSampleConfig(activeSeatTypes, sampleRoomKind), [activeSeatTypes, sampleRoomKind]);
  const sampleBuilt = useMemo(
    () => buildLayoutPreview(sampleConfig, activeSeatTypes, dimensionDefaults),
    [sampleConfig, activeSeatTypes, dimensionDefaults],
  );
  const sampleSceneTypes = useMemo<SceneSeatType[]>(
    () => activeSeatTypes.map(({ id, color, color3d, style }) => ({ id, color, color3d, style })),
    [activeSeatTypes],
  );
  const sampleRoomConfig = useMemo<Room3DConfig>(
    () => ({
      stadiumFromRow: sampleConfig.stadiumFromRow,
      stepsPerRow: sampleConfig.stepsPerRow,
      screenDistance: sampleConfig.screen.distance,
      screenShape: sampleConfig.screen.shape,
      screenMount: sampleConfig.screen.mount,
      screenTilt: sampleConfig.screen.tilt,
      seatRecline: sampleConfig.seatRecline,
      rowPitch: sampleConfig.rowPitch,
      defaults: dimensionDefaults,
    }),
    [sampleConfig, dimensionDefaults],
  );

  function resetToDefault() {
    setConfirmReset(false);
    setAppliedPreset(null);
    setPrePresetDraft(null);
    setDraft({ ...DEFAULT_ROOM_3D_APPEARANCE });
    toast.info(t("resetNotice"));
  }

  function save() {
    if (uploading) return;
    if (imageUrlInvalid || wallImageUrlInvalid || ceilingImageUrlInvalid || carpetImageUrlInvalid) {
      toast.error(t("fields.screenImageInvalid"));
      return;
    }
    if (youtubeUrlInvalid) {
      toast.error(t("fields.screenYoutubeInvalid"));
      return;
    }
    const payload: Room3DAppearance = {
      ...draft,
      screenImageUrl: trimmedImageUrl,
      screenYoutubeUrl: trimmedYoutubeUrl,
      wallImageUrl: trimmedWallImageUrl,
      ceilingImageUrl: trimmedCeilingImageUrl,
      carpetImageUrl: trimmedCarpetImageUrl,
    };
    startSaving(async () => {
      const result = await saveRoom3DAppearanceAction(payload).catch(() => null);
      if (!result) {
        toast.error(tc("errors.network"));
        return;
      }
      if (result.ok) {
        toast.success(tc("saved"));
      } else {
        toast.error(result.error === "validation" ? t("validationError") : tc("errors.unknown"));
      }
    });
  }

  return (
    <UploadBusyContext.Provider value={reportUpload}>
    <div className="flex flex-1 flex-col gap-group">
      <p className="type-secondary text-muted-foreground">{t("intro")}</p>

      <div className="flex flex-col gap-group lg:grid lg:grid-cols-[minmax(0,1fr)_var(--container-form)] lg:items-start lg:gap-section">
        {/* Sticky Live 3D Sample Auditorium Preview */}
        <div className="sticky top-target z-10 -mx-inset flex transform-gpu flex-col gap-tight bg-background px-inset pb-inset-xs lg:mx-0 lg:px-0">
          {!previewCollapsed ? (
            <Room3DView
              layoutKey={`room-3d-appearance-${sampleRoomKind}`}
              seats={sampleBuilt.seats}
              geometry={sampleBuilt.geometry}
              roomConfig={sampleRoomConfig}
              appearance={previewAppearance}
              roomMeta={{ roomName: t(`sampleRooms.${sampleRoomKind}`), brandName: "SeatMate" }}
              seatTypes={sampleSceneTypes}
              maxHeight={PREVIEW_MAX_HEIGHT}
              heat={heat}
              selected={selectedSeat}
              onSelect={setSelectedSeat}
            />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-stack">
            <ChoiceGroup
              label={t("sampleRoomLabel")}
              value={sampleRoomKind}
              onChange={(next) => {
                setSelectedSeat(null);
                setSampleRoomKind(next);
              }}
              options={SAMPLE_ROOM_KINDS.map((value) => ({
                value,
                label: t(`sampleRooms.${value}`),
              }))}
            />
            <div className="flex min-h-target items-center gap-stack">
              <Label htmlFor="r3d-preview-heat" className="text-muted-foreground">
                {t("previewHeatmap")}
              </Label>
              <Switch id="r3d-preview-heat" checked={heat} onCheckedChange={setHeat} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPreviewCollapsed((v) => !v)}
                aria-label={previewCollapsed ? t("showPreview") : t("hidePreview")}
                aria-expanded={!previewCollapsed}
                className="text-muted-foreground lg:hidden"
              >
                {previewCollapsed ? <AltArrowDownIcon aria-hidden /> : <AltArrowUpIcon aria-hidden />}
              </Button>
            </div>
          </div>
          {!previewCollapsed ? <span className="type-caption text-muted-foreground">{t("previewHint")}</span> : null}
        </div>

        {/* Visual UI Controls */}
        <div className="flex flex-col gap-field">
          {/* Quick One-Tap Cinema Theme Presets */}
          <section className="flex flex-col gap-item rounded-xl border bg-card/40 p-inset-sm">
            <div className="flex flex-col gap-hair">
              <h3 className="type-item-title">{t("presetsTitle")}</h3>
              <p className="type-caption text-muted-foreground">{t("presetsHint")}</p>
            </div>
            <div className="flex flex-wrap gap-tight">
              {ROOM_3D_PRESETS.map((preset) => {
                const active = appliedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePreset(preset.id)}
                    className={cn(
                      "inline-flex min-h-target items-center gap-stack rounded-xl border px-inset-sm type-label transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-hair" aria-hidden>
                      {preset.swatches.map((hex) => (
                        <span
                          key={hex}
                          style={{ backgroundColor: hex }}
                          className="size-icon-xs rounded-full border border-white/25"
                        />
                      ))}
                    </span>
                    <span>{t(`presets.${preset.id}`)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 1. Screen & Stage */}
          <CollapsibleSection title={t("sections.screen")} defaultOpen>
            <div className="flex flex-col gap-item">
              <span className="type-label leading-none! text-muted-foreground">{t("fields.screenSource")}</span>
              <ChoiceGroup
                label={t("fields.screenSource")}
                value={draft.screenSource}
                onChange={(screenSource) => set({ screenSource })}
                options={SCREEN_SOURCES.map((value) => ({
                  value,
                  label: t(`options.screenSource.${value}`),
                }))}
              />
            </div>

            {draft.screenSource === "preset" ? (
              <div className="flex flex-col gap-item">
                <span className="type-label leading-none! text-muted-foreground">{t("fields.screenContent")}</span>
                <ChoiceGroup
                  label={t("fields.screenContent")}
                  value={draft.screenContent}
                  onChange={(screenContent) => set({ screenContent })}
                  options={SCREEN_CONTENT_PRESETS.map((value) => ({
                    value,
                    label: t(`options.screenContent.${value}`),
                  }))}
                />
              </div>
            ) : null}

            {draft.screenSource === "image" ? (
              <div className="flex flex-col gap-item">
                <span className="type-label leading-none! text-muted-foreground">{t("fields.screenImageUpload")}</span>
                <ImageUpload
                  name="screenImageUrl"
                  value={draft.screenImageUrl}
                  onChange={(screenImageUrl) => set({ screenImageUrl })}
                  getTicket={getScreenImageUploadTicket}
                  preview={(url) => {
                    const validPreview = url && (url.startsWith("blob:") || isValidHttpUrl(url)) ? url : "";
                    return (
                      <div className="relative flex aspect-video w-poster items-center justify-center overflow-hidden rounded-xl border bg-muted">
                        {validPreview ? (
                          <RemoteImage src={validPreview} alt="" fill sizes={`${PX.poster}px`} className="object-cover" />
                        ) : (
                          <GalleryIcon className="size-icon-lg text-muted-foreground" aria-hidden />
                        )}
                      </div>
                    );
                  }}
                />
                <div className="flex flex-col gap-tight">
                  <Label htmlFor="r3d-screen-image-url" className="text-muted-foreground">
                    {t("fields.screenImageUrl")}
                  </Label>
                  <Input
                    id="r3d-screen-image-url"
                    type="url"
                    value={draft.screenImageUrl}
                    maxLength={MAX_SCREEN_URL_LENGTH}
                    autoComplete="off"
                    placeholder={t("fields.screenImageUrlPlaceholder")}
                    onChange={(e) => set({ screenImageUrl: e.target.value })}
                    aria-invalid={imageUrlInvalid}
                    className={CONTROL_INPUT}
                  />
                  {imageUrlInvalid ? (
                    <p className="type-caption text-destructive">{t("fields.screenImageInvalid")}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {draft.screenSource === "youtube" ? (
              <div className="flex flex-col gap-item">
                <Label htmlFor="r3d-screen-yt-url" className="text-muted-foreground">
                  {t("fields.screenYoutubeUrl")}
                </Label>
                <Input
                  id="r3d-screen-yt-url"
                  type="url"
                  value={draft.screenYoutubeUrl}
                  maxLength={MAX_SCREEN_URL_LENGTH}
                  autoComplete="off"
                  placeholder={t("fields.screenYoutubePlaceholder")}
                  onChange={(e) => set({ screenYoutubeUrl: e.target.value })}
                  aria-invalid={youtubeUrlInvalid}
                  className={CONTROL_INPUT}
                />
                {youtubeUrlInvalid ? (
                  <p className="type-caption text-destructive">{t("fields.screenYoutubeInvalid")}</p>
                ) : parsedYoutubeId ? (
                  <div className="flex items-center gap-stack rounded-xl border bg-background p-inset-xs">
                    <div className="relative aspect-video w-swatch shrink-0 overflow-hidden rounded-lg bg-black">
                      <RemoteImage
                        src={youtubeThumbnailUrl(parsedYoutubeId)}
                        alt=""
                        fill
                        sizes={`${PX.swatch}px`}
                        className="object-cover"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-hair">
                      <span className="truncate type-label tabular-nums">{parsedYoutubeId}</span>
                      <span className="type-caption text-muted-foreground">{t("fields.screenYoutubeHint")}</span>
                    </div>
                  </div>
                ) : (
                  <p className="type-caption text-muted-foreground">{t("fields.screenYoutubeHint")}</p>
                )}
              </div>
            ) : null}

            <div className="flex flex-col gap-item">
              <span className="type-label leading-none! text-muted-foreground">{t("fields.screenBorder")}</span>
              <ChoiceGroup
                label={t("fields.screenBorder")}
                value={draft.screenBorder}
                onChange={(screenBorder) => set({ screenBorder })}
                options={SCREEN_BORDER_STYLES.map((value) => ({
                  value,
                  label: t(`options.screenBorder.${value}`),
                }))}
              />
            </div>

            <div className="flex flex-col gap-item">
              <span className="type-label leading-none! text-muted-foreground">{t("fields.screenMasking")}</span>
              <ChoiceGroup
                label={t("fields.screenMasking")}
                value={draft.screenMasking}
                onChange={(screenMasking) => set({ screenMasking })}
                options={SCREEN_MASKINGS.map((value) => ({
                  value,
                  label: t(`options.screenMasking.${value}`),
                }))}
              />
            </div>

            <div className="flex flex-col gap-stack">
              <ToggleRow
                id="r3d-screen-curtains"
                label={t("fields.screenCurtainsVisible")}
                checked={draft.screenCurtainsVisible}
                onChange={(screenCurtainsVisible) => set({ screenCurtainsVisible })}
              />
              {draft.screenCurtainsVisible ? (
                <>
                  <ToggleRow
                    id="r3d-screen-curtains-anim"
                    label={t("fields.screenCurtainsAnimated")}
                    checked={draft.screenCurtainsAnimated}
                    onChange={(screenCurtainsAnimated) => set({ screenCurtainsAnimated })}
                  />
                  <ColorSwatchField
                    id="r3d-screen-curtains-color"
                    label={t("fields.screenCurtainsColor")}
                    pickLabel={t("pickColor")}
                    value={draft.screenCurtainsColor}
                    swatches={ROOM_3D_COLOR_SWATCHES.curtain}
                    onChange={(screenCurtainsColor) => set({ screenCurtainsColor })}
                  />
                </>
              ) : null}
              <ToggleRow
                id="r3d-stage-apron"
                label={t("fields.screenStageApron")}
                checked={draft.screenStageApron}
                onChange={(screenStageApron) => set({ screenStageApron })}
              />
              {draft.screenStageApron ? (
                <>
                  <ToggleRow
                    id="r3d-stage-led"
                    label={t("fields.screenStageLed")}
                    checked={draft.screenStageLed}
                    onChange={(screenStageLed) => set({ screenStageLed })}
                  />
                  <ToggleRow
                    id="r3d-stage-subs"
                    label={t("fields.stageSubwoofersVisible")}
                    checked={draft.stageSubwoofersVisible}
                    onChange={(stageSubwoofersVisible) => set({ stageSubwoofersVisible })}
                  />
                </>
              ) : null}
              <ToggleRow
                id="r3d-screen-halo"
                label={t("fields.screenHalo")}
                checked={draft.screenHalo}
                onChange={(screenHalo) => set({ screenHalo })}
              />
              <ToggleRow
                id="r3d-screen-wall-wash"
                label={t("fields.screenWallWash")}
                checked={draft.screenWallWash}
                onChange={(screenWallWash) => set({ screenWallWash })}
              />
              {draft.screenSource !== "youtube" ? (
                <ToggleRow
                  id="r3d-show-sub"
                  label={t("fields.screenShowSubtitle")}
                  checked={draft.screenShowSubtitle}
                  onChange={(screenShowSubtitle) => set({ screenShowSubtitle })}
                />
              ) : null}
            </div>

            {draft.screenSource !== "youtube" && draft.screenShowSubtitle ? (
              <>
                <div className="flex flex-col gap-item">
                  <Label htmlFor="r3d-sub-text" className="text-muted-foreground">
                    {t("fields.screenSubtitleText")}
                  </Label>
                  <Input
                    id="r3d-sub-text"
                    value={draft.screenSubtitleText}
                    maxLength={MAX_SUBTITLE_LENGTH}
                    autoComplete="off"
                    placeholder={t("fields.screenSubtitlePlaceholder")}
                    onChange={(e) => set({ screenSubtitleText: e.target.value })}
                    className={CONTROL_INPUT}
                  />
                </div>
                <div className="flex flex-col gap-item">
                  <span className="type-label leading-none! text-muted-foreground">
                    {t("fields.screenSubtitleColor")}
                  </span>
                  <ChoiceGroup
                    label={t("fields.screenSubtitleColor")}
                    value={draft.screenSubtitleColor}
                    onChange={(screenSubtitleColor) => set({ screenSubtitleColor })}
                    options={SUBTITLE_COLORS.map((value) => ({
                      value,
                      label: t(`options.subtitleColor.${value}`),
                    }))}
                  />
                </div>
              </>
            ) : null}
          </CollapsibleSection>

          {/* 2. Seats */}
          <CollapsibleSection title={t("sections.seats")}>
            <div className="flex flex-col gap-item">
              <span className="type-label leading-none! text-muted-foreground">{t("fields.seatFinish")}</span>
              <ChoiceGroup
                label={t("fields.seatFinish")}
                value={draft.seatFinish}
                onChange={(seatFinish) => set({ seatFinish })}
                options={SEAT_FINISHES.map((value) => ({
                  value,
                  label: t(`options.seatFinish.${value}`),
                }))}
              />
            </div>
            <ColorSwatchField
              id="r3d-seat-frame"
              label={t("fields.seatFrameColor")}
              pickLabel={t("pickColor")}
              value={draft.seatFrameColor}
              swatches={ROOM_3D_COLOR_SWATCHES.seatFrame}
              onChange={(seatFrameColor) => set({ seatFrameColor })}
            />
            <div className="flex flex-col gap-stack">
              <ToggleRow
                id="r3d-seat-numbers"
                label={t("fields.seatNumbersVisible")}
                checked={draft.seatNumbersVisible}
                onChange={(seatNumbersVisible) => set({ seatNumbersVisible })}
              />
              <ToggleRow
                id="r3d-snack-props"
                label={t("fields.snackPropsVisible")}
                checked={draft.snackPropsVisible}
                onChange={(snackPropsVisible) => set({ snackPropsVisible })}
              />
            </div>
          </CollapsibleSection>

          {/* 3. Doors & EXIT */}
          <CollapsibleSection title={t("sections.doors")}>
            <div className="flex flex-col gap-item">
              <span className="type-label leading-none! text-muted-foreground">{t("fields.doorStyle")}</span>
              <ChoiceGroup
                label={t("fields.doorStyle")}
                value={draft.doorStyle}
                onChange={(doorStyle) => set({ doorStyle })}
                options={DOOR_STYLES.map((value) => ({
                  value,
                  label: t(`options.doorStyle.${value}`),
                }))}
              />
            </div>

            {draft.doorStyle !== "curtain" ? (
              <ToggleRow
                id="r3d-door-bar"
                label={t("fields.doorPanicBar")}
                checked={draft.doorPanicBar}
                onChange={(doorPanicBar) => set({ doorPanicBar })}
              />
            ) : null}

            <ColorSwatchField
              id="r3d-door-color"
              label={t("fields.doorColor")}
              pickLabel={t("pickColor")}
              value={draft.doorColor}
              swatches={ROOM_3D_COLOR_SWATCHES.door}
              onChange={(doorColor) => set({ doorColor })}
            />
            <ColorSwatchField
              id="r3d-door-frame"
              label={t("fields.doorFrameColor")}
              pickLabel={t("pickColor")}
              value={draft.doorFrameColor}
              swatches={ROOM_3D_COLOR_SWATCHES.doorFrame}
              onChange={(doorFrameColor) => set({ doorFrameColor })}
            />

            <ToggleRow
              id="r3d-exit-visible"
              label={t("fields.exitSignVisible")}
              checked={draft.exitSignVisible}
              onChange={(exitSignVisible) => set({ exitSignVisible })}
            />

            {draft.exitSignVisible ? (
              <>
                <div className="flex flex-col gap-item">
                  <span className="type-label leading-none! text-muted-foreground">{t("fields.exitSignColor")}</span>
                  <ChoiceGroup
                    label={t("fields.exitSignColor")}
                    value={draft.exitSignColor}
                    onChange={(exitSignColor) => set({ exitSignColor })}
                    options={EXIT_SIGN_COLORS.map((value) => ({
                      value,
                      label: t(`options.exitSignColor.${value}`),
                    }))}
                  />
                </div>
                <div className="flex flex-col gap-item">
                  <span className="type-label leading-none! text-muted-foreground">{t("fields.exitSignText")}</span>
                  <ChoiceGroup
                    label={t("fields.exitSignText")}
                    value={draft.exitSignText}
                    onChange={(exitSignText) => set({ exitSignText })}
                    options={EXIT_SIGN_TEXTS.map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </div>
              </>
            ) : null}

            <div className="flex flex-col gap-stack">
              <ToggleRow
                id="r3d-room-sign"
                label={t("fields.roomSignVisible")}
                checked={draft.roomSignVisible}
                onChange={(roomSignVisible) => set({ roomSignVisible })}
              />
              <ToggleRow
                id="r3d-emergency-lights"
                label={t("fields.emergencyLightsVisible")}
                checked={draft.emergencyLightsVisible}
                onChange={(emergencyLightsVisible) => set({ emergencyLightsVisible })}
              />
            </div>
          </CollapsibleSection>

          {/* 4. Walls, Ceiling & Carpet */}
          <CollapsibleSection title={t("sections.surfaces")}>
            <div className="flex flex-col gap-item">
              <span className="type-label leading-none! text-muted-foreground">{t("fields.wallStyle")}</span>
              <ChoiceGroup
                label={t("fields.wallStyle")}
                value={draft.wallStyle}
                onChange={(wallStyle) => set({ wallStyle })}
                options={WALL_STYLES.map((value) => ({
                  value,
                  label: t(`options.wallStyle.${value}`),
                }))}
              />
            </div>
            <ColorSwatchField
              id="r3d-wall-color"
              label={t("fields.wallColor")}
              pickLabel={t("pickColor")}
              value={draft.wallColor}
              swatches={ROOM_3D_COLOR_SWATCHES.wall}
              onChange={(wallColor) => set({ wallColor })}
            />
            <SurfaceTextureField
              id="r3d-wall-image"
              name="wallImageUrl"
              label={t("fields.wallImageUrl")}
              urlLabel={t("fields.screenImageUrl")}
              placeholder={t("fields.screenImageUrlPlaceholder")}
              hint={t("fields.surfaceImageHint")}
              invalidText={t("fields.screenImageInvalid")}
              value={draft.wallImageUrl}
              invalid={wallImageUrlInvalid}
              onChange={(wallImageUrl) => set({ wallImageUrl })}
              repeatId="r3d-wall-repeat"
              repeatLabel={t("fields.surfaceImageRepeat")}
              repeatHint={t("fields.surfaceImageRepeatHint")}
              repeat={draft.wallImageRepeat}
              onRepeatChange={(wallImageRepeat) => set({ wallImageRepeat })}
            />

            <div className="flex flex-col gap-item">
              <span className="type-label leading-none! text-muted-foreground">{t("fields.ceilingStyle")}</span>
              <ChoiceGroup
                label={t("fields.ceilingStyle")}
                value={draft.ceilingStyle}
                onChange={(ceilingStyle) => set({ ceilingStyle })}
                options={CEILING_STYLES.map((value) => ({
                  value,
                  label: t(`options.ceilingStyle.${value}`),
                }))}
              />
            </div>
            {draft.ceilingStyle === "starlight" ? (
              <div className="flex flex-col gap-item">
                <span className="type-label leading-none! text-muted-foreground">{t("fields.starlightColor")}</span>
                <ChoiceGroup
                  label={t("fields.starlightColor")}
                  value={draft.starlightColor}
                  onChange={(starlightColor) => set({ starlightColor })}
                  options={STARLIGHT_COLORS.map((value) => ({
                    value,
                    label: t(`options.starlightColor.${value}`),
                  }))}
                />
              </div>
            ) : null}
            <ToggleRow
              id="r3d-ceiling-details"
              label={t("fields.ceilingDetailsVisible")}
              checked={draft.ceilingDetailsVisible}
              onChange={(ceilingDetailsVisible) => set({ ceilingDetailsVisible })}
            />
            <ColorSwatchField
              id="r3d-ceiling-color"
              label={t("fields.ceilingColor")}
              pickLabel={t("pickColor")}
              value={draft.ceilingColor}
              swatches={ROOM_3D_COLOR_SWATCHES.ceiling}
              onChange={(ceilingColor) => set({ ceilingColor })}
            />
            <SurfaceTextureField
              id="r3d-ceiling-image"
              name="ceilingImageUrl"
              label={t("fields.ceilingImageUrl")}
              urlLabel={t("fields.screenImageUrl")}
              placeholder={t("fields.screenImageUrlPlaceholder")}
              hint={t("fields.surfaceImageHint")}
              invalidText={t("fields.screenImageInvalid")}
              value={draft.ceilingImageUrl}
              invalid={ceilingImageUrlInvalid}
              onChange={(ceilingImageUrl) => set({ ceilingImageUrl })}
              repeatId="r3d-ceiling-repeat"
              repeatLabel={t("fields.surfaceImageRepeat")}
              repeatHint={t("fields.surfaceImageRepeatHint")}
              repeat={draft.ceilingImageRepeat}
              onRepeatChange={(ceilingImageRepeat) => set({ ceilingImageRepeat })}
            />

            <div className="flex flex-col gap-item">
              <span className="type-label leading-none! text-muted-foreground">{t("fields.carpetStyle")}</span>
              <ChoiceGroup
                label={t("fields.carpetStyle")}
                value={draft.carpetStyle}
                onChange={(carpetStyle) => set({ carpetStyle })}
                options={CARPET_STYLES.map((value) => ({
                  value,
                  label: t(`options.carpetStyle.${value}`),
                }))}
              />
            </div>
            <ColorSwatchField
              id="r3d-carpet-color"
              label={t("fields.carpetColor")}
              pickLabel={t("pickColor")}
              value={draft.carpetColor}
              swatches={ROOM_3D_COLOR_SWATCHES.carpet}
              onChange={(carpetColor) => set({ carpetColor })}
            />
            <SurfaceTextureField
              id="r3d-carpet-image"
              name="carpetImageUrl"
              label={t("fields.carpetImageUrl")}
              urlLabel={t("fields.screenImageUrl")}
              placeholder={t("fields.screenImageUrlPlaceholder")}
              hint={t("fields.surfaceImageHint")}
              invalidText={t("fields.screenImageInvalid")}
              value={draft.carpetImageUrl}
              invalid={carpetImageUrlInvalid}
              onChange={(carpetImageUrl) => set({ carpetImageUrl })}
              repeatId="r3d-carpet-repeat"
              repeatLabel={t("fields.surfaceImageRepeat")}
              repeatHint={t("fields.surfaceImageRepeatHint")}
              repeat={draft.carpetImageRepeat}
              onRepeatChange={(carpetImageRepeat) => set({ carpetImageRepeat })}
            />
          </CollapsibleSection>

          {/* 5. Lighting & Fixtures */}
          <CollapsibleSection title={t("sections.lightingFixtures")}>
            <div className="flex flex-col gap-item">
              <span className="type-label leading-none! text-muted-foreground">{t("fields.movieAmbientLevel")}</span>
              <ChoiceGroup
                label={t("fields.movieAmbientLevel")}
                value={draft.movieAmbientLevel}
                onChange={(movieAmbientLevel) => set({ movieAmbientLevel })}
                options={MOVIE_AMBIENT_LEVELS.map((value) => ({
                  value,
                  label: t(`options.movieAmbientLevel.${value}`),
                }))}
              />
            </div>
            <div className="flex flex-col gap-stack">
              <ToggleRow
                id="r3d-downlights"
                label={t("fields.downlightsVisible")}
                checked={draft.downlightsVisible}
                onChange={(downlightsVisible) => set({ downlightsVisible })}
              />
              <ToggleRow
                id="r3d-sconces"
                label={t("fields.sconcesVisible")}
                checked={draft.sconcesVisible}
                onChange={(sconcesVisible) => set({ sconcesVisible })}
              />
            </div>

            {draft.sconcesVisible ? (
              <div className="flex flex-col gap-item">
                <span className="type-label leading-none! text-muted-foreground">{t("fields.sconceColor")}</span>
                <ChoiceGroup
                  label={t("fields.sconceColor")}
                  value={draft.sconceColor}
                  onChange={(sconceColor) => set({ sconceColor })}
                  options={LIGHT_ACCENT_COLORS.map((value) => ({
                    value,
                    label: t(`options.lightAccent.${value}`),
                  }))}
                />
              </div>
            ) : null}

            <ToggleRow
              id="r3d-cove-led"
              label={t("fields.coveLedVisible")}
              checked={draft.coveLedVisible}
              onChange={(coveLedVisible) => set({ coveLedVisible })}
            />

            {draft.coveLedVisible ? (
              <>
                <div className="flex flex-col gap-item">
                  <span className="type-label leading-none! text-muted-foreground">{t("fields.coveLedPlacement")}</span>
                  <ChoiceGroup
                    label={t("fields.coveLedPlacement")}
                    value={draft.coveLedPlacement}
                    onChange={(coveLedPlacement) => set({ coveLedPlacement })}
                    options={COVE_LED_PLACEMENTS.map((value) => ({
                      value,
                      label: t(`options.coveLedPlacement.${value}`),
                    }))}
                  />
                </div>
                <div className="flex flex-col gap-item">
                  <span className="type-label leading-none! text-muted-foreground">{t("fields.coveLedColor")}</span>
                  <ChoiceGroup
                    label={t("fields.coveLedColor")}
                    value={draft.coveLedColor}
                    onChange={(coveLedColor) => set({ coveLedColor })}
                    options={LIGHT_ACCENT_COLORS.map((value) => ({
                      value,
                      label: t(`options.lightAccent.${value}`),
                    }))}
                  />
                </div>
              </>
            ) : null}

            <ToggleRow
              id="r3d-aisle-led"
              label={t("fields.aisleLedVisible")}
              checked={draft.aisleLedVisible}
              onChange={(aisleLedVisible) => set({ aisleLedVisible })}
            />

            {draft.aisleLedVisible ? (
              <div className="flex flex-col gap-item">
                <span className="type-label leading-none! text-muted-foreground">{t("fields.aisleLedColor")}</span>
                <ChoiceGroup
                  label={t("fields.aisleLedColor")}
                  value={draft.aisleLedColor}
                  onChange={(aisleLedColor) => set({ aisleLedColor })}
                  options={AISLE_LED_COLORS.map((value) => ({
                    value,
                    label: t(`options.aisleLedColor.${value}`),
                  }))}
                />
              </div>
            ) : null}

            <ToggleRow
              id="r3d-row-markers"
              label={t("fields.rowMarkersVisible")}
              checked={draft.rowMarkersVisible}
              onChange={(rowMarkersVisible) => set({ rowMarkersVisible })}
            />

            {draft.rowMarkersVisible ? (
              <>
                <div className="flex flex-col gap-item">
                  <span className="type-label leading-none! text-muted-foreground">
                    {t("fields.rowMarkersPlacement")}
                  </span>
                  <ChoiceGroup
                    label={t("fields.rowMarkersPlacement")}
                    value={draft.rowMarkersPlacement}
                    onChange={(rowMarkersPlacement) => set({ rowMarkersPlacement })}
                    options={ROW_MARKER_PLACEMENTS.map((value) => ({
                      value,
                      label: t(`options.rowMarkerPlacement.${value}`),
                    }))}
                  />
                </div>
                <div className="flex flex-col gap-item">
                  <span className="type-label leading-none! text-muted-foreground">{t("fields.rowMarkersColor")}</span>
                  <ChoiceGroup
                    label={t("fields.rowMarkersColor")}
                    value={draft.rowMarkersColor}
                    onChange={(rowMarkersColor) => set({ rowMarkersColor })}
                    options={AISLE_LED_COLORS.map((value) => ({
                      value,
                      label: t(`options.aisleLedColor.${value}`),
                    }))}
                  />
                </div>
              </>
            ) : null}

            <div className="flex flex-col gap-stack">
              <ToggleRow
                id="r3d-aisle-handrails"
                label={t("fields.aisleHandrailsVisible")}
                checked={draft.aisleHandrailsVisible}
                onChange={(aisleHandrailsVisible) => set({ aisleHandrailsVisible })}
              />
              <ToggleRow
                id="r3d-proj-port"
                label={t("fields.projectionPortVisible")}
                checked={draft.projectionPortVisible}
                onChange={(projectionPortVisible) => set({ projectionPortVisible })}
              />
              <ToggleRow
                id="r3d-proj-beam"
                label={t("fields.projectorBeamVisible")}
                checked={draft.projectorBeamVisible}
                onChange={(projectorBeamVisible) => set({ projectorBeamVisible })}
              />
              {draft.projectorBeamVisible ? (
                <div className="flex flex-col gap-item">
                  <span className="type-label leading-none! text-muted-foreground">
                    {t("fields.projectorBeamIntensity")}
                  </span>
                  <ChoiceGroup
                    label={t("fields.projectorBeamIntensity")}
                    value={draft.projectorBeamIntensity}
                    onChange={(projectorBeamIntensity) => set({ projectorBeamIntensity })}
                    options={PROJECTOR_BEAM_INTENSITIES.map((value) => ({
                      value,
                      label: t(`options.projectorBeamIntensity.${value}`),
                    }))}
                  />
                </div>
              ) : null}
              <ToggleRow
                id="r3d-surround"
                label={t("fields.surroundSpeakersVisible")}
                checked={draft.surroundSpeakersVisible}
                onChange={(surroundSpeakersVisible) => set({ surroundSpeakersVisible })}
              />
              <ToggleRow
                id="r3d-ceiling-spk"
                label={t("fields.ceilingSpeakersVisible")}
                checked={draft.ceilingSpeakersVisible}
                onChange={(ceilingSpeakersVisible) => set({ ceilingSpeakersVisible })}
              />
              <ToggleRow
                id="r3d-4dx-wall"
                label={t("fields.fourDxWallPropsVisible")}
                checked={draft.fourDxWallPropsVisible}
                onChange={(fourDxWallPropsVisible) => set({ fourDxWallPropsVisible })}
              />
            </div>
          </CollapsibleSection>
        </div>
      </div>

      <div aria-hidden className="h-save-clear shrink-0" />

      <div
        data-save-bar
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-inset pt-group pb-(--inset-bottom) md:left-sidebar"
      >
        <div className="mx-auto flex max-w-form flex-wrap items-center gap-stack">
          <Button
            type="button"
            variant="outline"
            size="cta"
            disabled={pending || uploading}
            onClick={() => setConfirmReset(true)}
            className="pointer-events-auto w-auto flex-auto bg-background px-inset-sm"
          >
            <RestartIcon aria-hidden />
            {t("reset")}
          </Button>
          <Button
            type="button"
            size="cta"
            disabled={pending || uploading}
            onClick={save}
            className="pointer-events-auto w-auto flex-auto px-inset"
          >
            {pending ? (
              <>
                <LoaderIcon className="motion-safe:animate-spin" aria-hidden />
                {tc("saving")}
              </>
            ) : (
              tc("save")
            )}
          </Button>
        </div>
      </div>
      {confirmReset ? (
        <LazyConfirmDialog
          open={confirmReset}
          onOpenChange={setConfirmReset}
          title={t("resetConfirmTitle")}
          description={t("resetConfirmDescription")}
          icon={<RestartIcon aria-hidden />}
          confirmLabel={t("reset")}
          onConfirm={resetToDefault}
        />
      ) : null}
    </div>
    </UploadBusyContext.Provider>
  );
}
