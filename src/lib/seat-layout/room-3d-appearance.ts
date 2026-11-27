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
  MAX_SURFACE_IMAGE_REPEAT,
  MIN_SURFACE_IMAGE_REPEAT,
  MOVIE_AMBIENT_LEVELS,
  PROJECTOR_BEAM_INTENSITIES,
  ROW_MARKER_PLACEMENTS,
  SCREEN_BORDER_STYLES,
  SCREEN_CONTENT_PRESETS,
  SCREEN_MASKINGS,
  SCREEN_SOURCES,
  SEAT_FINISHES,
  STARLIGHT_COLORS,
  SUBTITLE_COLORS,
  WALL_STYLES,
  type Room3DAppearance,
} from "./room-3d-appearance.defaults";

export {
  AISLE_LED_COLORS,
  applyRoom3DPreset,
  CARPET_STYLES,
  CEILING_STYLES,
  COVE_LED_PLACEMENTS,
  DEFAULT_ROOM_3D_APPEARANCE,
  DOOR_STYLES,
  EXIT_SIGN_COLORS,
  EXIT_SIGN_TEXTS,
  getRoom3DPreset,
  LIGHT_ACCENT_COLORS,
  MAX_SCREEN_URL_LENGTH,
  MAX_SUBTITLE_LENGTH,
  MAX_SURFACE_IMAGE_REPEAT,
  MIN_SURFACE_IMAGE_REPEAT,
  MOVIE_AMBIENT_LEVELS,
  normalizeRoom3DAppearance,
  PROJECTOR_BEAM_INTENSITIES,
  resolveBrandRoom3DAppearance,
  ROOM_3D_COLOR_SWATCHES,
  ROOM_3D_PRESET_IDS,
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
  type AisleLedColor,
  type CarpetStyle,
  type CeilingStyle,
  type CoveLedPlacement,
  type DoorStyle,
  type ExitSignColor,
  type ExitSignText,
  type LightAccentColor,
  type MovieAmbientLevel,
  type ProjectorBeamIntensity,
  type Room3DAppearance,
  type Room3DPreset,
  type Room3DPresetId,
  type RowMarkerPlacement,
  type ScreenBorderStyle,
  type ScreenContentPreset,
  type ScreenMasking,
  type ScreenSource,
  type SeatFinish,
  type StarlightColor,
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
  screenMasking: z.enum(SCREEN_MASKINGS).default(d.screenMasking),
  screenCurtainsVisible: z.boolean().default(d.screenCurtainsVisible),
  screenCurtainsAnimated: z.boolean().default(d.screenCurtainsAnimated),
  screenCurtainsColor: hexColor(d.screenCurtainsColor),
  screenStageApron: z.boolean().default(d.screenStageApron),
  screenStageLed: z.boolean().default(d.screenStageLed),
  stageSubwoofersVisible: z.boolean().default(d.stageSubwoofersVisible),
  screenHalo: z.boolean().default(d.screenHalo),
  screenWallWash: z.boolean().default(d.screenWallWash),
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
  seatNumbersVisible: z.boolean().default(d.seatNumbersVisible),
  snackPropsVisible: z.boolean().default(d.snackPropsVisible),

  doorStyle: z.enum(DOOR_STYLES).default(d.doorStyle),
  doorPanicBar: z.boolean().default(d.doorPanicBar),
  doorColor: hexColor(d.doorColor),
  doorFrameColor: hexColor(d.doorFrameColor),
  exitSignVisible: z.boolean().default(d.exitSignVisible),
  exitSignColor: z.enum(EXIT_SIGN_COLORS).default(d.exitSignColor),
  exitSignText: z.enum(EXIT_SIGN_TEXTS).default(d.exitSignText),
  roomSignVisible: z.boolean().default(d.roomSignVisible),
  emergencyLightsVisible: z.boolean().default(d.emergencyLightsVisible),

  wallStyle: z.enum(WALL_STYLES).default(d.wallStyle),
  wallColor: hexColor(d.wallColor),
  wallImageUrl: z.string().trim().max(MAX_SCREEN_URL_LENGTH).refine(isHttpUrl).default(d.wallImageUrl),
  wallImageRepeat: z.number().int().min(MIN_SURFACE_IMAGE_REPEAT).max(MAX_SURFACE_IMAGE_REPEAT).default(d.wallImageRepeat),
  ceilingStyle: z.enum(CEILING_STYLES).default(d.ceilingStyle),
  starlightColor: z.enum(STARLIGHT_COLORS).default(d.starlightColor),
  ceilingColor: hexColor(d.ceilingColor),
  ceilingImageUrl: z.string().trim().max(MAX_SCREEN_URL_LENGTH).refine(isHttpUrl).default(d.ceilingImageUrl),
  ceilingImageRepeat: z
    .number()
    .int()
    .min(MIN_SURFACE_IMAGE_REPEAT)
    .max(MAX_SURFACE_IMAGE_REPEAT)
    .default(d.ceilingImageRepeat),
  ceilingDetailsVisible: z.boolean().default(d.ceilingDetailsVisible),
  carpetStyle: z.enum(CARPET_STYLES).default(d.carpetStyle),
  carpetColor: hexColor(d.carpetColor),
  carpetImageUrl: z.string().trim().max(MAX_SCREEN_URL_LENGTH).refine(isHttpUrl).default(d.carpetImageUrl),
  carpetImageRepeat: z
    .number()
    .int()
    .min(MIN_SURFACE_IMAGE_REPEAT)
    .max(MAX_SURFACE_IMAGE_REPEAT)
    .default(d.carpetImageRepeat),

  movieAmbientLevel: z.enum(MOVIE_AMBIENT_LEVELS).default(d.movieAmbientLevel),
  downlightsVisible: z.boolean().default(d.downlightsVisible),
  sconcesVisible: z.boolean().default(d.sconcesVisible),
  sconceColor: z.enum(LIGHT_ACCENT_COLORS).default(d.sconceColor),
  coveLedVisible: z.boolean().default(d.coveLedVisible),
  coveLedPlacement: z.enum(COVE_LED_PLACEMENTS).default(d.coveLedPlacement),
  coveLedColor: z.enum(LIGHT_ACCENT_COLORS).default(d.coveLedColor),
  aisleLedVisible: z.boolean().default(d.aisleLedVisible),
  aisleLedColor: z.enum(AISLE_LED_COLORS).default(d.aisleLedColor),
  aisleHandrailsVisible: z.boolean().default(d.aisleHandrailsVisible),
  rowMarkersVisible: z.boolean().default(d.rowMarkersVisible),
  rowMarkersPlacement: z.enum(ROW_MARKER_PLACEMENTS).default(d.rowMarkersPlacement),
  rowMarkersColor: z.enum(AISLE_LED_COLORS).default(d.rowMarkersColor),
  projectionPortVisible: z.boolean().default(d.projectionPortVisible),
  projectorBeamVisible: z.boolean().default(d.projectorBeamVisible),
  projectorBeamIntensity: z.enum(PROJECTOR_BEAM_INTENSITIES).default(d.projectorBeamIntensity),
  surroundSpeakersVisible: z.boolean().default(d.surroundSpeakersVisible),
  ceilingSpeakersVisible: z.boolean().default(d.ceilingSpeakersVisible),
  fourDxWallPropsVisible: z.boolean().default(d.fourDxWallPropsVisible),
});

export function parseRoom3DAppearance(raw: unknown): Room3DAppearance {
  const parsed = room3DAppearanceSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_ROOM_3D_APPEARANCE;
}
