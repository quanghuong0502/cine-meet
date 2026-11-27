import { describe, expect, it } from "vitest";
import {
  applyRoom3DPreset,
  DEFAULT_ROOM_3D_APPEARANCE,
  MAX_SCREEN_URL_LENGTH,
  MAX_SUBTITLE_LENGTH,
  normalizeRoom3DAppearance,
  parseRoom3DAppearance,
  resolveBrandRoom3DAppearance,
  ROOM_3D_PRESETS,
  room3DAppearanceSchema,
} from "./room-3d-appearance";

describe("room3DAppearanceSchema", () => {
  it("parses an empty object or partial legacy payload using full defaults", () => {
    expect(parseRoom3DAppearance({})).toEqual(DEFAULT_ROOM_3D_APPEARANCE);
    expect(parseRoom3DAppearance(null)).toEqual(DEFAULT_ROOM_3D_APPEARANCE);

    const partial = parseRoom3DAppearance({
      doorStyle: "double",
      wallColor: "#1c1217",
      screenCurtainsVisible: true,
      screenCurtainsColor: "#450a18",
      coveLedVisible: true,
      coveLedPlacement: "both",
      rowMarkersPlacement: "wall",
      surroundSpeakersVisible: false,
      ceilingSpeakersVisible: false,
    });
    expect(partial.doorStyle).toBe("double");
    expect(partial.wallColor).toBe("#1C1217");
    expect(partial.screenCurtainsVisible).toBe(true);
    expect(partial.screenCurtainsColor).toBe("#450A18");
    expect(partial.coveLedVisible).toBe(true);
    expect(partial.coveLedPlacement).toBe("both");
    expect(partial.rowMarkersPlacement).toBe("wall");
    expect(partial.surroundSpeakersVisible).toBe(false);
    expect(partial.ceilingSpeakersVisible).toBe(false);
    expect(partial.screenSource).toBe("preset");
    expect(partial.screenImageUrl).toBe("");
    expect(partial.screenYoutubeUrl).toBe("");
    expect(partial.screenBorder).toBe(DEFAULT_ROOM_3D_APPEARANCE.screenBorder);
    expect(partial.ceilingStyle).toBe(DEFAULT_ROOM_3D_APPEARANCE.ceilingStyle);

    // Stale cached payload missing newly added fields must normalize cleanly with full defaults.
    const normalized = normalizeRoom3DAppearance({ wallColor: "#111111" } as Partial<typeof DEFAULT_ROOM_3D_APPEARANCE>);
    expect(normalized.wallColor).toBe("#111111");
    expect(normalized.coveLedColor).toBe(DEFAULT_ROOM_3D_APPEARANCE.coveLedColor);
    expect(normalized.rowMarkersColor).toBe(DEFAULT_ROOM_3D_APPEARANCE.rowMarkersColor);
    expect(normalized.screenCurtainsColor).toBe(DEFAULT_ROOM_3D_APPEARANCE.screenCurtainsColor);
  });

  it("validates uploaded image URLs and YouTube video links cleanly", () => {
    expect(
      room3DAppearanceSchema.safeParse({
        screenSource: "image",
        screenImageUrl: "https://res.cloudinary.com/demo/image/upload/v1/room-3d-screens/hero.jpg",
      }).success,
    ).toBe(true);
    expect(room3DAppearanceSchema.safeParse({ screenSource: "image", screenImageUrl: "" }).success).toBe(true);
    expect(
      room3DAppearanceSchema.safeParse({ screenSource: "image", screenImageUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ screenSource: "image", screenImageUrl: "not-a-url" }).success).toBe(false);

    // Custom surface texture URLs & repeat counts (wall, ceiling, carpet/floor)
    expect(
      room3DAppearanceSchema.safeParse({
        wallImageUrl: "https://res.cloudinary.com/demo/image/upload/v1/room-3d-textures/wood-slats.jpg",
        wallImageRepeat: 1,
        ceilingImageUrl: "https://res.cloudinary.com/demo/image/upload/v1/room-3d-textures/acoustic-tile.jpg",
        ceilingImageRepeat: 3,
        carpetImageUrl: "https://res.cloudinary.com/demo/image/upload/v1/room-3d-textures/red-carpet.jpg",
        carpetImageRepeat: 6,
      }).success,
    ).toBe(true);
    expect(room3DAppearanceSchema.safeParse({ carpetImageRepeat: 0 }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ wallImageRepeat: 13 }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ ceilingImageRepeat: 2.5 }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ wallImageUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ ceilingImageUrl: "ftp://example.com/a.jpg" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ carpetImageUrl: "bad-url" }).success).toBe(false);

    expect(
      room3DAppearanceSchema.safeParse({
        screenSource: "youtube",
        screenYoutubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }).success,
    ).toBe(true);
    expect(
      room3DAppearanceSchema.safeParse({ screenSource: "youtube", screenYoutubeUrl: "https://youtu.be/dQw4w9WgXcQ" })
        .success,
    ).toBe(true);
    expect(
      room3DAppearanceSchema.safeParse({ screenSource: "youtube", screenYoutubeUrl: "dQw4w9WgXcQ" }).success,
    ).toBe(true);
    expect(room3DAppearanceSchema.safeParse({ screenSource: "youtube", screenYoutubeUrl: "" }).success).toBe(true);
    expect(
      room3DAppearanceSchema.safeParse({ screenSource: "youtube", screenYoutubeUrl: "https://vimeo.com/123456" })
        .success,
    ).toBe(false);
    expect(
      room3DAppearanceSchema.safeParse({ screenSource: "youtube", screenYoutubeUrl: "not-a-valid-youtube-link" })
        .success,
    ).toBe(false);
  });

  it("rejects malformed hex colors, unknown enum values, and oversized fields", () => {
    expect(room3DAppearanceSchema.safeParse({ wallColor: "red" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ wallColor: "#FFF" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ doorStyle: "sliding" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ screenSource: "vimeo" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ rowMarkersPlacement: "step" }).success).toBe(true);
    expect(room3DAppearanceSchema.safeParse({ rowMarkersPlacement: "riser" }).success).toBe(true);
    expect(room3DAppearanceSchema.safeParse({ rowMarkersPlacement: "aisle" }).success).toBe(true);
    expect(room3DAppearanceSchema.safeParse({ rowMarkersPlacement: "wall" }).success).toBe(true);
    expect(room3DAppearanceSchema.safeParse({ rowMarkersPlacement: "floor" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ coveLedPlacement: "floor" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ screenCurtainsColor: "burgundy" }).success).toBe(false);
    expect(
      room3DAppearanceSchema.safeParse({ screenSubtitleText: "x".repeat(MAX_SUBTITLE_LENGTH + 1) }).success,
    ).toBe(false);
    expect(
      room3DAppearanceSchema.safeParse({
        screenImageUrl: `https://example.com/${"a".repeat(MAX_SCREEN_URL_LENGTH)}`,
      }).success,
    ).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ screenMasking: "imax" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ starlightColor: "green" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ movieAmbientLevel: "pitch" }).success).toBe(false);
    expect(room3DAppearanceSchema.safeParse({ projectorBeamIntensity: "ultra" }).success).toBe(false);
  });

  it("applies curated cinema presets and resolves per-brand overrides while preserving global screen media", () => {
    for (const preset of ROOM_3D_PRESETS) {
      const applied = applyRoom3DPreset(DEFAULT_ROOM_3D_APPEARANCE, preset.id);
      expect(room3DAppearanceSchema.safeParse(applied).success).toBe(true);
    }

    const withYoutube = parseRoom3DAppearance({
      screenSource: "youtube",
      screenYoutubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      screenSubtitleText: "Custom line",
    });
    const brandResolved = resolveBrandRoom3DAppearance(withYoutube, "goldclass");
    expect(brandResolved.ceilingStyle).toBe("starlight");
    expect(brandResolved.starlightColor).toBe("warm");
    expect(brandResolved.seatFinish).toBe("leather");
    // Global screen media stays intact across brand themes
    expect(brandResolved.screenSource).toBe("youtube");
    expect(brandResolved.screenYoutubeUrl).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(brandResolved.screenSubtitleText).toBe("Custom line");

    // Unknown or missing brand preset falls back cleanly to system defaults
    expect(resolveBrandRoom3DAppearance(withYoutube, null)).toEqual(withYoutube);
    expect(resolveBrandRoom3DAppearance(withYoutube, "unknown-preset")).toEqual(withYoutube);
  });
});
