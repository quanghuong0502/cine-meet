/**
 * Pure visual/UI appearance configuration for the 3D cinema room (zero physical/scoring impact, zero Zod dependency).
 * Shared safely between server services, client settings forms, and the vanilla Three.js auditorium renderer.
 */

export type ScreenSource = "preset" | "image" | "youtube";
export type ScreenBorderStyle = "velvet" | "slim" | "frameless";
export type ScreenContentPreset = "cosmos" | "noir" | "grid";
export type ScreenMasking = "none" | "scope" | "flat";
export type SubtitleColor = "white" | "yellow";
export type SeatFinish = "fabric" | "leather";
export type DoorStyle = "single" | "double" | "curtain";
export type ExitSignColor = "green" | "red";
export type ExitSignText = "EXIT" | "LỐI RA";
export type WallStyle = "slats" | "panels" | "matte";
export type CeilingStyle = "coffered" | "flat" | "starlight";
export type StarlightColor = "cool" | "warm" | "rainbow";
export type CarpetStyle = "speckled" | "striped" | "solid";
export type LightAccentColor = "warm" | "neutral" | "cool" | "crimson";
export type AisleLedColor = "amber" | "white" | "blue" | "red";
export type RowMarkerPlacement = "step" | "riser" | "aisle" | "wall";
export type CoveLedPlacement = "ceiling" | "wall" | "both";
export type MovieAmbientLevel = "deep" | "balanced" | "bright";
export type ProjectorBeamIntensity = "subtle" | "medium" | "vivid";
export type Room3DPresetId = "classic" | "blackbox" | "goldclass" | "neon" | "retro";

export const SCREEN_SOURCES: readonly ScreenSource[] = ["preset", "image", "youtube"];
export const SCREEN_BORDER_STYLES: readonly ScreenBorderStyle[] = ["velvet", "slim", "frameless"];
export const SCREEN_CONTENT_PRESETS: readonly ScreenContentPreset[] = ["cosmos", "noir", "grid"];
export const SCREEN_MASKINGS: readonly ScreenMasking[] = ["none", "scope", "flat"];
export const SUBTITLE_COLORS: readonly SubtitleColor[] = ["white", "yellow"];
export const SEAT_FINISHES: readonly SeatFinish[] = ["fabric", "leather"];
export const DOOR_STYLES: readonly DoorStyle[] = ["single", "double", "curtain"];
export const EXIT_SIGN_COLORS: readonly ExitSignColor[] = ["green", "red"];
export const EXIT_SIGN_TEXTS: readonly ExitSignText[] = ["EXIT", "LỐI RA"];
export const WALL_STYLES: readonly WallStyle[] = ["slats", "panels", "matte"];
export const CEILING_STYLES: readonly CeilingStyle[] = ["coffered", "flat", "starlight"];
export const STARLIGHT_COLORS: readonly StarlightColor[] = ["cool", "warm", "rainbow"];
export const CARPET_STYLES: readonly CarpetStyle[] = ["speckled", "striped", "solid"];
export const SURFACE_IMAGE_REPEAT_PRESETS: readonly number[] = [1, 2, 3, 4, 6];
export const MIN_SURFACE_IMAGE_REPEAT = 1;
export const MAX_SURFACE_IMAGE_REPEAT = 12;
export const LIGHT_ACCENT_COLORS: readonly LightAccentColor[] = ["warm", "neutral", "cool", "crimson"];
export const AISLE_LED_COLORS: readonly AisleLedColor[] = ["amber", "white", "blue", "red"];
export const ROW_MARKER_PLACEMENTS: readonly RowMarkerPlacement[] = ["step", "riser", "aisle", "wall"];
export const COVE_LED_PLACEMENTS: readonly CoveLedPlacement[] = ["ceiling", "wall", "both"];
export const MOVIE_AMBIENT_LEVELS: readonly MovieAmbientLevel[] = ["deep", "balanced", "bright"];
export const PROJECTOR_BEAM_INTENSITIES: readonly ProjectorBeamIntensity[] = ["subtle", "medium", "vivid"];
export const ROOM_3D_PRESET_IDS: readonly Room3DPresetId[] = ["classic", "blackbox", "goldclass", "neon", "retro"];

export const MAX_SUBTITLE_LENGTH = 80;
export const MAX_SCREEN_URL_LENGTH = 500;

export interface Room3DAppearance {
  // Screen & front stage
  screenSource: ScreenSource;
  screenBorder: ScreenBorderStyle;
  screenMasking: ScreenMasking;
  screenCurtainsVisible: boolean;
  screenCurtainsAnimated: boolean;
  screenCurtainsColor: string;
  screenStageApron: boolean;
  screenStageLed: boolean;
  stageSubwoofersVisible: boolean;
  screenHalo: boolean;
  screenWallWash: boolean;
  screenContent: ScreenContentPreset;
  /** Uploaded / HTTPS image URL shown on the 3D screen when `screenSource === "image"`. */
  screenImageUrl: string;
  /** YouTube link or 11-char video ID played on the 3D screen when `screenSource === "youtube"`. */
  screenYoutubeUrl: string;
  screenShowSubtitle: boolean;
  /** Empty string falls back to the localized default sample subtitle. */
  screenSubtitleText: string;
  screenSubtitleColor: SubtitleColor;
  // Seats (global visual finish & frame only; seat-type upholstery & Heatmap stay untouched)
  seatFinish: SeatFinish;
  seatFrameColor: string;
  seatNumbersVisible: boolean;
  snackPropsVisible: boolean;
  // Doors & EXIT signs
  doorStyle: DoorStyle;
  doorPanicBar: boolean;
  doorColor: string;
  doorFrameColor: string;
  exitSignVisible: boolean;
  exitSignColor: ExitSignColor;
  exitSignText: ExitSignText;
  roomSignVisible: boolean;
  emergencyLightsVisible: boolean;
  // Interior surfaces
  wallStyle: WallStyle;
  wallColor: string;
  /** Optional custom uploaded/HTTPS image URL synthesized into an acoustic wall PBR material. */
  wallImageUrl: string;
  /** Number of uncropped image repeats along the wall's constraining dimension (1–12). */
  wallImageRepeat: number;
  ceilingStyle: CeilingStyle;
  starlightColor: StarlightColor;
  ceilingColor: string;
  /** Optional custom uploaded/HTTPS image URL synthesized into an acoustic ceiling PBR material. */
  ceilingImageUrl: string;
  /** Number of uncropped image repeats along the ceiling's constraining dimension (1–12). */
  ceilingImageRepeat: number;
  ceilingDetailsVisible: boolean;
  carpetStyle: CarpetStyle;
  carpetColor: string;
  /** Optional custom uploaded/HTTPS image URL synthesized into a carpet/floor PBR material. */
  carpetImageUrl: string;
  /** Number of uncropped image repeats along the floor's constraining dimension (1–12). */
  carpetImageRepeat: number;
  // Lighting & cinema fixtures
  movieAmbientLevel: MovieAmbientLevel;
  downlightsVisible: boolean;
  sconcesVisible: boolean;
  sconceColor: LightAccentColor;
  coveLedVisible: boolean;
  coveLedPlacement: CoveLedPlacement;
  coveLedColor: LightAccentColor;
  aisleLedVisible: boolean;
  aisleLedColor: AisleLedColor;
  aisleHandrailsVisible: boolean;
  rowMarkersVisible: boolean;
  rowMarkersPlacement: RowMarkerPlacement;
  rowMarkersColor: AisleLedColor;
  projectionPortVisible: boolean;
  projectorBeamVisible: boolean;
  projectorBeamIntensity: ProjectorBeamIntensity;
  surroundSpeakersVisible: boolean;
  ceilingSpeakersVisible: boolean;
  fourDxWallPropsVisible: boolean;
}

export const DEFAULT_ROOM_3D_APPEARANCE: Room3DAppearance = {
  screenSource: "preset",
  screenBorder: "velvet",
  screenMasking: "none",
  screenCurtainsVisible: false,
  screenCurtainsAnimated: true,
  screenCurtainsColor: "#2B0C14",
  screenStageApron: true,
  screenStageLed: true,
  stageSubwoofersVisible: true,
  screenHalo: true,
  screenWallWash: true,
  screenContent: "cosmos",
  screenImageUrl: "",
  screenYoutubeUrl: "",
  screenShowSubtitle: true,
  screenSubtitleText: "",
  screenSubtitleColor: "white",
  seatFinish: "fabric",
  seatFrameColor: "#15131C",
  seatNumbersVisible: true,
  snackPropsVisible: true,
  doorStyle: "single",
  doorPanicBar: true,
  doorColor: "#0A0A10",
  doorFrameColor: "#1E1C28",
  exitSignVisible: true,
  exitSignColor: "green",
  exitSignText: "EXIT",
  roomSignVisible: true,
  emergencyLightsVisible: true,
  wallStyle: "slats",
  wallColor: "#14131D",
  wallImageUrl: "",
  wallImageRepeat: 2,
  ceilingStyle: "coffered",
  starlightColor: "cool",
  ceilingColor: "#0B0D14",
  ceilingImageUrl: "",
  ceilingImageRepeat: 2,
  ceilingDetailsVisible: true,
  carpetStyle: "speckled",
  carpetColor: "#161320",
  carpetImageUrl: "",
  carpetImageRepeat: 2,
  movieAmbientLevel: "balanced",
  downlightsVisible: true,
  sconcesVisible: true,
  sconceColor: "warm",
  coveLedVisible: false,
  coveLedPlacement: "ceiling",
  coveLedColor: "warm",
  aisleLedVisible: true,
  aisleLedColor: "amber",
  aisleHandrailsVisible: false,
  rowMarkersVisible: true,
  rowMarkersPlacement: "step",
  rowMarkersColor: "amber",
  projectionPortVisible: true,
  projectorBeamVisible: true,
  projectorBeamIntensity: "medium",
  surroundSpeakersVisible: true,
  ceilingSpeakersVisible: true,
  fourDxWallPropsVisible: true,
};

/** Curated cinema-safe dark swatches for surface & hardware pickers (keeps screen & Heatmap readable). */
export const ROOM_3D_COLOR_SWATCHES = {
  curtain: ["#111018", "#2B0C14", "#450A18", "#0D1B2E", "#211714"],
  wall: ["#14131D", "#0A0B10", "#1C1217", "#0E1522", "#1A1815", "#141B19"],
  ceiling: ["#0B0D14", "#07080C", "#0E0A10", "#080D16", "#12100E"],
  carpet: ["#161320", "#0E0F16", "#26121C", "#101828", "#1E1614", "#121C1A"],
  seatFrame: ["#15131C", "#101016", "#1F1616", "#111622", "#262220"],
  door: ["#0A0A10", "#181014", "#0B101A", "#1C1917", "#231418"],
  doorFrame: ["#1E1C28", "#171720", "#332222", "#1C2638", "#302A24"],
} as const;

export interface Room3DPreset {
  id: Room3DPresetId;
  /** Preview palette dots shown on preset chips (wall, accent light, curtain/carpet). */
  swatches: readonly [string, string, string];
  patch: Partial<Room3DAppearance>;
}

/** Curated one-tap real-world auditorium themes (CGV, Dolby/IMAX, Gold Class, Cyber Neon, Retro). */
export const ROOM_3D_PRESETS: readonly Room3DPreset[] = [
  {
    id: "classic",
    swatches: ["#1C1217", "#F59E0B", "#450A18"],
    patch: {
      screenBorder: "velvet",
      screenCurtainsVisible: true,
      screenCurtainsAnimated: true,
      screenCurtainsColor: "#450A18",
      screenStageApron: true,
      screenStageLed: true,
      stageSubwoofersVisible: true,
      screenHalo: true,
      screenWallWash: true,
      screenContent: "cosmos",
      seatFinish: "fabric",
      seatFrameColor: "#1F1616",
      doorStyle: "single",
      doorColor: "#181014",
      doorFrameColor: "#332222",
      exitSignColor: "green",
      wallStyle: "slats",
      wallColor: "#1C1217",
      wallImageUrl: "",
      ceilingStyle: "coffered",
      ceilingColor: "#0E0A10",
      ceilingImageUrl: "",
      carpetStyle: "speckled",
      carpetColor: "#26121C",
      carpetImageUrl: "",
      movieAmbientLevel: "balanced",
      downlightsVisible: true,
      sconcesVisible: true,
      sconceColor: "warm",
      coveLedVisible: false,
      aisleLedVisible: true,
      aisleLedColor: "amber",
      rowMarkersVisible: true,
      rowMarkersPlacement: "step",
      rowMarkersColor: "amber",
      projectorBeamVisible: true,
      projectorBeamIntensity: "medium",
    },
  },
  {
    id: "blackbox",
    swatches: ["#0A0B10", "#38BDF8", "#0E1522"],
    patch: {
      screenBorder: "slim",
      screenCurtainsVisible: false,
      screenStageApron: true,
      screenStageLed: false,
      stageSubwoofersVisible: true,
      screenHalo: true,
      screenWallWash: true,
      screenContent: "cosmos",
      seatFinish: "fabric",
      seatFrameColor: "#101016",
      doorStyle: "double",
      doorColor: "#0A0A10",
      doorFrameColor: "#171720",
      exitSignColor: "green",
      wallStyle: "panels",
      wallColor: "#0A0B10",
      wallImageUrl: "",
      ceilingStyle: "flat",
      ceilingColor: "#07080C",
      ceilingImageUrl: "",
      carpetStyle: "solid",
      carpetColor: "#0E0F16",
      carpetImageUrl: "",
      movieAmbientLevel: "deep",
      downlightsVisible: true,
      sconcesVisible: false,
      coveLedVisible: true,
      coveLedPlacement: "wall",
      coveLedColor: "cool",
      aisleLedVisible: true,
      aisleLedColor: "blue",
      aisleHandrailsVisible: true,
      rowMarkersVisible: true,
      rowMarkersPlacement: "riser",
      rowMarkersColor: "blue",
      projectorBeamVisible: true,
      projectorBeamIntensity: "subtle",
      surroundSpeakersVisible: true,
      ceilingSpeakersVisible: true,
    },
  },
  {
    id: "goldclass",
    swatches: ["#1A1815", "#FBBF24", "#1E1614"],
    patch: {
      screenBorder: "velvet",
      screenCurtainsVisible: true,
      screenCurtainsAnimated: true,
      screenCurtainsColor: "#211714",
      screenStageApron: true,
      screenStageLed: true,
      stageSubwoofersVisible: true,
      screenHalo: true,
      screenWallWash: true,
      screenContent: "cosmos",
      seatFinish: "leather",
      seatFrameColor: "#262220",
      doorStyle: "curtain",
      doorColor: "#1C1917",
      doorFrameColor: "#302A24",
      exitSignColor: "green",
      wallStyle: "slats",
      wallColor: "#1A1815",
      wallImageUrl: "",
      ceilingStyle: "starlight",
      starlightColor: "warm",
      ceilingColor: "#12100E",
      ceilingImageUrl: "",
      carpetStyle: "striped",
      carpetColor: "#1E1614",
      carpetImageUrl: "",
      movieAmbientLevel: "balanced",
      downlightsVisible: true,
      sconcesVisible: true,
      sconceColor: "warm",
      coveLedVisible: true,
      coveLedPlacement: "both",
      coveLedColor: "warm",
      aisleLedVisible: true,
      aisleLedColor: "amber",
      rowMarkersVisible: true,
      rowMarkersPlacement: "aisle",
      rowMarkersColor: "amber",
      snackPropsVisible: true,
      projectorBeamVisible: true,
      projectorBeamIntensity: "medium",
    },
  },
  {
    id: "neon",
    swatches: ["#0E1522", "#38BDF8", "#F43F5E"],
    patch: {
      screenBorder: "frameless",
      screenCurtainsVisible: false,
      screenStageApron: true,
      screenStageLed: true,
      stageSubwoofersVisible: true,
      screenHalo: true,
      screenWallWash: true,
      screenContent: "noir",
      seatFinish: "leather",
      seatFrameColor: "#111622",
      doorStyle: "double",
      doorColor: "#0B101A",
      doorFrameColor: "#1C2638",
      exitSignColor: "green",
      wallStyle: "matte",
      wallColor: "#0E1522",
      wallImageUrl: "",
      ceilingStyle: "starlight",
      starlightColor: "cool",
      ceilingColor: "#080D16",
      ceilingImageUrl: "",
      carpetStyle: "striped",
      carpetColor: "#101828",
      carpetImageUrl: "",
      movieAmbientLevel: "balanced",
      downlightsVisible: true,
      sconcesVisible: true,
      sconceColor: "cool",
      coveLedVisible: true,
      coveLedPlacement: "both",
      coveLedColor: "crimson",
      aisleLedVisible: true,
      aisleLedColor: "blue",
      aisleHandrailsVisible: true,
      rowMarkersVisible: true,
      rowMarkersPlacement: "wall",
      rowMarkersColor: "blue",
      projectorBeamVisible: true,
      projectorBeamIntensity: "vivid",
    },
  },
  {
    id: "retro",
    swatches: ["#231418", "#EF4444", "#2B0C14"],
    patch: {
      screenBorder: "velvet",
      screenCurtainsVisible: true,
      screenCurtainsAnimated: true,
      screenCurtainsColor: "#450A18",
      screenStageApron: true,
      screenStageLed: true,
      stageSubwoofersVisible: true,
      screenHalo: true,
      screenWallWash: false,
      screenContent: "cosmos",
      seatFinish: "fabric",
      seatFrameColor: "#1F1616",
      doorStyle: "curtain",
      doorColor: "#231418",
      doorFrameColor: "#332222",
      exitSignColor: "red",
      wallStyle: "panels",
      wallColor: "#1C1217",
      wallImageUrl: "",
      ceilingStyle: "coffered",
      ceilingColor: "#0E0A10",
      ceilingImageUrl: "",
      carpetStyle: "speckled",
      carpetColor: "#26121C",
      carpetImageUrl: "",
      movieAmbientLevel: "bright",
      downlightsVisible: true,
      sconcesVisible: true,
      sconceColor: "crimson",
      coveLedVisible: true,
      coveLedPlacement: "ceiling",
      coveLedColor: "warm",
      aisleLedVisible: true,
      aisleLedColor: "red",
      rowMarkersVisible: true,
      rowMarkersPlacement: "aisle",
      rowMarkersColor: "red",
      projectorBeamVisible: true,
      projectorBeamIntensity: "vivid",
    },
  },
];

export function getRoom3DPreset(id: Room3DPresetId): Room3DPreset | undefined {
  return ROOM_3D_PRESETS.find((p) => p.id === id);
}

/** Applies a curated cinema preset onto a base appearance while preserving uploaded screen media URLs & subtitle text. */
export function applyRoom3DPreset(
  base: Room3DAppearance,
  presetId: Room3DPresetId,
  options?: { keepScreenSource?: boolean },
): Room3DAppearance {
  const preset = getRoom3DPreset(presetId);
  if (!preset) return base;
  const next: Room3DAppearance = {
    ...normalizeRoom3DAppearance(base),
    ...preset.patch,
  };
  if (options?.keepScreenSource) {
    next.screenSource = base.screenSource;
    next.screenImageUrl = base.screenImageUrl;
    next.screenYoutubeUrl = base.screenYoutubeUrl;
    next.screenContent = base.screenContent;
    next.screenShowSubtitle = base.screenShowSubtitle;
    next.screenSubtitleText = base.screenSubtitleText;
    next.screenSubtitleColor = base.screenSubtitleColor;
  }
  return next;
}

/** Resolves effective 3D appearance for a cinema brand: applies brand preset over system defaults while keeping global screen media. */
export function resolveBrandRoom3DAppearance(
  systemAppearance: Room3DAppearance,
  brandPreset?: string | null,
): Room3DAppearance {
  const normalized = normalizeRoom3DAppearance(systemAppearance);
  if (!brandPreset || !(ROOM_3D_PRESET_IDS as readonly string[]).includes(brandPreset)) {
    return normalized;
  }
  return applyRoom3DPreset(normalized, brandPreset as Room3DPresetId, { keepScreenSource: true });
}

/**
 * Merges any partial or stale-cached appearance object over `DEFAULT_ROOM_3D_APPEARANCE`
 * so newly added visual fields are always safely populated on both server and client.
 */
export function normalizeRoom3DAppearance(
  raw?: Partial<Room3DAppearance> | null,
): Room3DAppearance {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ROOM_3D_APPEARANCE };
  const merged: Room3DAppearance = { ...DEFAULT_ROOM_3D_APPEARANCE };
  for (const key of Object.keys(DEFAULT_ROOM_3D_APPEARANCE) as (keyof Room3DAppearance)[]) {
    const val = raw[key];
    if (val !== undefined && val !== null) {
      (merged as unknown as Record<string, unknown>)[key] = val;
    }
  }
  return merged;
}
