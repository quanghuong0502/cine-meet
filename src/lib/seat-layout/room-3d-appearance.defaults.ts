/**
 * Pure visual/UI appearance configuration for the 3D cinema room (zero physical/scoring impact, zero Zod dependency).
 * Shared safely between server services, client settings forms, and the vanilla Three.js auditorium renderer.
 */

export type ScreenSource = "preset" | "image" | "youtube";
export type ScreenBorderStyle = "velvet" | "slim" | "frameless";
export type ScreenContentPreset = "cosmos" | "noir" | "grid";
export type SubtitleColor = "white" | "yellow";
export type SeatFinish = "fabric" | "leather";
export type DoorStyle = "single" | "double" | "curtain";
export type ExitSignColor = "green" | "red";
export type ExitSignText = "EXIT" | "LỐI RA";
export type WallStyle = "slats" | "panels" | "matte";
export type CeilingStyle = "coffered" | "flat" | "starlight";
export type CarpetStyle = "speckled" | "striped" | "solid";
export type LightAccentColor = "warm" | "neutral" | "cool" | "crimson";
export type AisleLedColor = "amber" | "white" | "blue" | "red";
export type RowMarkerPlacement = "aisle" | "wall";
export type CoveLedPlacement = "ceiling" | "wall" | "both";

export const SCREEN_SOURCES: readonly ScreenSource[] = ["preset", "image", "youtube"];
export const SCREEN_BORDER_STYLES: readonly ScreenBorderStyle[] = ["velvet", "slim", "frameless"];
export const SCREEN_CONTENT_PRESETS: readonly ScreenContentPreset[] = ["cosmos", "noir", "grid"];
export const SUBTITLE_COLORS: readonly SubtitleColor[] = ["white", "yellow"];
export const SEAT_FINISHES: readonly SeatFinish[] = ["fabric", "leather"];
export const DOOR_STYLES: readonly DoorStyle[] = ["single", "double", "curtain"];
export const EXIT_SIGN_COLORS: readonly ExitSignColor[] = ["green", "red"];
export const EXIT_SIGN_TEXTS: readonly ExitSignText[] = ["EXIT", "LỐI RA"];
export const WALL_STYLES: readonly WallStyle[] = ["slats", "panels", "matte"];
export const CEILING_STYLES: readonly CeilingStyle[] = ["coffered", "flat", "starlight"];
export const CARPET_STYLES: readonly CarpetStyle[] = ["speckled", "striped", "solid"];
export const LIGHT_ACCENT_COLORS: readonly LightAccentColor[] = ["warm", "neutral", "cool", "crimson"];
export const AISLE_LED_COLORS: readonly AisleLedColor[] = ["amber", "white", "blue", "red"];
export const ROW_MARKER_PLACEMENTS: readonly RowMarkerPlacement[] = ["aisle", "wall"];
export const COVE_LED_PLACEMENTS: readonly CoveLedPlacement[] = ["ceiling", "wall", "both"];

export const MAX_SUBTITLE_LENGTH = 80;
export const MAX_SCREEN_URL_LENGTH = 500;

export interface Room3DAppearance {
  // Screen & front stage
  screenSource: ScreenSource;
  screenBorder: ScreenBorderStyle;
  screenCurtainsVisible: boolean;
  screenCurtainsColor: string;
  screenStageApron: boolean;
  screenStageLed: boolean;
  screenHalo: boolean;
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
  // Doors & EXIT signs
  doorStyle: DoorStyle;
  doorPanicBar: boolean;
  doorColor: string;
  doorFrameColor: string;
  exitSignVisible: boolean;
  exitSignColor: ExitSignColor;
  exitSignText: ExitSignText;
  // Interior surfaces
  wallStyle: WallStyle;
  wallColor: string;
  ceilingStyle: CeilingStyle;
  ceilingColor: string;
  carpetStyle: CarpetStyle;
  carpetColor: string;
  // Lighting & cinema fixtures
  downlightsVisible: boolean;
  sconcesVisible: boolean;
  sconceColor: LightAccentColor;
  coveLedVisible: boolean;
  coveLedPlacement: CoveLedPlacement;
  coveLedColor: LightAccentColor;
  aisleLedVisible: boolean;
  aisleLedColor: AisleLedColor;
  rowMarkersVisible: boolean;
  rowMarkersPlacement: RowMarkerPlacement;
  rowMarkersColor: AisleLedColor;
  projectionPortVisible: boolean;
  projectorBeamVisible: boolean;
  surroundSpeakersVisible: boolean;
  ceilingSpeakersVisible: boolean;
}

export const DEFAULT_ROOM_3D_APPEARANCE: Room3DAppearance = {
  screenSource: "preset",
  screenBorder: "velvet",
  screenCurtainsVisible: false,
  screenCurtainsColor: "#2B0C14",
  screenStageApron: true,
  screenStageLed: true,
  screenHalo: true,
  screenContent: "cosmos",
  screenImageUrl: "",
  screenYoutubeUrl: "",
  screenShowSubtitle: true,
  screenSubtitleText: "",
  screenSubtitleColor: "white",
  seatFinish: "fabric",
  seatFrameColor: "#15131C",
  doorStyle: "single",
  doorPanicBar: true,
  doorColor: "#0A0A10",
  doorFrameColor: "#1E1C28",
  exitSignVisible: true,
  exitSignColor: "green",
  exitSignText: "EXIT",
  wallStyle: "slats",
  wallColor: "#14131D",
  ceilingStyle: "coffered",
  ceilingColor: "#0B0D14",
  carpetStyle: "speckled",
  carpetColor: "#161320",
  downlightsVisible: true,
  sconcesVisible: true,
  sconceColor: "warm",
  coveLedVisible: false,
  coveLedPlacement: "ceiling",
  coveLedColor: "warm",
  aisleLedVisible: true,
  aisleLedColor: "amber",
  rowMarkersVisible: true,
  rowMarkersPlacement: "aisle",
  rowMarkersColor: "amber",
  projectionPortVisible: true,
  projectorBeamVisible: true,
  surroundSpeakersVisible: true,
  ceilingSpeakersVisible: true,
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
