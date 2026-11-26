import { z } from "zod";
import { parseYoutubeId } from "@/lib/movie/youtube";
import {
  AISLE_LED_COLORS,
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
  ROW_MARKER_PLACEMENTS,
  SCREEN_BORDER_STYLES,
  SCREEN_CONTENT_PRESETS,
  SCREEN_SOURCES,
  SEAT_FINISHES,
  SUBTITLE_COLORS,
  WALL_STYLES,
  type Room3DAppearance,
} from "./room-3d-appearance.defaults";

export {
  AISLE_LED_COLORS,
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
  normalizeRoom3DAppearance,
  ROOM_3D_COLOR_SWATCHES,
  ROW_MARKER_PLACEMENTS,
  SCREEN_BORDER_STYLES,
  SCREEN_CONTENT_PRESETS,
  SCREEN_SOURCES,
  SEAT_FINISHES,
  SUBTITLE_COLORS,
  WALL_STYLES,
  type AisleLedColor,
  type CarpetStyle,
  type CeilingStyle,
  type CoveLedPlacement,
  type DoorStyle,
  type ExitSignColor,
  type ExitSignText,
  type LightAccentColor,
  type Room3DAppearance,
  type RowMarkerPlacement,
  type ScreenBorderStyle,
  type ScreenContentPreset,
  type ScreenSource,
  type SeatFinish,
  type SubtitleColor,
  type WallStyle,
} from "./room-3d-appearance.defaults";

const hexColor = (fallback: string) =>
  z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .transform((s) => s.toUpperCase())
    .default(fallback);

const d = DEFAULT_ROOM_3D_APPEARANCE;

const isHttpUrl = (value: string) => {
  if (value === "") return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

/**
 * Zod schema for system-wide 3D room visual appearance.
 * Every field carries `.default(...)` so partial or older stored JSON documents parse cleanly without migration.
 */
export const room3DAppearanceSchema = z.object({
  screenSource: z.enum(SCREEN_SOURCES).default(d.screenSource),
  screenBorder: z.enum(SCREEN_BORDER_STYLES).default(d.screenBorder),
  screenCurtainsVisible: z.boolean().default(d.screenCurtainsVisible),
  screenCurtainsColor: hexColor(d.screenCurtainsColor),
  screenStageApron: z.boolean().default(d.screenStageApron),
  screenStageLed: z.boolean().default(d.screenStageLed),
  screenHalo: z.boolean().default(d.screenHalo),
  screenContent: z.enum(SCREEN_CONTENT_PRESETS).default(d.screenContent),
  screenImageUrl: z.string().trim().max(MAX_SCREEN_URL_LENGTH).refine(isHttpUrl).default(d.screenImageUrl),
  screenYoutubeUrl: z
    .string()
    .trim()
    .max(MAX_SCREEN_URL_LENGTH)
    .refine((value) => value === "" || parseYoutubeId(value) !== null)
    .default(d.screenYoutubeUrl),
  screenShowSubtitle: z.boolean().default(d.screenShowSubtitle),
  screenSubtitleText: z.string().trim().max(MAX_SUBTITLE_LENGTH).default(d.screenSubtitleText),
  screenSubtitleColor: z.enum(SUBTITLE_COLORS).default(d.screenSubtitleColor),

  seatFinish: z.enum(SEAT_FINISHES).default(d.seatFinish),
  seatFrameColor: hexColor(d.seatFrameColor),

  doorStyle: z.enum(DOOR_STYLES).default(d.doorStyle),
  doorPanicBar: z.boolean().default(d.doorPanicBar),
  doorColor: hexColor(d.doorColor),
  doorFrameColor: hexColor(d.doorFrameColor),
  exitSignVisible: z.boolean().default(d.exitSignVisible),
  exitSignColor: z.enum(EXIT_SIGN_COLORS).default(d.exitSignColor),
  exitSignText: z.enum(EXIT_SIGN_TEXTS).default(d.exitSignText),

  wallStyle: z.enum(WALL_STYLES).default(d.wallStyle),
  wallColor: hexColor(d.wallColor),
  ceilingStyle: z.enum(CEILING_STYLES).default(d.ceilingStyle),
  ceilingColor: hexColor(d.ceilingColor),
  carpetStyle: z.enum(CARPET_STYLES).default(d.carpetStyle),
  carpetColor: hexColor(d.carpetColor),

  downlightsVisible: z.boolean().default(d.downlightsVisible),
  sconcesVisible: z.boolean().default(d.sconcesVisible),
  sconceColor: z.enum(LIGHT_ACCENT_COLORS).default(d.sconceColor),
  coveLedVisible: z.boolean().default(d.coveLedVisible),
  coveLedPlacement: z.enum(COVE_LED_PLACEMENTS).default(d.coveLedPlacement),
  coveLedColor: z.enum(LIGHT_ACCENT_COLORS).default(d.coveLedColor),
  aisleLedVisible: z.boolean().default(d.aisleLedVisible),
  aisleLedColor: z.enum(AISLE_LED_COLORS).default(d.aisleLedColor),
  rowMarkersVisible: z.boolean().default(d.rowMarkersVisible),
  rowMarkersPlacement: z.enum(ROW_MARKER_PLACEMENTS).default(d.rowMarkersPlacement),
  rowMarkersColor: z.enum(AISLE_LED_COLORS).default(d.rowMarkersColor),
  projectionPortVisible: z.boolean().default(d.projectionPortVisible),
  projectorBeamVisible: z.boolean().default(d.projectorBeamVisible),
  surroundSpeakersVisible: z.boolean().default(d.surroundSpeakersVisible),
  ceilingSpeakersVisible: z.boolean().default(d.ceilingSpeakersVisible),
});

export function parseRoom3DAppearance(raw: unknown): Room3DAppearance {
  const parsed = room3DAppearanceSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_ROOM_3D_APPEARANCE;
}
