import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CubicBezierCurve3,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Euler,
  Fog,
  FrontSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoBlending,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Raycaster,
  RepeatWrapping,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TOUCH,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { parseYoutubeId, youtubeEmbedUrl } from "@/lib/movie/youtube";
import type { RoomScene, SceneSeat } from "@/lib/seat-layout/scene";
import {
  normalizeRoom3DAppearance,
  type AisleLedColor,
  type CarpetStyle,
  type CeilingStyle,
  type ExitSignColor,
  type ExitSignText,
  type LightAccentColor,
  type Room3DAppearance,
  type ScreenContentPreset,
  type SubtitleColor,
  type WallStyle,
} from "@/lib/seat-layout/room-3d-appearance.defaults";
import type { SeatStyle } from "@/lib/seat-layout/types";
import { EYE_HEIGHT_M, HEAD_ABOVE_EYE_M, sittingEyeHeightM } from "@/services/seat-score";
import { heatColor, heatLevel } from "./heat-color";

/**
 * Cinematic vanilla three.js auditorium renderer engineered for iPhone standalone PWA stability:
 * - Lazy-loaded via `import()` so `three` stays out of initial page JS.
 * - `antialias: false`, `powerPreference: "default"`, pixel ratio capped at 2.
 * - On-demand rendering (no continuous rAF loop; frames render only while dragging, orbiting, or during short camera/light tweens).
 * - Full recovery from `webglcontextlost` / `webglcontextrestored`, `document.hidden`, and explicit `forceContextLoss()` on dispose.
 * - Architectural cinema interior: ACES filmic tone mapping, sculpted beveled multi-material chairs with baked vertical AO,
 *   procedural acoustic walls, coffered ceiling with recessed downlights, warm sconce wall-wash halos, volumetric projector beam,
 *   interactive house-lights dimmer, inside-the-room overview framing, and smooth parabolic fly-to-seat camera transitions.
 */

export type Room3DMode = "orbit" | "seat";
export type SeatMarkKind3D = "favorite" | "avoid";

export interface Room3D {
  setMode: (mode: Room3DMode) => void;
  recenter: () => void;
  setHeat: (on: boolean) => void;
  setSelected: (code: string | null) => void;
  setAudience: (on: boolean) => void;
  setLightsUp: (on: boolean) => void;
  setHeights: (viewerHeightCm: number, frontHeightCm: number) => void;
  setMarks: (marks: Map<string, SeatMarkKind3D> | undefined) => void;
  /** Updates auditorium visual UI/fixtures in-place inside the same WebGL context (preserves camera pose). */
  setAppearance: (appearance: Room3DAppearance) => void;
  /** Mutes or unmutes the active YouTube cinema screen iframe (no-op when not in YouTube mode). */
  setYoutubeMuted: (muted: boolean) => void;
  /** Reparents the live WebGL canvas without losing GPU context (used for inline ↔ fullscreen transitions). */
  mountTo: (target: HTMLElement) => void;
  refit: () => void;
  dispose: () => void;
}

export interface Room3DOptions {
  range: { min: number; max: number };
  heat: boolean;
  selected: string | null;
  initialMode?: Room3DMode;
  audience: boolean;
  lightsUp: boolean;
  viewerHeightCm: number;
  frontHeightCm: number;
  marks?: Map<string, SeatMarkKind3D>;
  subtitleText?: string;
  appearance?: Room3DAppearance;
  youtubeMuted?: boolean;
  onPick: (code: string) => void;
  onHover?: (code: string | null) => void;
  /** Called when WebGL cannot start or is permanently lost. */
  onFailed: () => void;
}

const MAX_PIXEL_RATIO = 2;
/** Leave touches near the left edge to iOS's swipe-back gesture. */
const EDGE_GUARD_PX = 20;
const RESIZE_DEBOUNCE_MS = 100;
const TAP_MAX_MOVE_PX = 6;
const LOOK_SPEED = 0.0042;
const LOOK_LIMIT_YAW = (75 * Math.PI) / 180;
const LOOK_LIMIT_PITCH = (38 * Math.PI) / 180;
const HEAT_STEPS = 16;
const ORBIT_FOV = 54;
const SEAT_FOV = 60;
const FLIGHT_MS = 480;
const DIMMER_MS = 340;

const DEFAULT_SEAT_COLOR = 0x8e1e36;
const BROKEN_COLOR = 0x242029;
const SELECTED_ACCENT = 0xf43f5e;
const HOVER_ACCENT = 0xfde047;
const FAVORITE_MARK_COLOR = 0xf5b800;
const AVOID_MARK_COLOR = 0xef4444;

/** Converts OKLab (L in 0..1, a, b) to a clamped 24-bit sRGB integer. */
function oklabToHex(L: number, a: number, b: number): number {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const toSrgb = (v: number) => {
    const c = Math.max(0, Math.min(1, v));
    return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
  };
  const r = toSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return (r << 16) | (g << 8) | bl;
}

/** Converts OKLCH (L in 0..1, C >= 0, H in degrees) to a clamped 24-bit sRGB integer. */
function oklchToHex(L: number, C: number, hDeg: number): number {
  const h = (hDeg * Math.PI) / 180;
  return oklabToHex(L, C * Math.cos(h), C * Math.sin(h));
}

const cssHexCache = new Map<string, number>();
let cssFallbackCtx: CanvasRenderingContext2D | null | undefined;

function parseHexOrRgb(raw: string): number | null {
  const trimmed = raw.trim();
  const hex6 = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (hex6) return Number.parseInt(hex6[1], 16);
  const hex3 = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (hex3) {
    const [r, g, b] = hex3[1];
    return Number.parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
  }
  const rgb = /^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)/i.exec(trimmed);
  if (rgb) {
    const r = Math.round(Math.max(0, Math.min(255, Number(rgb[1]))));
    const g = Math.round(Math.max(0, Math.min(255, Number(rgb[2]))));
    const b = Math.round(Math.max(0, Math.min(255, Number(rgb[3]))));
    return (r << 16) | (g << 8) | b;
  }
  return null;
}

/** Resolves any CSS colour (including `color-mix`, `oklch`, `oklab`, `color(srgb ...)`, and `--brand-h`) to a 24-bit sRGB integer. */
function cssToHex(css: string, fallback = DEFAULT_SEAT_COLOR): number {
  const direct = parseHexOrRgb(css);
  if (direct !== null) return direct;

  const themeKey = `${document.documentElement.className}|${document.documentElement.style.cssText}|${css}`;
  const cached = cssHexCache.get(themeKey);
  if (cached !== undefined) return cached;

  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = css;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();

  let hex = parseHexOrRgb(resolved);
  if (hex === null) {
    const oklchMatch = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i.exec(resolved);
    if (oklchMatch) {
      const L = oklchMatch[2] === "%" ? Number(oklchMatch[1]) / 100 : Number(oklchMatch[1]);
      hex = oklchToHex(L, Number(oklchMatch[3]), Number(oklchMatch[4]));
    }
  }
  if (hex === null) {
    const oklabMatch = /oklab\(\s*([\d.]+)(%?)\s+([-\d.]+)\s+([-\d.]+)/i.exec(resolved);
    if (oklabMatch) {
      const L = oklabMatch[2] === "%" ? Number(oklabMatch[1]) / 100 : Number(oklabMatch[1]);
      hex = oklabToHex(L, Number(oklabMatch[3]), Number(oklabMatch[4]));
    }
  }
  if (hex === null) {
    const srgbMatch = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(resolved);
    if (srgbMatch) {
      const r = Math.round(Math.max(0, Math.min(1, Number(srgbMatch[1]))) * 255);
      const g = Math.round(Math.max(0, Math.min(1, Number(srgbMatch[2]))) * 255);
      const b = Math.round(Math.max(0, Math.min(1, Number(srgbMatch[3]))) * 255);
      hex = (r << 16) | (g << 8) | b;
    }
  }
  if (hex === null) {
    if (cssFallbackCtx === undefined) {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      cssFallbackCtx = c.getContext("2d", { willReadFrequently: true });
    }
    if (!cssFallbackCtx) return fallback;
    cssFallbackCtx.fillStyle = "#ff00ff";
    cssFallbackCtx.fillStyle = resolved;
    if (cssFallbackCtx.fillStyle === "#ff00ff" && !/ff00ff|magenta|255,\s*0,\s*255/i.test(resolved)) {
      return fallback;
    }
    cssFallbackCtx.fillRect(0, 0, 1, 1);
    const [r, g, b] = cssFallbackCtx.getImageData(0, 0, 1, 1).data;
    hex = (r << 16) | (g << 8) | b;
  }

  if (cssHexCache.size > 128) cssHexCache.clear();
  cssHexCache.set(themeKey, hex);
  return hex;
}

/**
 * Keeps horizontal framing generous on narrow portrait phone screens (iPhone 13/14 Pro) by widening vertical FOV
 * cleanly when aspect < 1.2 so the entire cinema screen & side architecture never get cropped off.
 */
function adaptiveFov(baseFov: number, aspect: number, minHorizontalDeg: number): number {
  if (aspect >= 1.25 || aspect <= 0.1) return baseFov;
  const minHRad = (minHorizontalDeg * Math.PI) / 180;
  const neededVRad = 2 * Math.atan(Math.tan(minHRad / 2) / aspect);
  const neededVDeg = (neededVRad * 180) / Math.PI;
  return Math.min(92, Math.max(baseFov, neededVDeg));
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function normalizePart(geom: BufferGeometry): BufferGeometry {
  const out = geom.index ? geom.toNonIndexed() : geom;
  if (out !== geom) geom.dispose();
  if (!out.getAttribute("normal")) out.computeVertexNormals();
  if (!out.getAttribute("uv")) {
    const count = out.getAttribute("position").count;
    out.setAttribute("uv", new BufferAttribute(new Float32Array(count * 2), 2));
  }
  return out;
}

function roundedPart(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  rotX = 0,
): BufferGeometry {
  const r = Math.min(radius, w * 0.45, h * 0.45, d * 0.45);
  const g = new RoundedBoxGeometry(w, h, d, 1, r);
  if (rotX !== 0) g.rotateX(rotX);
  g.translate(x, y, z);
  return normalizePart(g);
}

function boxPart(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotX = 0,
): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  if (rotX !== 0) g.rotateX(rotX);
  g.translate(x, y, z);
  return normalizePart(g);
}

/**
 * Bakes subtle vertical & crease ambient occlusion into vertex colours so chairs read with plush
 * cinema depth and sculpted edges under any lighting or heatmap tint — at zero runtime shader cost.
 */
function bakeVerticalAO(geometry: BufferGeometry, minY: number, maxY: number, minAO = 0.46): BufferGeometry {
  const pos = geometry.getAttribute("position");
  const norm = geometry.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const span = Math.max(0.01, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = norm ? norm.getY(i) : 0;
    const t = Math.min(1, Math.max(0, (y - minY) / span));
    const smooth = t * t * (3 - 2 * t);
    let ao = minAO + (1 - minAO) * smooth;
    // Slight crease darkening where the backrest meets the seat cushion.
    if (y > 0.34 && y < 0.56 && z > 0.08) ao *= 0.86;
    // Soft upward catch-light on top surfaces (headrest ridge, cushion top).
    if (ny > 0.55) ao = Math.min(1, ao * 1.07);
    colors[i * 3] = ao;
    colors[i * 3 + 1] = ao;
    colors[i * 3 + 2] = ao;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

function mergeParts(parts: BufferGeometry[], fallback: BufferGeometry): BufferGeometry {
  if (parts.length === 0) return fallback;
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) return fallback;
  fallback.dispose();
  return merged;
}

interface ChairGeometries {
  fabric: BufferGeometry;
  frame: BufferGeometry;
}

/**
 * Sculpted multi-material cinema chair facing `-z` (toward the screen), sitting on `y = 0`, centred at `x = 0, z = 0`.
 * Splits plush beveled upholstery (`fabric`) from dark matte pedestals/armrests (`frame`) so every seat reads
 * distinctly in both cinema lighting and heatmap mode, calibrated to Ferco / Figueras dimensions.
 */
function buildChairGeometries(
  style: SeatStyle,
  reclineDeg: number,
  seatPitchM: number,
  rowPitchM: number,
): ChairGeometries {
  const w = seatPitchM * 0.98;
  const tilt = (reclineDeg * Math.PI) / 180;
  const fabricParts: BufferGeometry[] = [];
  const frameParts: BufferGeometry[] = [];

  if (style === "bed") {
    const bedW = seatPitchM * 0.96;
    const bedD = Math.min(rowPitchM * 0.86, 1.45);
    // Low dark architectural plinth
    frameParts.push(boxPart(bedW * 0.96, 0.14, bedD * 0.96, 0, 0.07, -0.04));
    // Plush mattress + duvet throw + angled headboard bolster + pillow
    fabricParts.push(roundedPart(bedW, 0.24, bedD, 0, 0.26, -0.04, 0.055));
    fabricParts.push(roundedPart(bedW * 0.98, 0.09, bedD * 0.64, 0, 0.41, -0.17, 0.038));
    fabricParts.push(roundedPart(bedW * 0.94, 0.52, 0.17, 0, 0.59, bedD / 2 - 0.15, 0.06, 0.36));
    fabricParts.push(roundedPart(bedW * 0.72, 0.14, 0.22, 0, 0.47, bedD / 2 - 0.28, 0.05, 0.25));
  } else if (style === "recliner") {
    // Luxury recliner (Ferco Verona/Milano ~1.09 m upright, ~1.07 m at 28° deep recline)
    const cushionH = 0.46;
    const seatD = 0.58;
    const armW = 0.092;
    const innerW = w - armW * 1.4;
    const backH = 0.72;
    const backTilt = Math.max(tilt, 0.32);

    // Matte dark recliner base + wide sculpted console armrests with cupholder ring
    frameParts.push(boxPart(w * 0.78, 0.24, seatD * 0.86, 0, 0.12, 0.02));
    frameParts.push(roundedPart(armW, 0.44, seatD + 0.08, -(w - armW) / 2, 0.36, 0, 0.028));
    frameParts.push(roundedPart(armW, 0.44, seatD + 0.08, (w - armW) / 2, 0.36, 0, 0.028));

    // Plush seat, angled footrest, two-tier ergonomic backrest + plump headrest pillow
    fabricParts.push(roundedPart(innerW, 0.18, seatD, 0, cushionH - 0.09, -0.02, 0.055, -0.05));
    fabricParts.push(roundedPart(innerW * 0.94, 0.12, 0.3, 0, 0.25, -seatD / 2 - 0.11, 0.04, -0.46));
    fabricParts.push(
      roundedPart(
        innerW,
        backH * 0.68,
        0.14,
        0,
        cushionH + (backH * 0.34) * Math.cos(backTilt) - 0.04,
        seatD / 2 - 0.04 + (backH * 0.34) * Math.sin(backTilt),
        0.055,
        backTilt,
      ),
    );
    fabricParts.push(
      roundedPart(
        innerW * 0.92,
        0.25,
        0.16,
        0,
        cushionH + (backH - 0.11) * Math.cos(backTilt) - 0.02,
        seatD / 2 - 0.06 + (backH - 0.11) * Math.sin(backTilt),
        0.065,
        backTilt - 0.08,
      ),
    );
  } else if (style === "vip") {
    // High-back VIP cinema chair (Ferco/Figueras 1,050–1,080 mm total height)
    const cushionH = 0.45;
    const seatD = 0.52;
    const armW = 0.072;
    const innerW = w - armW * 1.55;
    const backH = 0.66;

    // Dark pedestal, stanchions, sculpted shared armrests
    frameParts.push(boxPart(w * 0.56, 0.26, 0.32, 0, 0.13, 0.06));
    frameParts.push(roundedPart(armW * 0.72, 0.44, seatD * 0.88, -(w - armW) / 2, 0.34, 0.02, 0.018));
    frameParts.push(roundedPart(armW * 0.72, 0.44, seatD * 0.88, (w - armW) / 2, 0.34, 0.02, 0.018));
    frameParts.push(roundedPart(armW, 0.065, seatD + 0.04, -(w - armW) / 2, 0.58, 0.0, 0.024));
    frameParts.push(roundedPart(armW, 0.065, seatD + 0.04, (w - armW) / 2, 0.58, 0.0, 0.024));

    // Deep plush cushion, contoured backrest, headrest bolster
    fabricParts.push(roundedPart(innerW, 0.15, seatD, 0, cushionH - 0.075, -0.01, 0.05, -0.04));
    fabricParts.push(
      roundedPart(
        innerW,
        backH,
        0.125,
        0,
        cushionH + (backH / 2) * Math.cos(tilt) - 0.04,
        seatD / 2 - 0.03 + (backH / 2) * Math.sin(tilt),
        0.05,
        tilt,
      ),
    );
    fabricParts.push(
      roundedPart(
        innerW * 0.78,
        0.17,
        0.145,
        0,
        cushionH + (backH - 0.06) * Math.cos(tilt) - 0.01,
        seatD / 2 - 0.055 + (backH - 0.06) * Math.sin(tilt),
        0.055,
        tilt - 0.06,
      ),
    );
  } else {
    // Modern multiplex high-back cinema chair (Ferco/Figueras: cushion 44 cm, high-back 1.02 m)
    const cushionH = 0.44;
    const seatD = 0.48;
    const armW = 0.058;
    const innerW = w - armW * 1.65;
    const backH = 0.64;

    frameParts.push(boxPart(w * 0.46, 0.27, 0.24, 0, 0.135, 0.06));
    frameParts.push(roundedPart(armW * 0.68, 0.42, seatD * 0.84, -(w - armW) / 2, 0.33, 0.02, 0.014));
    frameParts.push(roundedPart(armW * 0.68, 0.42, seatD * 0.84, (w - armW) / 2, 0.33, 0.02, 0.014));
    frameParts.push(roundedPart(armW, 0.055, seatD + 0.04, -(w - armW) / 2, 0.56, 0.0, 0.02));
    frameParts.push(roundedPart(armW, 0.055, seatD + 0.04, (w - armW) / 2, 0.56, 0.0, 0.02));

    fabricParts.push(roundedPart(innerW, 0.135, seatD, 0, cushionH - 0.068, -0.01, 0.048, -0.04));
    fabricParts.push(
      roundedPart(
        innerW,
        backH,
        0.11,
        0,
        cushionH + (backH / 2) * Math.cos(tilt) - 0.04,
        seatD / 2 - 0.025 + (backH / 2) * Math.sin(tilt),
        0.048,
        tilt,
      ),
    );
  }

  const fabric = bakeVerticalAO(
    mergeParts(fabricParts, normalizePart(new BoxGeometry(w, 0.9, 0.5))),
    0.2,
    1.1,
    0.46,
  );
  const frame = mergeParts(frameParts, normalizePart(new BoxGeometry(w * 0.5, 0.25, 0.25)));
  return { fabric, frame };
}

/**
 * Couple / Sweetbox seat (`span === 2`): continuous double-wide plush bench without a middle armrest,
 * enclosed on left and right by tall architectural privacy divider panels (1.12 m) matching CGV / Lotte / BHD Sweetbox.
 */
function buildCoupleChairGeometries(
  style: SeatStyle,
  reclineDeg: number,
  seatPitchM: number,
  rowPitchM: number,
): ChairGeometries {
  const totalW = seatPitchM * 2 * 0.98;
  const tilt = (reclineDeg * Math.PI) / 180;
  const fabricParts: BufferGeometry[] = [];
  const frameParts: BufferGeometry[] = [];

  if (style === "bed") {
    const bedD = Math.min(rowPitchM * 0.86, 1.45);
    frameParts.push(boxPart(totalW * 0.97, 0.14, bedD * 0.96, 0, 0.07, -0.04));
    frameParts.push(roundedPart(0.075, 0.5, bedD * 0.74, -(totalW - 0.075) / 2, 0.41, 0.04, 0.025));
    frameParts.push(roundedPart(0.075, 0.5, bedD * 0.74, (totalW - 0.075) / 2, 0.41, 0.04, 0.025));

    fabricParts.push(roundedPart(totalW - 0.08, 0.24, bedD, 0, 0.26, -0.04, 0.055));
    fabricParts.push(roundedPart(totalW - 0.1, 0.09, bedD * 0.64, 0, 0.41, -0.17, 0.038));
    fabricParts.push(roundedPart(totalW - 0.14, 0.52, 0.17, 0, 0.59, bedD / 2 - 0.15, 0.06, 0.36));
    fabricParts.push(roundedPart(seatPitchM * 0.68, 0.14, 0.22, -seatPitchM * 0.42, 0.47, bedD / 2 - 0.28, 0.05, 0.25));
    fabricParts.push(roundedPart(seatPitchM * 0.68, 0.14, 0.22, seatPitchM * 0.42, 0.47, bedD / 2 - 0.28, 0.05, 0.25));
  } else {
    const cushionH = 0.45;
    const seatD = style === "recliner" ? 0.58 : 0.52;
    const wallT = 0.075;
    const innerW = totalW - wallT * 2;
    const backH = style === "recliner" ? 0.72 : style === "vip" ? 0.67 : 0.65;
    const backTilt = style === "recliner" ? Math.max(tilt, 0.32) : tilt;
    const dividerH = 1.12;
    const dividerD = seatD + 0.18;

    // Dark structural base + tall architectural Sweetbox privacy walls with rounded upper contour
    frameParts.push(boxPart(innerW * 0.9, 0.25, seatD * 0.78, 0, 0.125, 0.04));
    frameParts.push(roundedPart(wallT, dividerH, dividerD, -(totalW - wallT) / 2, dividerH / 2, 0.04, 0.032));
    frameParts.push(roundedPart(wallT, dividerH, dividerD, (totalW - wallT) / 2, dividerH / 2, 0.04, 0.032));

    // Continuous plush 2-person seat cushion + shared high backrest + subtle twin headrest pillows
    fabricParts.push(roundedPart(innerW, 0.16, seatD, 0, cushionH - 0.08, -0.01, 0.052, -0.04));
    if (style === "recliner") {
      fabricParts.push(roundedPart(innerW * 0.94, 0.12, 0.28, 0, 0.25, -seatD / 2 - 0.11, 0.04, -0.45));
    }
    fabricParts.push(
      roundedPart(
        innerW,
        backH,
        0.125,
        0,
        cushionH + (backH / 2) * Math.cos(backTilt) - 0.04,
        seatD / 2 - 0.03 + (backH / 2) * Math.sin(backTilt),
        0.052,
        backTilt,
      ),
    );
    const pillowY = cushionH + (backH - 0.08) * Math.cos(backTilt) - 0.01;
    const pillowZ = seatD / 2 - 0.055 + (backH - 0.08) * Math.sin(backTilt);
    fabricParts.push(roundedPart(innerW * 0.42, 0.16, 0.135, -innerW * 0.24, pillowY, pillowZ, 0.05, backTilt - 0.06));
    fabricParts.push(roundedPart(innerW * 0.42, 0.16, 0.135, innerW * 0.24, pillowY, pillowZ, 0.05, backTilt - 0.06));
  }

  const fabric = bakeVerticalAO(
    mergeParts(fabricParts, normalizePart(new BoxGeometry(totalW, 1.0, 0.55))),
    0.2,
    1.12,
    0.46,
  );
  const frame = mergeParts(frameParts, normalizePart(new BoxGeometry(totalW, 1.12, 0.6)));
  return { fabric, frame };
}

/**
 * Anatomically proportioned seated viewer silhouette calibrated to ISO 7250-1 + TCVN 5577 + Neufert cinema ergonomics:
 * - Pelvis & thighs rest on the compressed foam seat cushion (`y ≈ 0.42 m`, never sinking into the seat on recline).
 * - Spine tilts flush along the backrest at `reclineDeg`, keeping a realistic ~7–8 cm neck across all recline angles.
 * - Head crown matches exact `EYE_HEIGHT_M + HEAD_ABOVE_EYE_M - eyeDropM` (`1.22 m` upright, `1.19 m` slight, `1.14 m` deep)
 *   so the back of the skull cradles naturally against the high-back / recliner headrest in sync with seat scoring.
 */
function buildAudienceGeometry(reclineDeg: number, eyeDropM: number): BufferGeometry {
  const tilt = (reclineDeg * Math.PI) / 180;
  const sinT = Math.sin(tilt);
  const cosT = Math.cos(tilt);

  // Compressed cinema cushion height (~41–42 cm) and hip pivot tucked cleanly against lower backrest
  const hipY = 0.42;
  const hipZ = 0.08;

  // Seated lap / thighs resting on the cushion
  const lap = new RoundedBoxGeometry(0.35, 0.13, 0.31, 1, 0.052);
  lap.translate(0, hipY + 0.035, hipZ - 0.135);

  // Exact target head crown & centre aligned with TCVN 5577 / seat-score (`1.22 m - eyeDropM`)
  const headTop = EYE_HEIGHT_M + HEAD_ABOVE_EYE_M - eyeDropM;
  const headRY = 0.107;
  const headY = headTop - headRY;

  // Derive spine length along the tilted backrest axis from hip pivot up to head centre so the neck stays ~7.5 cm
  const spineToHead = Math.max(0.56, (headY - hipY) / Math.max(0.5, cosT));
  const headZ = hipZ + spineToHead * sinT;
  const neckClearance = 0.072;
  const torsoLen = Math.max(0.38, spineToHead - headRY - neckClearance);

  // Reclined torso & rounded shoulders resting flush against the backrest
  const torso = new RoundedBoxGeometry(0.38, torsoLen, 0.175, 1, 0.072);
  torso.rotateX(tilt);
  torso.translate(0, hipY + (torsoLen * 0.5) * cosT, hipZ + (torsoLen * 0.5) * sinT);

  const shoulderTopY = hipY + torsoLen * cosT;
  const shoulderTopZ = hipZ + torsoLen * sinT;

  // Realistic human head (15.4 × 21.4 × 18.6 cm) resting directly against the chair headrest
  const head = new SphereGeometry(1, 10, 8);
  head.scale(0.077, headRY, 0.093);
  head.rotateX(tilt * 0.35);
  head.translate(0, headY, headZ);

  // Compact anatomical neck connecting shoulders cleanly into skull base
  const neckStartY = shoulderTopY - 0.035;
  const neckStartZ = shoulderTopZ - 0.035 * sinT;
  const neckEndY = headY - headRY + 0.028;
  const neckEndZ = headZ - (headRY - 0.028) * sinT;
  const neckH = Math.max(0.06, Math.hypot(neckEndY - neckStartY, neckEndZ - neckStartZ));
  const neck = new CylinderGeometry(0.048, 0.06, neckH, 8);
  neck.rotateX(tilt * 0.75);
  neck.translate(0, (neckStartY + neckEndY) / 2, (neckStartZ + neckEndZ) / 2);

  const parts = [lap, torso, neck, head].map(normalizePart);
  return mergeParts(parts, normalizePart(new BoxGeometry(0.36, 0.55, 0.22)));
}

/** Builds a curved or flat plane whose centre sits at z = 0 and outer edges curve toward +z by `curveDepth`. */
function buildScreenGeometry(width: number, height: number, curveDepth: number): PlaneGeometry {
  const segX = curveDepth > 0 ? 32 : 1;
  const g = new PlaneGeometry(width, height, segX, 1);
  if (curveDepth > 0 && width > 0) {
    const pos = g.attributes.position;
    const halfW = width / 2;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / halfW;
      pos.setZ(i, curveDepth * u * u);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/**
 * Builds the solid architectural shadow-box / angled mounting shroud connecting the back of the masking frame
 * flush to `frontWallZ`, so tilted screens read with a solid overhanging soffit and side cheeks from every angle.
 */
function buildScreenHousingGeometry(
  frameW: number,
  frameH: number,
  centerY: number,
  centerZ: number,
  tiltRad: number,
  curveDepth: number,
  frontWallZ: number,
): BufferGeometry {
  const halfW = frameW / 2;
  const halfH = frameH / 2;
  const cosT = Math.cos(tiltRad);
  const sinT = Math.sin(tiltRad);
  const backOffset = -0.048;

  const by = centerY + -halfH * cosT - backOffset * sinT;
  const bz = centerZ + -halfH * sinT + backOffset * cosT + curveDepth;
  const ty = centerY + halfH * cosT - backOffset * sinT;
  const tz = centerZ + halfH * sinT + backOffset * cosT + curveDepth;
  const wz = Math.min(frontWallZ, Math.min(bz, tz) - 0.02);

  // Outward-wound triangles: right cheek (+X), left cheek (-X), top soffit (+Y), bottom soffit (-Y).
  const verts = new Float32Array([
    // Right cheek (+X)
    halfW, by, wz,   halfW, ty, wz,   halfW, ty, tz,
    halfW, by, wz,   halfW, ty, tz,   halfW, by, bz,
    // Left cheek (-X)
    -halfW, by, wz,  -halfW, ty, tz,  -halfW, ty, wz,
    -halfW, by, wz,  -halfW, by, bz,  -halfW, ty, tz,
    // Top soffit (+Y)
    -halfW, ty, wz,  -halfW, ty, tz,  halfW, ty, tz,
    -halfW, ty, wz,  halfW, ty, tz,   halfW, ty, wz,
    // Bottom soffit (-Y)
    -halfW, by, wz,  halfW, by, wz,   halfW, by, bz,
    -halfW, by, wz,  halfW, by, bz,   -halfW, by, bz,
  ]);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
}

// Module-level bounded caches for 2D procedural canvas images so repeat mounts/rebuilds skip all 2D canvas painting.
// Each WebGLRenderer still creates & disposes its own `CanvasTexture` wrapper to keep context lifecycles isolated.
const MAX_CANVAS_CACHE = 6;
const cachedCarpetCanvases = new Map<string, HTMLCanvasElement>();
const cachedAcousticWallCanvases = new Map<string, HTMLCanvasElement>();
const cachedCeilingCanvases = new Map<string, HTMLCanvasElement>();
const cachedSconceGlowCanvases = new Map<LightAccentColor, HTMLCanvasElement>();
let cachedScreenHaloCanvas: HTMLCanvasElement | null | undefined;
const cachedExitSignCanvases = new Map<string, HTMLCanvasElement>();
const cachedScreenCanvases = new Map<string, HTMLCanvasElement>();

function putCanvasCache<K>(cache: Map<K, HTMLCanvasElement>, key: K, canvas: HTMLCanvasElement): HTMLCanvasElement {
  if (cache.size >= MAX_CANVAS_CACHE) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

/** Scales an RGB hex color (e.g. "#14131D") smoothly for procedural texture highlights and shadows. */
function shadeHex(hex: string, factor: number, fallback = "#14131D"): string {
  const num = parseHexOrRgb(hex) ?? parseHexOrRgb(fallback) ?? 0x14131d;
  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((num & 0xff) * factor)));
  return `rgb(${r}, ${g}, ${b})`;
}

const SCONCE_ACCENT_STOPS: Record<LightAccentColor, { dim: number; lit: number; stops: [string, string, string, string] }> = {
  warm: {
    dim: 0x784a22,
    lit: 0xffcd85,
    stops: [
      "rgba(255, 206, 138, 0.72)",
      "rgba(232, 148, 72, 0.3)",
      "rgba(180, 96, 40, 0.08)",
      "rgba(180, 96, 40, 0)",
    ],
  },
  neutral: {
    dim: 0x5c6375,
    lit: 0xf1f5ff,
    stops: [
      "rgba(242, 246, 255, 0.66)",
      "rgba(196, 206, 228, 0.26)",
      "rgba(130, 142, 168, 0.08)",
      "rgba(130, 142, 168, 0)",
    ],
  },
  cool: {
    dim: 0x265480,
    lit: 0x7dd3fc,
    stops: [
      "rgba(148, 214, 255, 0.72)",
      "rgba(72, 156, 236, 0.3)",
      "rgba(32, 92, 178, 0.08)",
      "rgba(32, 92, 178, 0)",
    ],
  },
  crimson: {
    dim: 0x6e1e33,
    lit: 0xfb7185,
    stops: [
      "rgba(255, 138, 162, 0.68)",
      "rgba(220, 62, 102, 0.28)",
      "rgba(142, 24, 58, 0.08)",
      "rgba(142, 24, 58, 0)",
    ],
  },
};

const AISLE_LED_HEX: Record<AisleLedColor, number> = {
  amber: 0xffb347,
  white: 0xf1f5f9,
  blue: 0x38bdf8,
  red: 0xf87171,
};

function getCarpetCanvas(style: CarpetStyle, baseHex: string): HTMLCanvasElement | null {
  const key = `${style}:${baseHex}`;
  const existing = cachedCarpetCanvases.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = shadeHex(baseHex, 1, "#161320");
  ctx.fillRect(0, 0, 256, 256);

  if (style === "striped") {
    for (let x = 0; x < 256; x += 32) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
      ctx.fillRect(x, 0, 12, 256);
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(x + 12, 0, 4, 256);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.018)";
    for (let y = 0; y < 256; y += 4) ctx.fillRect(0, y, 256, 1);
  } else if (style === "solid") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.014)";
    for (let y = 0; y < 256; y += 4) ctx.fillRect(0, y, 256, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
    for (let x = 0; x < 256; x += 8) ctx.fillRect(x, 0, 1, 256);
  } else {
    // Subtle woven ribs + deterministic cinema carpet fleck pattern
    ctx.fillStyle = "rgba(255, 255, 255, 0.022)";
    for (let y = 0; y < 256; y += 4) ctx.fillRect(0, y, 256, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    for (let x = 0; x < 256; x += 8) ctx.fillRect(x, 0, 1, 256);

    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 420; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const r = 1 + rand() * 2.2;
      ctx.fillStyle = i % 3 === 0 ? "rgba(148, 42, 74, 0.12)" : "rgba(58, 66, 104, 0.12)";
      ctx.fillRect(x, y, r, r);
    }
  }

  return putCanvasCache(cachedCarpetCanvases, key, canvas);
}

/** Procedural plush dark cinema carpet texture (256×256). */
function createCarpetTexture(
  repeatX: number,
  repeatZ: number,
  style: CarpetStyle,
  baseHex: string,
): CanvasTexture | null {
  const canvas = getCarpetCanvas(style, baseHex);
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(Math.max(1, repeatX), Math.max(1, repeatZ));
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function getAcousticWallCanvas(style: WallStyle, baseHex: string): HTMLCanvasElement | null {
  const key = `${style}:${baseHex}`;
  const existing = cachedAcousticWallCanvases.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = shadeHex(baseHex, 1, "#14131D");
  ctx.fillRect(0, 0, 256, 256);

  if (style === "slats") {
    const slatW = 16;
    for (let x = 0; x < 256; x += slatW) {
      const grad = ctx.createLinearGradient(x, 0, x + slatW, 0);
      grad.addColorStop(0, shadeHex(baseHex, 0.45));
      grad.addColorStop(0.18, shadeHex(baseHex, 1.32));
      grad.addColorStop(0.55, shadeHex(baseHex, 1.08));
      grad.addColorStop(0.88, shadeHex(baseHex, 0.78));
      grad.addColorStop(1, shadeHex(baseHex, 0.4));
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, slatW, 256);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(0, 126, 256, 3);
    ctx.fillRect(0, 253, 256, 3);
  } else if (style === "panels") {
    // Padded fabric acoustic wall panels (2×2 grid with soft bevelled sheen and dark shadow reveals)
    const tile = 128;
    for (let gy = 0; gy < 256; gy += tile) {
      for (let gx = 0; gx < 256; gx += tile) {
        const g = ctx.createLinearGradient(gx, gy, gx + tile, gy + tile);
        g.addColorStop(0, shadeHex(baseHex, 1.24));
        g.addColorStop(0.5, shadeHex(baseHex, 1.02));
        g.addColorStop(1, shadeHex(baseHex, 0.8));
        ctx.fillStyle = g;
        ctx.fillRect(gx + 3, gy + 3, tile - 6, tile - 6);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.52)";
        ctx.lineWidth = 4;
        ctx.strokeRect(gx + 2, gy + 2, tile - 4, tile - 4);
      }
    }
  } else {
    // Matte acoustic plaster with gentle micro-grain
    let seed = 7331;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 320; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.018)" : "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(x, y, 2, 2);
    }
  }

  return putCanvasCache(cachedAcousticWallCanvases, key, canvas);
}

/** Procedural acoustic baffle wall texture (256×256). */
function createAcousticWallTexture(
  repeatX: number,
  repeatY: number,
  style: WallStyle,
  baseHex: string,
): CanvasTexture | null {
  const canvas = getAcousticWallCanvas(style, baseHex);
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function getCeilingCanvas(style: CeilingStyle, baseHex: string): HTMLCanvasElement | null {
  const key = `${style}:${baseHex}`;
  const existing = cachedCeilingCanvases.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = shadeHex(baseHex, 1, "#0B0D14");
  ctx.fillRect(0, 0, 256, 256);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 55; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const rad = 16 + rand() * 44;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(56, 64, 92, 0.05)");
    g.addColorStop(1, "rgba(56, 64, 92, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  if (style === "coffered") {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 3;
    const step = 64;
    for (let k = 0; k <= 256; k += step) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, k);
      ctx.lineTo(256, k);
      ctx.stroke();
    }
  } else if (style === "starlight") {
    // Delicate VIP theater fiber-optic starfield ceiling
    for (let i = 0; i < 42; i++) {
      const sx = rand() * 256;
      const sy = rand() * 256;
      const r = rand() > 0.8 ? 2.2 : 1.25;
      const alpha = 0.38 + rand() * 0.55;
      const warm = i % 3 === 0;
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.2);
      halo.addColorStop(0, warm ? `rgba(255, 236, 198, ${alpha.toFixed(2)})` : `rgba(210, 230, 255, ${alpha.toFixed(2)})`);
      halo.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return putCanvasCache(cachedCeilingCanvases, key, canvas);
}

/** Procedural dark acoustic ceiling texture (256×256). */
function createCeilingTexture(
  repeatX: number,
  repeatZ: number,
  style: CeilingStyle,
  baseHex: string,
): CanvasTexture | null {
  const canvas = getCeilingCanvas(style, baseHex);
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(Math.max(1, repeatX), Math.max(1, repeatZ));
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function getSconceGlowCanvas(accent: LightAccentColor): HTMLCanvasElement | null {
  const existing = cachedSconceGlowCanvases.get(accent);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const [c0, c1, c2, c3] = (SCONCE_ACCENT_STOPS[accent] ?? SCONCE_ACCENT_STOPS.warm).stops;
  ctx.clearRect(0, 0, 128, 256);

  const upper = ctx.createRadialGradient(64, 118, 4, 64, 86, 92);
  upper.addColorStop(0, c0);
  upper.addColorStop(0.35, c1);
  upper.addColorStop(0.75, c2);
  upper.addColorStop(1, c3);
  ctx.fillStyle = upper;
  ctx.fillRect(0, 0, 128, 132);

  const lower = ctx.createRadialGradient(64, 138, 4, 64, 170, 92);
  lower.addColorStop(0, c0);
  lower.addColorStop(0.35, c1);
  lower.addColorStop(0.75, c2);
  lower.addColorStop(1, c3);
  ctx.fillStyle = lower;
  ctx.fillRect(0, 124, 128, 132);

  cachedSconceGlowCanvases.set(accent, canvas);
  return canvas;
}

const cachedCoveWashCanvases = new Map<LightAccentColor, HTMLCanvasElement>();

function getCoveWashCanvas(accent: LightAccentColor): HTMLCanvasElement | null {
  const existing = cachedCoveWashCanvases.get(accent);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { stops } = SCONCE_ACCENT_STOPS[accent] ?? SCONCE_ACCENT_STOPS.warm;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.28, stops[1]);
  g.addColorStop(0.65, stops[2]);
  g.addColorStop(1, stops[3]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 64);
  cachedCoveWashCanvases.set(accent, canvas);
  return canvas;
}

/** Soft directional wall-wash gradient texture for ceiling & wall architectural LED coves. */
function createCoveWashTexture(accent: LightAccentColor): CanvasTexture | null {
  const canvas = getCoveWashCanvas(accent);
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

const ROW_MARKER_PALETTE: Record<AisleLedColor, { text: string; border: string; glow: string }> = {
  amber: { text: "#ffd180", border: "rgba(255, 179, 71, 0.72)", glow: "rgba(255, 165, 48, 0.9)" },
  white: { text: "#f8fafc", border: "rgba(226, 232, 240, 0.7)", glow: "rgba(241, 245, 249, 0.85)" },
  blue: { text: "#7dd3fc", border: "rgba(56, 189, 248, 0.72)", glow: "rgba(56, 189, 248, 0.9)" },
  red: { text: "#fca5a5", border: "rgba(248, 113, 113, 0.72)", glow: "rgba(248, 113, 113, 0.9)" },
};

/** Single compact atlas texture holding all illuminated row labels (`A, B, C...`) so every row marker draws in 1 draw call. */
function createRowMarkerAtlas(
  labels: string[],
  color: AisleLedColor,
): { texture: CanvasTexture; cols: number; gridRows: number } | null {
  if (labels.length === 0) return null;
  const cols = Math.min(8, Math.max(1, labels.length));
  const gridRows = Math.ceil(labels.length / cols);
  const cell = 64;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = gridRows * cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const style = ROW_MARKER_PALETTE[color] ?? ROW_MARKER_PALETTE.amber;
  ctx.fillStyle = "#08080e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  labels.forEach((label, idx) => {
    const gx = idx % cols;
    const gy = Math.floor(idx / cols);
    const ox = gx * cell;
    const oy = gy * cell;

    ctx.fillStyle = "#0c0c14";
    ctx.fillRect(ox + 2, oy + 2, cell - 4, cell - 4);
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(ox + 5, oy + 5, cell - 10, cell - 10);

    ctx.save();
    ctx.font = `700 ${label.length > 2 ? 22 : label.length > 1 ? 28 : 36}px -apple-system, BlinkMacSystemFont, 'Be Vietnam Pro', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 9;
    ctx.fillStyle = style.text;
    ctx.fillText(label, ox + cell / 2, oy + cell / 2 + 1, cell - 14);
    ctx.restore();
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { texture, cols, gridRows };
}

/** Splits `[min, max]` around doorway cutout intervals `[start, end]` so wall cove rails never cut across exit doors. */
function splitIntervalsAroundHoles(min: number, max: number, holes: [number, number][]): [number, number][] {
  let segments: [number, number][] = [[min, max]];
  for (const [hStart, hEnd] of holes) {
    const next: [number, number][] = [];
    for (const [s, e] of segments) {
      if (hEnd <= s || hStart >= e) {
        next.push([s, e]);
      } else {
        if (hStart - s > 0.35) next.push([s, hStart]);
        if (e - hEnd > 0.35) next.push([hEnd, e]);
      }
    }
    segments = next;
  }
  return segments;
}

/** Soft up/down sconce wall-wash light cone texture (zero extra point lights needed). */
function createSconceGlowTexture(accent: LightAccentColor): CanvasTexture | null {
  const canvas = getSconceGlowCanvas(accent);
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function getScreenHaloCanvas(): HTMLCanvasElement | null {
  if (cachedScreenHaloCanvas !== undefined) return cachedScreenHaloCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cachedScreenHaloCanvas = null;
    return null;
  }

  ctx.clearRect(0, 0, 256, 128);
  const g = ctx.createRadialGradient(128, 64, 24, 128, 64, 126);
  g.addColorStop(0, "rgba(130, 178, 255, 0.55)");
  g.addColorStop(0.45, "rgba(148, 152, 220, 0.22)");
  g.addColorStop(0.75, "rgba(218, 138, 92, 0.08)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);

  cachedScreenHaloCanvas = canvas;
  return canvas;
}

/** Soft additive radial glow behind the cinema screen framing to simulate wall light spill. */
function createScreenHaloTexture(): CanvasTexture | null {
  const canvas = getScreenHaloCanvas();
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function getExitSignCanvas(color: ExitSignColor, text: ExitSignText): HTMLCanvasElement | null {
  const key = `${color}:${text}`;
  const existing = cachedExitSignCanvases.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const isRed = color === "red";
  ctx.fillStyle = isRed ? "#4c0812" : "#064e24";
  ctx.fillRect(0, 0, 256, 96);
  const glow = ctx.createRadialGradient(128, 48, 12, 128, 48, 130);
  glow.addColorStop(0, isRed ? "#dc2626" : "#16a34a");
  glow.addColorStop(1, isRed ? "#881322" : "#0b6e32");
  ctx.fillStyle = glow;
  ctx.fillRect(8, 8, 240, 80);

  ctx.fillStyle = isRed ? "#fff1f2" : "#ecfdf5";
  const fontSize = text.length > 4 ? 42 : 54;
  ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Be Vietnam Pro', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 51, 224);

  return putCanvasCache(cachedExitSignCanvases, key, canvas);
}

/** Backlit emerald or crimson EXIT / LỐI RA sign texture. */
function createExitSignTexture(color: ExitSignColor, text: ExitSignText): CanvasTexture | null {
  const canvas = getExitSignCanvas(color, text);
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function paintNoirScreen(ctx: CanvasRenderingContext2D) {
  // Moody neon-noir rain-slicked metropolis at night
  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#050712");
  sky.addColorStop(0.38, "#12172e");
  sky.addColorStop(0.65, "#2b2038");
  sky.addColorStop(0.8, "#582c3a");
  sky.addColorStop(1, "#0b0912");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 512);

  // Warm atmospheric city horizon bloom
  const bloom = ctx.createRadialGradient(512, 336, 20, 512, 336, 420);
  bloom.addColorStop(0, "rgba(255, 168, 92, 0.42)");
  bloom.addColorStop(0.42, "rgba(218, 72, 114, 0.2)");
  bloom.addColorStop(0.75, "rgba(44, 104, 178, 0.1)");
  bloom.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, 1024, 512);

  // Layered city skyline silhouettes + lit office windows
  let seed = 8080;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let x = 0; x < 1024; ) {
    const bw = 34 + Math.floor(rand() * 58);
    const bh = 90 + Math.floor(rand() * 210);
    const top = 365 - bh;
    ctx.fillStyle = "#10101c";
    ctx.fillRect(x, top, bw - 3, bh + 15);
    for (let wy = top + 12; wy < 350; wy += 14) {
      for (let wx = x + 6; wx < x + bw - 10; wx += 11) {
        if (rand() > 0.62) {
          ctx.fillStyle = rand() > 0.25 ? "rgba(255, 214, 146, 0.48)" : "rgba(125, 206, 255, 0.42)";
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
    x += bw;
  }

  // Wet street reflection deck
  const street = ctx.createLinearGradient(0, 365, 0, 512);
  street.addColorStop(0, "#151224");
  street.addColorStop(1, "#07060d");
  ctx.fillStyle = street;
  ctx.fillRect(0, 365, 1024, 147);

  for (let i = 0; i < 24; i++) {
    const rx = 40 + rand() * 944;
    const ry = 374 + rand() * 95;
    const rw = 18 + rand() * 56;
    const warm = i % 3 !== 0;
    const g = ctx.createRadialGradient(rx, ry, 2, rx, ry, rw);
    g.addColorStop(0, warm ? "rgba(255, 184, 112, 0.34)" : "rgba(96, 186, 255, 0.32)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(rx - rw, ry - 8, rw * 2, 16);
  }
}

function paintGridScreen(ctx: CanvasRenderingContext2D) {
  // Precision cinema optical framing & sightline calibration chart
  const bg = ctx.createRadialGradient(512, 256, 40, 512, 256, 620);
  bg.addColorStop(0, "#1d2638");
  bg.addColorStop(0.65, "#111724");
  bg.addColorStop(1, "#090c14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle calibration grid
  ctx.strokeStyle = "rgba(148, 178, 224, 0.14)";
  ctx.lineWidth = 1;
  for (let x = 64; x < 1024; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 64; y < 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Safe-action & safe-title borders
  ctx.strokeStyle = "rgba(148, 198, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 24, 952, 464);
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
  ctx.strokeRect(86, 52, 852, 408);
  ctx.setLineDash([]);

  // Center optical crosshair & target circles
  ctx.strokeStyle = "rgba(186, 224, 255, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(512, 256, 128, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(512, 256, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(512 - 170, 256);
  ctx.lineTo(512 + 170, 256);
  ctx.moveTo(512, 256 - 160);
  ctx.lineTo(512, 256 + 160);
  ctx.stroke();

  // Corner framing L-brackets
  ctx.strokeStyle = "rgba(248, 250, 252, 0.72)";
  ctx.lineWidth = 4;
  const corners: [number, number, number, number][] = [
    [22, 16, 1, 1],
    [1002, 16, -1, 1],
    [22, 496, 1, -1],
    [1002, 496, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 36, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * 28);
    ctx.stroke();
  }
}

function getScreenCanvas(
  preset: ScreenContentPreset,
  showSubtitle: boolean,
  subtitleText: string,
  subtitleColor: SubtitleColor,
): HTMLCanvasElement | null {
  const key = `${preset}|${showSubtitle ? 1 : 0}|${subtitleText}|${subtitleColor}`;
  const existing = cachedScreenCanvases.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (preset === "noir") {
    paintNoirScreen(ctx);
  } else if (preset === "grid") {
    paintGridScreen(ctx);
  } else {
    // Deep anamorphic twilight sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, "#050915");
    sky.addColorStop(0.24, "#0d1b38");
    sky.addColorStop(0.48, "#1f3e68");
    sky.addColorStop(0.64, "#c46c44");
    sky.addColorStop(0.74, "#f4b777");
    sky.addColorStop(0.8, "#312036");
    sky.addColorStop(1, "#090811");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 512);

    // Subtle starfield in upper night sky
    let seed = 2026;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 160; i++) {
      const sx = rand() * 1024;
      const sy = rand() * 210;
      const alpha = (1 - sy / 210) * (0.2 + rand() * 0.65);
      const size = rand() > 0.85 ? 2 : 1.2;
      ctx.fillStyle = `rgba(225, 238, 255, ${alpha.toFixed(2)})`;
      ctx.fillRect(sx, sy, size, size);
    }

    // Dramatic celestial horizon glow (full-frame fillRect avoids any clipped arc edge)
    const planetX = 512;
    const planetY = 315;
    const planetR = 140;
    const atmos = ctx.createRadialGradient(planetX, planetY, planetR * 0.4, planetX, planetY, planetR * 1.9);
    atmos.addColorStop(0, "rgba(255, 232, 188, 0.75)");
    atmos.addColorStop(0.32, "rgba(244, 152, 86, 0.34)");
    atmos.addColorStop(0.66, "rgba(86, 138, 218, 0.12)");
    atmos.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = atmos;
    ctx.fillRect(0, 0, 1024, 512);

    // Solar core & anamorphic horizontal cinema flare
    const sun = ctx.createRadialGradient(512, 346, 4, 512, 346, 185);
    sun.addColorStop(0, "rgba(255, 252, 236, 0.98)");
    sun.addColorStop(0.2, "rgba(255, 214, 152, 0.72)");
    sun.addColorStop(0.55, "rgba(226, 118, 66, 0.24)");
    sun.addColorStop(1, "rgba(226, 118, 66, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 1024, 512);

    const flare = ctx.createLinearGradient(96, 344, 928, 344);
    flare.addColorStop(0, "rgba(120, 190, 255, 0)");
    flare.addColorStop(0.28, "rgba(130, 198, 255, 0.14)");
    flare.addColorStop(0.5, "rgba(255, 236, 200, 0.42)");
    flare.addColorStop(0.72, "rgba(130, 198, 255, 0.14)");
    flare.addColorStop(1, "rgba(120, 190, 255, 0)");
    ctx.fillStyle = flare;
    ctx.fillRect(96, 341, 832, 6);

    // Soft lit horizon clouds
    for (let i = 0; i < 8; i++) {
      const cx = 110 + i * 116 + (rand() - 0.5) * 40;
      const cy = 235 + (rand() - 0.5) * 58;
      const rw = 110 + rand() * 110;
      const rh = 16 + rand() * 14;
      const cg = ctx.createRadialGradient(cx, cy, 4, cx, cy, rw);
      cg.addColorStop(0, "rgba(255, 200, 148, 0.2)");
      cg.addColorStop(1, "rgba(255, 200, 148, 0)");
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, rh / rw);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, rw, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const drawRidge = (pts: [number, number][], fill: string | CanvasGradient) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, 512);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(1024, 512);
      ctx.closePath();
      ctx.fill();
    };

    drawRidge(
      [
        [0, 342], [90, 304], [190, 326], [305, 276], [420, 318],
        [512, 336], [620, 294], [740, 266], [860, 310], [955, 286], [1024, 316],
      ],
      "rgba(34, 38, 66, 0.72)",
    );

    drawRidge(
      [
        [0, 376], [120, 328], [240, 358], [350, 312], [448, 354],
        [512, 366], [595, 346], [715, 304], [835, 342], [945, 318], [1024, 354],
      ],
      "#181628",
    );

    const lake = ctx.createLinearGradient(0, 372, 0, 512);
    lake.addColorStop(0, "#1c192b");
    lake.addColorStop(0.35, "#111220");
    lake.addColorStop(1, "#07070e");
    ctx.fillStyle = lake;
    ctx.fillRect(0, 372, 1024, 140);

    for (let y = 376; y < 486; y += 5) {
      const spread = 24 + (y - 376) * 0.95;
      const alpha = Math.max(0.03, 0.36 - (y - 376) * 0.0028);
      const rg = ctx.createLinearGradient(512 - spread, y, 512 + spread, y);
      rg.addColorStop(0, "rgba(255, 185, 118, 0)");
      rg.addColorStop(0.5, `rgba(255, 206, 144, ${alpha.toFixed(2)})`);
      rg.addColorStop(1, "rgba(255, 185, 118, 0)");
      ctx.fillStyle = rg;
      ctx.fillRect(512 - spread, y, spread * 2, 2.2);
    }

    drawRidge(
      [[0, 396], [115, 382], [235, 424], [340, 444], [0, 470]],
      "#0a0912",
    );
    drawRidge(
      [[1024, 386], [895, 376], [775, 422], [685, 448], [1024, 466]],
      "#0a0912",
    );
  }

  // Subtle cinematic edge vignette
  const vig = ctx.createRadialGradient(512, 256, 220, 512, 256, 610);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(0.72, "rgba(0, 0, 0, 0.16)");
  vig.addColorStop(1, "rgba(0, 0, 0, 0.52)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, 1024, 512);

  if (preset !== "grid") {
    // Subtle rule-of-thirds optical framing lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(341, 18);
    ctx.lineTo(341, 494);
    ctx.moveTo(683, 18);
    ctx.lineTo(683, 494);
    ctx.stroke();
  }

  // Crisp cinema-grade subtitle in the bottom safe-title region
  if (showSubtitle) {
    paintScreenSubtitle(ctx, subtitleText, subtitleColor);
  }

  return putCanvasCache(cachedScreenCanvases, key, canvas);
}

const MAX_LOADED_IMAGE_CACHE = 4;
const cachedLoadedImages = new Map<string, HTMLImageElement>();

function putLoadedImageCache(url: string, img: HTMLImageElement): HTMLImageElement {
  if (cachedLoadedImages.size >= MAX_LOADED_IMAGE_CACHE && !cachedLoadedImages.has(url)) {
    const oldest = cachedLoadedImages.keys().next().value;
    if (oldest !== undefined) cachedLoadedImages.delete(oldest);
  }
  cachedLoadedImages.set(url, img);
  return img;
}

function paintScreenSubtitle(
  ctx: CanvasRenderingContext2D,
  subtitleText: string,
  subtitleColor: SubtitleColor,
): void {
  if (subtitleText.trim().length === 0) return;
  ctx.save();
  ctx.font = "600 28px -apple-system, BlinkMacSystemFont, 'Be Vietnam Pro', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const subY = 478;
  ctx.shadowColor = "rgba(0, 0, 0, 0.92)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
  ctx.strokeText(subtitleText, 512, subY, 920);
  ctx.fillStyle = subtitleColor === "yellow" ? "#fde047" : "#f8fafc";
  ctx.fillText(subtitleText, 512, subY, 920);
  ctx.restore();
}

/**
 * High-contrast atmospheric widescreen movie still (1024×512) with configurable scene preset
 * and sample subtitles at the bottom safe-title zone.
 */
function createScreenTexture(
  preset: ScreenContentPreset,
  showSubtitle: boolean,
  subtitleText: string,
  subtitleColor: SubtitleColor,
): CanvasTexture | null {
  const canvas = getScreenCanvas(preset, showSubtitle, subtitleText, subtitleColor);
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/** Composites an uploaded/external image onto a 1024×512 cinema screen canvas with cover-crop, subtle vignette & optional subtitle. */
function createCustomImageScreenTexture(
  img: HTMLImageElement,
  showSubtitle: boolean,
  subtitleText: string,
  subtitleColor: SubtitleColor,
): CanvasTexture | null {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (nw <= 0 || nh <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, 1024, 512);

  // Center-crop ("cover") to fill the widescreen projection surface cleanly without distortion
  const targetRatio = 1024 / 512;
  const srcRatio = nw / nh;
  let sx = 0;
  let sy = 0;
  let sw = nw;
  let sh = nh;
  if (srcRatio > targetRatio) {
    sw = nh * targetRatio;
    sx = (nw - sw) / 2;
  } else {
    sh = nw / targetRatio;
    sy = (nh - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1024, 512);

  // Subtle cinema lens edge vignette so bright photos still integrate naturally with the dark auditorium
  const vig = ctx.createRadialGradient(512, 256, 260, 512, 256, 620);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(0.8, "rgba(0, 0, 0, 0.08)");
  vig.addColorStop(1, "rgba(0, 0, 0, 0.34)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, 1024, 512);

  if (showSubtitle) {
    paintScreenSubtitle(ctx, subtitleText, subtitleColor);
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function buildScreenYoutubeUrl(videoId: string, muted: boolean): string {
  const origin =
    typeof window !== "undefined" && /^https?:$/i.test(window.location.protocol)
      ? window.location.origin
      : undefined;
  return (
    `${youtubeEmbedUrl(videoId, { controls: false, origin })}` +
    `&mute=${muted ? 1 : 0}&loop=1&playlist=${videoId}`
  );
}

export function createRoom3D(host: HTMLElement, room: RoomScene, options: Room3DOptions): Room3D {
  let renderer: WebGLRenderer;
  try {
    // `alpha: true` allows the screen mesh to punch a depth-tested cutout over the optional CSS3D YouTube layer.
    renderer = new WebGLRenderer({ antialias: false, powerPreference: "default", alpha: true });
  } catch {
    options.onFailed();
    return {
      setMode() {},
      recenter() {},
      setHeat() {},
      setSelected() {},
      setAudience() {},
      setLightsUp() {},
      setHeights() {},
      setMarks() {},
      setAppearance() {},
      setYoutubeMuted() {},
      mountTo() {},
      refit() {},
      dispose() {},
    };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const stageEl = document.createElement("div");
  stageEl.style.cssText =
    "position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;background:#050508";

  const canvas = renderer.domElement;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;z-index:1";
  stageEl.appendChild(canvas);
  host.appendChild(stageEl);

  const bgColor = new Color(0x050508);
  renderer.setClearColor(0x050508, 1);

  const scene = new Scene();
  scene.background = bgColor;
  scene.fog = new Fog(0x050508, Math.max(18, room.backWallZ * 1.1), Math.max(40, room.backWallZ * 2.65));

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  let currentAppearance: Room3DAppearance = normalizeRoom3DAppearance(options.appearance);

  const leftMargin = room.leftMarginM;
  const rightMargin = room.rightMarginM;
  const shellW = room.shellWidthM;
  const shellCenterX = room.shellCenterX;
  const shellD = room.backWallZ - room.frontWallZ;
  const shellCenterZ = (room.frontWallZ + room.backWallZ) / 2;

  // --- Dynamic Cinema Lighting (House Lights On ↔ Movie Dimmed) ---
  const ambientLight = new AmbientLight(0xd4ddf5, 0.55);
  scene.add(ambientLight);

  const hemiLight = new HemisphereLight(0xffe9cf, 0x0e0b16, 0.72);
  scene.add(hemiLight);

  const ceilingKey = new DirectionalLight(0xffe7c8, 0.95);
  ceilingKey.position.set(shellCenterX, room.ceilingY + 2, shellCenterZ + 2);
  ceilingKey.target.position.set(shellCenterX, 0.8, room.depthM * 0.45);
  scene.add(ceilingKey);
  scene.add(ceilingKey.target);

  const screenTiltRad = (room.screen.tiltDeg * Math.PI) / 180;

  // Screen bounce lights casting cinematic illumination onto front/mid seats & audience heads
  const screenBounce = new PointLight(0xb8d4ff, 26, Math.max(18, room.backWallZ * 1.5), 1.55);
  screenBounce.position.set(room.screen.centreX, room.screen.centerY, room.screen.centerZ + 1.35);
  scene.add(screenBounce);

  const screenFill = new DirectionalLight(0x9ec2f7, 0.55);
  screenFill.position.set(
    room.screen.centreX,
    room.screen.centerY + room.screen.height * 0.2,
    room.screen.centerZ - 1.2,
  );
  screenFill.target.position.set(shellCenterX, room.maxFloorY * 0.4 + 0.6, room.depthM * 0.6);
  scene.add(screenFill);
  scene.add(screenFill.target);

  const tmpMat = new Matrix4();
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const tmpScale = new Vector3(1, 1, 1);
  const yAxis = new Vector3(0, 1, 0);

  // --- 1. Persistent Stepped Stadium Floor, Contrast Risers & Aisle Stairs (Carpet texture swaps in-place) ---
  let carpetTex: CanvasTexture | null = createCarpetTexture(
    shellW / 2.2,
    shellD / 2.2,
    currentAppearance.carpetStyle,
    currentAppearance.carpetColor,
  );
  const baseFloorGeom = track(new PlaneGeometry(shellW, shellD));
  const baseFloorMat = track(
    new MeshStandardMaterial({
      color: 0xffffff,
      map: carpetTex,
      roughness: 0.94,
      metalness: 0.02,
    }),
  );
  const baseFloor = new Mesh(baseFloorGeom, baseFloorMat);
  baseFloor.rotation.x = -Math.PI / 2;
  baseFloor.position.set(shellCenterX, 0.004, shellCenterZ);
  scene.add(baseFloor);

  let slabMaterial: MeshStandardMaterial | null = null;
  if (room.floorSlabs.length > 0) {
    const slabGeometry = track(new BoxGeometry(1, 1, 1));
    slabMaterial = track(
      new MeshStandardMaterial({
        color: 0xded9eb,
        map: carpetTex,
        roughness: 0.92,
        metalness: 0.02,
      }),
    );
    const slabMesh = track(new InstancedMesh(slabGeometry, slabMaterial, room.floorSlabs.length));

    // Crisp recessed dark riser facings + subtle top lip trim so every stadium row reads sharply from both front and rear
    const raisedSlabs = room.floorSlabs.filter((s) => s.height > 0.03);
    const riserGeom = track(new PlaneGeometry(1, 1));
    const riserMat = track(new MeshStandardMaterial({ color: 0x09070f, roughness: 0.96, metalness: 0.02 }));
    const riserMesh =
      raisedSlabs.length > 0 ? track(new InstancedMesh(riserGeom, riserMat, raisedSlabs.length)) : null;
    const lipGeom = track(new BoxGeometry(1, 0.018, 0.045));
    const lipMat = track(new MeshStandardMaterial({ color: 0x262134, roughness: 0.68, metalness: 0.16 }));
    const lipMesh =
      raisedSlabs.length > 0 ? track(new InstancedMesh(lipGeom, lipMat, raisedSlabs.length)) : null;

    let riserIdx = 0;
    room.floorSlabs.forEach((slab, i) => {
      const h = Math.max(slab.height, 0.02);
      const d = Math.max(slab.zEnd - slab.zStart, 0.05);
      tmpMat.compose(
        tmpPos.set(shellCenterX, h / 2, (slab.zStart + slab.zEnd) / 2),
        tmpQuat.identity(),
        tmpScale.set(shellW - 0.02, h, d + 0.01),
      );
      slabMesh.setMatrixAt(i, tmpMat);

      if (riserMesh && lipMesh && slab.height > 0.03) {
        const prevH = i > 0 ? room.floorSlabs[i - 1].height : 0;
        const riserH = Math.max(0.03, slab.height - prevH);
        tmpMat.compose(
          tmpPos.set(shellCenterX, prevH + riserH / 2, slab.zStart - 0.008),
          tmpQuat.setFromAxisAngle(yAxis, Math.PI),
          tmpScale.set(shellW - 0.04, riserH, 1),
        );
        riserMesh.setMatrixAt(riserIdx, tmpMat);
        tmpMat.compose(
          tmpPos.set(shellCenterX, slab.height + 0.004, slab.zStart + 0.018),
          tmpQuat.identity(),
          tmpScale.set(shellW - 0.04, 1, 1),
        );
        lipMesh.setMatrixAt(riserIdx, tmpMat);
        riserIdx++;
      }
    });
    slabMesh.instanceMatrix.needsUpdate = true;
    scene.add(slabMesh);
    if (riserMesh) {
      riserMesh.instanceMatrix.needsUpdate = true;
      scene.add(riserMesh);
    }
    if (lipMesh) {
      lipMesh.instanceMatrix.needsUpdate = true;
      scene.add(lipMesh);
    }
  }

  // Real intermediate stair treads along open vertical/side walkways (QCVN 06 / IBC stepped aisles)
  let stairMat: MeshStandardMaterial | null = null;
  if (room.aisleSteps.length > 0) {
    const stairGeom = track(new BoxGeometry(1, 1, 1));
    stairMat = track(
      new MeshStandardMaterial({
        color: 0xd0c9e0,
        map: carpetTex,
        roughness: 0.9,
        metalness: 0.03,
      }),
    );
    const stairMesh = track(new InstancedMesh(stairGeom, stairMat, room.aisleSteps.length));
    room.aisleSteps.forEach((step, i) => {
      tmpMat.compose(
        tmpPos.set(step.x, step.y, step.z),
        tmpQuat.identity(),
        tmpScale.set(step.widthM, step.heightM, step.depthM),
      );
      stairMesh.setMatrixAt(i, tmpMat);
    });
    stairMesh.instanceMatrix.needsUpdate = true;
    scene.add(stairMesh);
  }

  // --- 2. Configurable Interior Enclosure, Screen, Doors, Lighting & Cinema Fixtures (Rebuilt in-place on `setAppearance`) ---
  const interiorGroup = new Group();
  scene.add(interiorGroup);
  const interiorDisposables: { dispose(): void }[] = [];
  const trackInterior = <T extends { dispose(): void }>(item: T): T => {
    interiorDisposables.push(item);
    return item;
  };

  let bulbMat: MeshBasicMaterial | null = null;
  let sconceSlitMat: MeshBasicMaterial | null = null;
  let sconceGlowMat: MeshBasicMaterial | null = null;
  let coveStripMat: MeshBasicMaterial | null = null;
  let coveWashMat: MeshBasicMaterial | null = null;
  let portGlassMat: MeshBasicMaterial | null = null;
  let beamOpacityUniform: { value: number } | null = null;
  let stageLedMat: MeshBasicMaterial | null = null;
  let haloMat: MeshBasicMaterial | null = null;

  const bulbDimColor = new Color(0x1f1914);
  const bulbLitColor = new Color(0xffe1b5);
  const initSconceStops = SCONCE_ACCENT_STOPS[currentAppearance.sconceColor] ?? SCONCE_ACCENT_STOPS.warm;
  const initCoveStops = SCONCE_ACCENT_STOPS[currentAppearance.coveLedColor] ?? SCONCE_ACCENT_STOPS.warm;
  const slitDimColor = new Color(initSconceStops.dim);
  const slitLitColor = new Color(initSconceStops.lit);
  const coveDimColor = new Color(initCoveStops.dim);
  const coveLitColor = new Color(initCoveStops.lit);
  const portDimColor = new Color(0xa6ccff);
  const portLitColor = new Color(0x526585);

  // Lazy-allocated CSS3DRenderer backing live YouTube video playback behind the WebGL depth cutout.
  let sizeW = 0;
  let sizeH = 0;
  let cssRenderer: CSS3DRenderer | null = null;
  let cssScene: Scene | null = null;
  let cssScreenObj: CSS3DObject | null = null;
  let youtubeWrapper: HTMLDivElement | null = null;
  let youtubeIframe: HTMLIFrameElement | null = null;
  let activeYoutubeId: string | null = null;
  let youtubeMuted = options.youtubeMuted ?? true;
  let youtubeSyncToken = 0;
  const screenWorldCenter = new Vector3(room.screen.centreX, room.screen.centerY, room.screen.centerZ);
  const screenCamPos = new Vector3();

  function sendYoutubeCommand(func: string) {
    if (!youtubeIframe?.contentWindow) return;
    try {
      youtubeIframe.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: "" }), "*");
    } catch {
      // Ignore cross-origin frame messaging errors before the YouTube player finishes mounting.
    }
  }

  function syncYoutubeLayer(videoId: string | null) {
    const syncToken = ++youtubeSyncToken;
    if (!videoId) {
      scene.background = bgColor;
      renderer.setClearColor(0x050508, 1);
      if (activeYoutubeId !== null || cssScreenObj !== null) {
        activeYoutubeId = null;
        if (cssScreenObj && cssScene) cssScene.remove(cssScreenObj);
        cssScreenObj = null;
        youtubeIframe?.remove();
        youtubeIframe = null;
        youtubeWrapper?.remove();
        youtubeWrapper = null;
        if (cssRenderer) cssRenderer.domElement.style.display = "none";
      }
      return;
    }

    scene.background = null;
    renderer.setClearColor(0x050508, 0);

    // Preserve the live player when switching quick themes / walls / lights while keeping the same YouTube video.
    if (activeYoutubeId === videoId && youtubeIframe && cssScreenObj && cssRenderer) {
      cssRenderer.domElement.style.display = "block";
      return;
    }

    // Dynamically import CSS3DRenderer only when YouTube screen mode is actually active.
    void import("three/addons/renderers/CSS3DRenderer.js")
      .then(({ CSS3DRenderer: CSS3DRendererCtor, CSS3DObject: CSS3DObjectCtor }) => {
        if (disposed || syncToken !== youtubeSyncToken) return;

        if (!cssRenderer) {
          cssRenderer = new CSS3DRendererCtor();
          cssRenderer.domElement.style.cssText =
            "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:0";
          stageEl.insertBefore(cssRenderer.domElement, canvas);
          cssScene = new Scene();
          if (sizeW > 0 && sizeH > 0) cssRenderer.setSize(sizeW, sizeH);
        }
        cssRenderer.domElement.style.display = "block";

        if (cssScreenObj && cssScene) cssScene.remove(cssScreenObj);
        youtubeIframe?.remove();
        youtubeWrapper?.remove();

        activeYoutubeId = videoId;
        const cssW = 1280;
        const cssH = Math.max(360, Math.round(cssW * (room.screen.height / Math.max(0.1, room.screen.width))));

        youtubeWrapper = document.createElement("div");
        youtubeWrapper.style.cssText = `width:${cssW}px;height:${cssH}px;background:#000;overflow:hidden;pointer-events:none;backface-visibility:hidden`;

        youtubeIframe = document.createElement("iframe");
        youtubeIframe.src = buildScreenYoutubeUrl(videoId, youtubeMuted);
        youtubeIframe.title = "YouTube cinema screen";
        youtubeIframe.allow = "autoplay; encrypted-media; picture-in-picture";
        youtubeIframe.referrerPolicy = "strict-origin-when-cross-origin";
        youtubeIframe.style.cssText = "width:100%;height:100%;border:0;display:block;pointer-events:none";
        youtubeWrapper.appendChild(youtubeIframe);

        cssScreenObj = new CSS3DObjectCtor(youtubeWrapper);
        // `CSS3DObject` sets `pointerEvents = "auto"` in its constructor; override so WebGL owns 100% of orbit/click input.
        youtubeWrapper.style.pointerEvents = "none";
        cssScreenObj.position.set(room.screen.centreX, room.screen.centerY, room.screen.centerZ);
        cssScreenObj.rotation.x = screenTiltRad;
        cssScreenObj.scale.set(room.screen.width / cssW, room.screen.height / cssH, 1);
        cssScene!.add(cssScreenObj);
        requestRender();
      })
      .catch(() => undefined);
  }

  let interiorBuildToken = 0;
  function buildInterior(ui: Room3DAppearance) {
    const buildToken = ++interiorBuildToken;
    interiorGroup.clear();
    for (const item of interiorDisposables) item.dispose();
    interiorDisposables.length = 0;

    bulbMat = null;
    sconceSlitMat = null;
    sconceGlowMat = null;
    coveStripMat = null;
    coveWashMat = null;
    portGlassMat = null;
    beamOpacityUniform = null;
    stageLedMat = null;
    haloMat = null;

    const sconceAccent = SCONCE_ACCENT_STOPS[ui.sconceColor] ?? SCONCE_ACCENT_STOPS.warm;
    slitDimColor.setHex(sconceAccent.dim);
    slitLitColor.setHex(sconceAccent.lit);
    const coveAccent = SCONCE_ACCENT_STOPS[ui.coveLedColor] ?? SCONCE_ACCENT_STOPS.warm;
    coveDimColor.setHex(coveAccent.dim);
    coveLitColor.setHex(coveAccent.lit);

    // Architectural walls & ceiling
    const wallTexSide = createAcousticWallTexture(shellD / 2.2, room.ceilingY / 2.5, ui.wallStyle, ui.wallColor);
    if (wallTexSide) trackInterior(wallTexSide);
    const wallTexBack = createAcousticWallTexture(shellW / 2.2, room.ceilingY / 2.5, ui.wallStyle, ui.wallColor);
    if (wallTexBack) trackInterior(wallTexBack);
    const ceilTex = createCeilingTexture(shellW / 2.8, shellD / 2.8, ui.ceilingStyle, ui.ceilingColor);
    if (ceilTex) trackInterior(ceilTex);

    const sideWallMat = trackInterior(
      new MeshStandardMaterial({
        color: 0xffffff,
        map: wallTexSide,
        roughness: 0.9,
        metalness: 0.04,
      }),
    );
    const backWallMat = trackInterior(
      new MeshStandardMaterial({
        color: 0xdad8e8,
        map: wallTexBack,
        roughness: 0.92,
        metalness: 0.04,
      }),
    );
    const frontWallMat = trackInterior(new MeshStandardMaterial({ color: 0x06060b, roughness: 0.96, metalness: 0.02 }));
    const ceilMat = trackInterior(
      new MeshStandardMaterial({
        color: 0xffffff,
        map: ceilTex,
        roughness: 0.88,
        metalness: 0.06,
      }),
    );

    const sideWallGeom = trackInterior(new PlaneGeometry(shellD, room.ceilingY));
    const leftWall = new Mesh(sideWallGeom, sideWallMat);
    leftWall.position.set(-leftMargin, room.ceilingY / 2, shellCenterZ);
    leftWall.rotation.y = Math.PI / 2;
    interiorGroup.add(leftWall);

    const rightWall = new Mesh(sideWallGeom, sideWallMat);
    rightWall.position.set(room.widthM + rightMargin, room.ceilingY / 2, shellCenterZ);
    rightWall.rotation.y = -Math.PI / 2;
    interiorGroup.add(rightWall);

    const endWallGeom = trackInterior(new PlaneGeometry(shellW, room.ceilingY));
    const frontWall = new Mesh(endWallGeom, frontWallMat);
    frontWall.position.set(shellCenterX, room.ceilingY / 2, room.frontWallZ);
    interiorGroup.add(frontWall);

    const backWall = new Mesh(endWallGeom, backWallMat);
    backWall.position.set(shellCenterX, room.ceilingY / 2, room.backWallZ);
    backWall.rotation.y = Math.PI;
    interiorGroup.add(backWall);

    const ceilingGeom = trackInterior(new PlaneGeometry(shellW, shellD));
    const ceilingMesh = new Mesh(ceilingGeom, ceilMat);
    ceilingMesh.position.set(shellCenterX, room.ceilingY, shellCenterZ);
    ceilingMesh.rotation.x = Math.PI / 2;
    interiorGroup.add(ceilingMesh);

    // Recessed ceiling downlights
    if (ui.downlightsVisible) {
      const downlightRows = Math.max(3, Math.min(7, Math.round(shellD / 3.4)));
      const downlightCount = downlightRows * 2;
      const canGeom = trackInterior(new CylinderGeometry(0.18, 0.18, 0.03, 10));
      const canMat = trackInterior(new MeshStandardMaterial({ color: 0x050508, roughness: 0.9 }));
      const canMesh = trackInterior(new InstancedMesh(canGeom, canMat, downlightCount));

      const bulbGeom = trackInterior(new CircleGeometry(0.115, 10));
      bulbGeom.rotateX(Math.PI / 2);
      bulbMat = trackInterior(new MeshBasicMaterial({ color: 0xffe0b2, toneMapped: false }));
      const bulbMesh = trackInterior(new InstancedMesh(bulbGeom, bulbMat, downlightCount));

      const downlightOffsetX = Math.min(shellW * 0.34, Math.max(1.6, shellW * 0.28));
      let dlIdx = 0;
      for (let i = 0; i < downlightRows; i++) {
        const t = (i + 0.55) / (downlightRows + 0.15);
        const z = room.frontWallZ + 1.8 + t * Math.max(1, shellD - 2.8);
        for (const sign of [-1, 1]) {
          const x = shellCenterX + sign * downlightOffsetX;
          tmpMat.makeTranslation(x, room.ceilingY - 0.015, z);
          canMesh.setMatrixAt(dlIdx, tmpMat);
          tmpMat.makeTranslation(x, room.ceilingY - 0.032, z);
          bulbMesh.setMatrixAt(dlIdx, tmpMat);
          dlIdx++;
        }
      }
      canMesh.instanceMatrix.needsUpdate = true;
      bulbMesh.instanceMatrix.needsUpdate = true;
      interiorGroup.add(canMesh, bulbMesh);
    }

    // Side wall pilasters + sconces + wall-wash glow halos
    if (ui.sconcesVisible) {
      const sconceCount = Math.max(2, Math.min(6, Math.round(shellD / 3.5)));
      const pilasterGeom = trackInterior(new BoxGeometry(0.09, room.ceilingY * 0.88, 0.26));
      const pilasterMat = trackInterior(new MeshStandardMaterial({ color: 0x1a1826, roughness: 0.85, metalness: 0.08 }));
      const pilasterMesh = trackInterior(new InstancedMesh(pilasterGeom, pilasterMat, sconceCount * 2));

      const sconceBodyGeom = trackInterior(new BoxGeometry(0.06, 0.56, 0.11));
      const sconceBodyMat = trackInterior(new MeshStandardMaterial({ color: 0x2a2420, roughness: 0.45, metalness: 0.55 }));
      const sconceBodyMesh = trackInterior(new InstancedMesh(sconceBodyGeom, sconceBodyMat, sconceCount * 2));

      const sconceSlitGeom = trackInterior(new BoxGeometry(0.068, 0.46, 0.045));
      sconceSlitMat = trackInterior(new MeshBasicMaterial({ color: sconceAccent.lit, toneMapped: false }));
      const sconceSlitMesh = trackInterior(new InstancedMesh(sconceSlitGeom, sconceSlitMat, sconceCount * 2));

      const sconceGlowTex = createSconceGlowTexture(ui.sconceColor);
      if (sconceGlowTex) trackInterior(sconceGlowTex);
      const sconceGlowGeom = trackInterior(new PlaneGeometry(1.15, 2.3));
      sconceGlowMat = trackInterior(
        new MeshBasicMaterial({
          map: sconceGlowTex,
          transparent: true,
          opacity: 0.58,
          blending: AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      const sconceGlowMesh = trackInterior(new InstancedMesh(sconceGlowGeom, sconceGlowMat, sconceCount * 2));
      const leftWallQuat = new Quaternion().setFromAxisAngle(yAxis, Math.PI / 2);
      const rightWallQuat = new Quaternion().setFromAxisAngle(yAxis, -Math.PI / 2);

      for (let i = 0; i < sconceCount; i++) {
        const t = (i + 0.65) / (sconceCount + 0.35);
        const z = Math.max(1.4, room.frontWallZ + 1.8) + t * Math.max(1, room.depthM - 1.6);
        const sconceY = Math.min(room.ceilingY - 1.0, 2.0 + t * room.maxFloorY);

        tmpMat.makeTranslation(-leftMargin + 0.045, room.ceilingY * 0.46, z);
        pilasterMesh.setMatrixAt(i * 2, tmpMat);
        tmpMat.makeTranslation(room.widthM + rightMargin - 0.045, room.ceilingY * 0.46, z);
        pilasterMesh.setMatrixAt(i * 2 + 1, tmpMat);

        tmpMat.makeTranslation(-leftMargin + 0.1, sconceY, z);
        sconceBodyMesh.setMatrixAt(i * 2, tmpMat);
        sconceSlitMesh.setMatrixAt(i * 2, tmpMat);
        tmpMat.makeTranslation(room.widthM + rightMargin - 0.1, sconceY, z);
        sconceBodyMesh.setMatrixAt(i * 2 + 1, tmpMat);
        sconceSlitMesh.setMatrixAt(i * 2 + 1, tmpMat);

        tmpMat.compose(tmpPos.set(-leftMargin + 0.018, sconceY, z), leftWallQuat, tmpScale.set(1, 1, 1));
        sconceGlowMesh.setMatrixAt(i * 2, tmpMat);
        tmpMat.compose(tmpPos.set(room.widthM + rightMargin - 0.018, sconceY, z), rightWallQuat, tmpScale.set(1, 1, 1));
        sconceGlowMesh.setMatrixAt(i * 2 + 1, tmpMat);
      }
      pilasterMesh.instanceMatrix.needsUpdate = true;
      sconceBodyMesh.instanceMatrix.needsUpdate = true;
      sconceSlitMesh.instanceMatrix.needsUpdate = true;
      sconceGlowMesh.instanceMatrix.needsUpdate = true;
      interiorGroup.add(pilasterMesh, sconceBodyMesh, sconceSlitMesh, sconceGlowMesh);
    }

    // Side-wall angled surround speakers (2 InstancedMeshes total across both walls)
    if (ui.surroundSpeakersVisible) {
      const spkCount = Math.max(2, Math.min(5, Math.round(shellD / 4.2)));
      const spkCabinetGeom = trackInterior(new BoxGeometry(0.18, 0.36, 0.26));
      const spkCabinetMat = trackInterior(new MeshStandardMaterial({ color: 0x111118, roughness: 0.72, metalness: 0.22 }));
      const spkCabinetMesh = trackInterior(new InstancedMesh(spkCabinetGeom, spkCabinetMat, spkCount * 2));

      const spkGrilleGeom = trackInterior(new BoxGeometry(0.025, 0.3, 0.21));
      spkGrilleGeom.translate(0.088, 0, 0);
      const spkGrilleMat = trackInterior(new MeshStandardMaterial({ color: 0x262634, roughness: 0.55, metalness: 0.35 }));
      const spkGrilleMesh = trackInterior(new InstancedMesh(spkGrilleGeom, spkGrilleMat, spkCount * 2));

      const leftSpkQuat = new Quaternion().setFromEuler(new Euler(0, 0, -0.24));
      const rightSpkQuat = new Quaternion().setFromEuler(new Euler(0, Math.PI, -0.24));

      for (let i = 0; i < spkCount; i++) {
        const t = (i + 0.32) / (spkCount + 0.15);
        const z = Math.max(2.1, room.frontWallZ + 2.4) + t * Math.max(1, room.depthM - 2.4);
        const spkY = Math.min(room.ceilingY - 0.72, Math.max(2.45, 2.35 + t * room.maxFloorY));

        tmpMat.compose(tmpPos.set(-leftMargin + 0.11, spkY, z), leftSpkQuat, tmpScale.set(1, 1, 1));
        spkCabinetMesh.setMatrixAt(i * 2, tmpMat);
        spkGrilleMesh.setMatrixAt(i * 2, tmpMat);

        tmpMat.compose(tmpPos.set(room.widthM + rightMargin - 0.11, spkY, z), rightSpkQuat, tmpScale.set(1, 1, 1));
        spkCabinetMesh.setMatrixAt(i * 2 + 1, tmpMat);
        spkGrilleMesh.setMatrixAt(i * 2 + 1, tmpMat);
      }
      spkCabinetMesh.instanceMatrix.needsUpdate = true;
      spkGrilleMesh.instanceMatrix.needsUpdate = true;
      interiorGroup.add(spkCabinetMesh, spkGrilleMesh);
    }

    // Overhead ceiling speaker arrays (2 symmetrical rows angled gently toward the audience)
    if (ui.ceilingSpeakersVisible) {
      const overheadRows = Math.max(2, Math.min(5, Math.round(shellD / 3.6)));
      const overheadCount = overheadRows * 2;
      const mountGeom = trackInterior(new BoxGeometry(0.08, 0.1, 0.08));
      const mountMat = trackInterior(new MeshStandardMaterial({ color: 0x0b0b12, roughness: 0.7, metalness: 0.35 }));
      const mountMesh = trackInterior(new InstancedMesh(mountGeom, mountMat, overheadCount));

      const ovCabGeom = trackInterior(new BoxGeometry(0.3, 0.15, 0.34));
      const ovCabMat = trackInterior(new MeshStandardMaterial({ color: 0x111119, roughness: 0.72, metalness: 0.24 }));
      const ovCabMesh = trackInterior(new InstancedMesh(ovCabGeom, ovCabMat, overheadCount));

      const ovGrilleGeom = trackInterior(new BoxGeometry(0.25, 0.025, 0.28));
      ovGrilleGeom.translate(0, -0.075, 0);
      const ovGrilleMat = trackInterior(new MeshStandardMaterial({ color: 0x262634, roughness: 0.55, metalness: 0.36 }));
      const ovGrilleMesh = trackInterior(new InstancedMesh(ovGrilleGeom, ovGrilleMat, overheadCount));

      const offsetX = Math.min(shellW * 0.22, Math.max(1.2, shellW * 0.18));
      const startZ = Math.max(1.8, room.frontWallZ + 2.2);
      const endZ = Math.max(startZ + 1.2, room.backWallZ - 1.5);
      const leftOvQuat = new Quaternion().setFromEuler(new Euler(0.14, 0, 0.22));
      const rightOvQuat = new Quaternion().setFromEuler(new Euler(0.14, 0, -0.22));

      let ovIdx = 0;
      for (let i = 0; i < overheadRows; i++) {
        const t = overheadRows === 1 ? 0.5 : i / (overheadRows - 1);
        const z = startZ + t * (endZ - startZ);
        for (const side of [-1, 1] as const) {
          const x = shellCenterX + side * offsetX;
          const q = side < 0 ? leftOvQuat : rightOvQuat;
          tmpMat.makeTranslation(x, room.ceilingY - 0.05, z);
          mountMesh.setMatrixAt(ovIdx, tmpMat);
          tmpMat.compose(tmpPos.set(x, room.ceilingY - 0.15, z), q, tmpScale.set(1, 1, 1));
          ovCabMesh.setMatrixAt(ovIdx, tmpMat);
          ovGrilleMesh.setMatrixAt(ovIdx, tmpMat);
          ovIdx++;
        }
      }
      mountMesh.instanceMatrix.needsUpdate = true;
      ovCabMesh.instanceMatrix.needsUpdate = true;
      ovGrilleMesh.instanceMatrix.needsUpdate = true;
      interiorGroup.add(mountMesh, ovCabMesh, ovGrilleMesh);
    }

    // Architectural Cove LED strips (ceiling perimeter and/or raked lower-wall rail, dimming cleanly with house lights)
    if (ui.coveLedVisible) {
      const coveChannelMat = trackInterior(
        new MeshStandardMaterial({ color: 0x0c0b14, roughness: 0.82, metalness: 0.18 }),
      );
      coveStripMat = trackInterior(new MeshBasicMaterial({ color: coveAccent.lit, toneMapped: false }));
      const coveWashTex = createCoveWashTexture(ui.coveLedColor);
      if (coveWashTex) trackInterior(coveWashTex);
      coveWashMat = trackInterior(
        new MeshBasicMaterial({
          map: coveWashTex,
          transparent: true,
          opacity: 0.45,
          blending: AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );

      const coveZMin = room.frontWallZ + 0.25;
      const coveZMax = room.backWallZ - 0.25;
      const coveLen = Math.max(0.8, coveZMax - coveZMin);
      const coveMidZ = (coveZMin + coveZMax) / 2;

      if (ui.coveLedPlacement === "ceiling" || ui.coveLedPlacement === "both") {
        const troughGeom = trackInterior(new BoxGeometry(0.14, 0.075, coveLen));
        const stripGeom = trackInterior(new BoxGeometry(0.032, 0.022, coveLen - 0.08));
        const washGeom = trackInterior(new PlaneGeometry(coveLen, 0.72));

        for (const isLeft of [true, false]) {
          const wallX = isLeft ? -leftMargin : room.widthM + rightMargin;
          const inward = isLeft ? 1 : -1;

          const trough = new Mesh(troughGeom, coveChannelMat);
          trough.position.set(wallX + inward * 0.075, room.ceilingY - 0.045, coveMidZ);
          interiorGroup.add(trough);

          const strip = new Mesh(stripGeom, coveStripMat);
          strip.position.set(wallX + inward * 0.155, room.ceilingY - 0.03, coveMidZ);
          interiorGroup.add(strip);

          const wash = new Mesh(washGeom, coveWashMat);
          wash.position.set(wallX + inward * 0.014, room.ceilingY - 0.41, coveMidZ);
          wash.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;
          interiorGroup.add(wash);
        }
      }

      if (ui.coveLedPlacement === "wall" || ui.coveLedPlacement === "both") {
        const firstRowZ = room.rowFloors.length > 0 ? room.rowFloors[0].z : Math.max(1.5, room.frontWallZ + 1.5);
        const lastRowZ =
          room.rowFloors.length > 0 ? room.rowFloors[room.rowFloors.length - 1].z : Math.max(firstRowZ + 1, room.backWallZ - 1);
        const floorYAtZ = (z: number) => {
          if (z <= firstRowZ || lastRowZ <= firstRowZ) return 0;
          const t = Math.min(1, Math.max(0, (z - firstRowZ) / (lastRowZ - firstRowZ)));
          return t * room.maxFloorY;
        };

        // Split wall rail into true architectural zones (flat front floor -> raked stadium slope -> rear landing)
        const baseZones: [number, number][] = [];
        const frontEnd = Math.min(coveZMax, Math.max(coveZMin, firstRowZ));
        const slopeEnd = Math.min(coveZMax, Math.max(frontEnd, lastRowZ));
        if (frontEnd - coveZMin > 0.3) baseZones.push([coveZMin, frontEnd]);
        if (slopeEnd - frontEnd > 0.3) baseZones.push([frontEnd, slopeEnd]);
        if (coveZMax - slopeEnd > 0.3) baseZones.push([slopeEnd, coveZMax]);

        for (const isLeft of [true, false]) {
          const sideName = isLeft ? "left" : "right";
          const holes: [number, number][] = room.entrances
            .filter((e) => e.side === sideName)
            .map((e) => [e.z - 0.85, e.z + 0.85]);
          const segments = baseZones.flatMap(([z0, z1]) => splitIntervalsAroundHoles(z0, z1, holes));
          const wallX = isLeft ? -leftMargin : room.widthM + rightMargin;
          const inward = isLeft ? 1 : -1;

          for (const [za, zb] of segments) {
            const ya = floorYAtZ(za) + 0.24;
            const yb = floorYAtZ(zb) + 0.24;
            const segLen = Math.hypot(zb - za, yb - ya);
            if (segLen < 0.3) continue;
            const slope = Math.atan2(yb - ya, zb - za);
            const midZ = (za + zb) / 2;
            const midY = (ya + yb) / 2;

            const segGroup = new Group();
            segGroup.position.set(wallX, midY, midZ);
            segGroup.rotation.x = -slope;

            const rail = new Mesh(trackInterior(new BoxGeometry(0.045, 0.045, segLen)), coveChannelMat);
            rail.position.set(inward * 0.025, 0, 0);
            segGroup.add(rail);

            const led = new Mesh(trackInterior(new BoxGeometry(0.022, 0.02, segLen - 0.04)), coveStripMat);
            led.position.set(inward * 0.052, 0.008, 0);
            segGroup.add(led);

            const wash = new Mesh(trackInterior(new PlaneGeometry(segLen, 0.42)), coveWashMat);
            wash.position.set(inward * 0.015, 0.23, 0);
            wash.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;
            // Flip upward so bright edge hugs the bottom rail and fades cleanly upward along the wall
            wash.rotation.z = Math.PI;
            segGroup.add(wash);

            interiorGroup.add(segGroup);
          }
        }
      }
    }

    // Rear projection booth window
    if (ui.projectionPortVisible) {
      const portFrameGeom = trackInterior(new BoxGeometry(1.65, 0.56, 0.07));
      const portFrameMat = trackInterior(new MeshStandardMaterial({ color: 0x09080f, roughness: 0.6, metalness: 0.35 }));
      const portFrame = new Mesh(portFrameGeom, portFrameMat);
      portFrame.position.set(room.projectionPort.x, room.projectionPort.y, room.projectionPort.z - 0.035);
      interiorGroup.add(portFrame);

      const portGlassGeom = trackInterior(new PlaneGeometry(1.44, 0.38));
      portGlassMat = trackInterior(new MeshBasicMaterial({ color: 0x8db4f8, toneMapped: false }));
      const portGlass = new Mesh(portGlassGeom, portGlassMat);
      portGlass.position.set(room.projectionPort.x, room.projectionPort.y, room.projectionPort.z - 0.074);
      portGlass.rotation.y = Math.PI;
      interiorGroup.add(portGlass);
    }

    // Volumetric projector beam
    if (ui.projectorBeamVisible) {
      const lensVec = new Vector3(room.projectionPort.x, room.projectionPort.y, room.projectionPort.z - 0.1);
      const screenCenterVec = new Vector3(room.screen.centreX, room.screen.centerY, room.screen.centerZ + 0.05);
      const beamLength = lensVec.distanceTo(screenCenterVec);
      const beamGeom = trackInterior(new CylinderGeometry(1, 0.06, beamLength, 32, 1, true));
      beamOpacityUniform = { value: 0.08 };
      const beamMat = trackInterior(
        new ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
          blending: AdditiveBlending,
          uniforms: {
            uOpacity: beamOpacityUniform,
            uColor: { value: new Color(0x9fc2ff) },
          },
          vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
          fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float facing = pow(abs(dot(normalize(vWorldNormal), viewDir)), 2.8);
          float ends = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
          float alpha = facing * ends * uOpacity;
          gl_FragColor = vec4(uColor * alpha, alpha);
        }
      `,
        }),
      );
      const beamMesh = new Mesh(beamGeom, beamMat);
      const beamAxis = new Vector3().subVectors(screenCenterVec, lensVec).normalize();
      const upRef = new Vector3(0, 1, 0);
      const beamX = new Vector3().crossVectors(beamAxis, upRef).normalize();
      const beamZ = new Vector3().crossVectors(beamX, beamAxis).normalize();
      beamMesh.matrixAutoUpdate = false;
      beamMesh.matrix
        .makeBasis(beamX, beamAxis, beamZ)
        .scale(new Vector3(room.screen.width * 0.44, 1, room.screen.height * 0.44))
        .setPosition(lensVec.clone().add(screenCenterVec).multiplyScalar(0.5));
      beamMesh.renderOrder = 8;
      interiorGroup.add(beamMesh);
    }

    // Luminous LED step-nosing strips along open vertical & side aisles (omitted on aisle-fill rows)
    if (ui.aisleLedVisible && room.aisleLights.length > 0) {
      const aisleLedMat = trackInterior(
        new MeshBasicMaterial({ color: AISLE_LED_HEX[ui.aisleLedColor] ?? AISLE_LED_HEX.amber, toneMapped: false }),
      );
      const stripGeom = trackInterior(new BoxGeometry(1, 0.02, 0.028));
      const stripMesh = trackInterior(new InstancedMesh(stripGeom, aisleLedMat, room.aisleLights.length));
      room.aisleLights.forEach((light, i) => {
        tmpMat.compose(
          tmpPos.set(light.x, light.y + 0.011, light.z),
          tmpQuat.identity(),
          tmpScale.set(light.widthM, 1, 1),
        );
        stripMesh.setMatrixAt(i, tmpMat);
      });
      stripMesh.instanceMatrix.needsUpdate = true;
      interiorGroup.add(stripMesh);
    }

    // Illuminated Row Letter Markers (`A, B, C...`) along vertical aisles or side walls (2 draw calls total)
    if (ui.rowMarkersVisible && room.seats.length > 0) {
      const rowMap = new Map<
        number,
        { row: string; rowIndex: number; z: number; floorY: number; seats: SceneSeat[] }
      >();
      for (const s of room.seats) {
        const entry = rowMap.get(s.rowIndex);
        if (entry) {
          entry.seats.push(s);
        } else {
          rowMap.set(s.rowIndex, { row: s.row, rowIndex: s.rowIndex, z: s.z, floorY: s.floorY, seats: [s] });
        }
      }
      const rows = [...rowMap.values()].sort((a, b) => a.rowIndex - b.rowIndex);
      const atlas = createRowMarkerAtlas(
        rows.map((r) => r.row),
        ui.rowMarkersColor,
      );

      if (atlas) {
        trackInterior(atlas.texture);
        const faceGeoms: BufferGeometry[] = [];
        const plaqueMats: Matrix4[] = [];
        const isWall = ui.rowMarkersPlacement === "wall";
        const markerSize = isWall ? 0.26 : 0.22;
        const leftWallQuat = new Quaternion().setFromAxisAngle(yAxis, Math.PI / 2);
        const rightWallQuat = new Quaternion().setFromAxisAngle(yAxis, -Math.PI / 2);
        const aisleTiltQuat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.38);
        const faceOffset = new Vector3();
        const postPositions: Vector3[] = [];

        const pushMarker = (rowSlot: number, pos: Vector3, quat: Quaternion) => {
          const gx = rowSlot % atlas.cols;
          const gy = Math.floor(rowSlot / atlas.cols);
          const u0 = gx / atlas.cols;
          const u1 = (gx + 1) / atlas.cols;
          const v1 = 1 - gy / atlas.gridRows;
          const v0 = 1 - (gy + 1) / atlas.gridRows;

          const plane = new PlaneGeometry(markerSize, markerSize);
          const uv = plane.attributes.uv;
          for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
          }
          faceOffset.set(0, 0, 0.013).applyQuaternion(quat);
          tmpMat.compose(tmpPos.copy(pos).add(faceOffset), quat, tmpScale.set(1, 1, 1));
          plane.applyMatrix4(tmpMat);
          faceGeoms.push(plane);

          const m = new Matrix4().compose(pos, quat, new Vector3(1, 1, 1));
          plaqueMats.push(m);
        };

        const roomMidX = room.widthM / 2;
        rows.forEach((r, slot) => {
          if (isWall) {
            const leftBlocked = room.entrances.some((e) => e.side === "left" && Math.abs(e.z - r.z) < 0.95);
            const rightBlocked = room.entrances.some((e) => e.side === "right" && Math.abs(e.z - r.z) < 0.95);
            const markerY = Math.min(room.ceilingY - 0.5, r.floorY + 1.24);
            if (!leftBlocked) {
              pushMarker(slot, new Vector3(-leftMargin + 0.022, markerY, r.z), leftWallQuat);
            }
            if (!rightBlocked) {
              pushMarker(slot, new Vector3(room.widthM + rightMargin - 0.022, markerY, r.z), rightWallQuat);
            }
            return;
          }

          // Aisle mode: mount sleek grounded armrest-side row standards flanking open vertical aisles (never blocking walkway center)
          const xs: number[] = [];
          if (room.verticalAislesM.length > 0) {
            for (const aisleX of room.verticalAislesM) {
              const filled = r.seats.some((s) => Math.abs(s.x - aisleX) < room.seatPitchM * (s.span * 0.5 + 0.3));
              if (filled) continue;
              const preferRight = aisleX < roomMidX;
              let anchorX = aisleX;
              if (preferRight) {
                const rightSeats = r.seats.filter((s) => s.x > aisleX).sort((a, b) => a.x - b.x);
                if (rightSeats.length > 0) {
                  const s = rightSeats[0];
                  anchorX = s.x - s.span * room.seatPitchM * 0.5 - 0.14;
                }
              } else {
                const leftSeats = r.seats.filter((s) => s.x < aisleX).sort((a, b) => b.x - a.x);
                if (leftSeats.length > 0) {
                  const s = leftSeats[0];
                  anchorX = s.x + s.span * room.seatPitchM * 0.5 + 0.14;
                }
              }
              xs.push(anchorX);
            }
          }
          if (xs.length === 0) {
            let minEdge = Infinity;
            let maxEdge = -Infinity;
            for (const s of r.seats) {
              const half = s.span * room.seatPitchM * 0.5;
              if (s.x - half < minEdge) minEdge = s.x - half;
              if (s.x + half > maxEdge) maxEdge = s.x + half;
            }
            if (Number.isFinite(minEdge)) {
              xs.push(Math.max(-leftMargin + 0.18, minEdge - 0.16));
              xs.push(Math.min(room.widthM + rightMargin - 0.18, maxEdge + 0.16));
            }
          }
          for (const mx of xs) {
            pushMarker(slot, new Vector3(mx, r.floorY + 0.54, r.z + 0.14), aisleTiltQuat);
            postPositions.push(new Vector3(mx, r.floorY + 0.25, r.z + 0.12));
          }
        });

        if (faceGeoms.length > 0) {
          const mergedFaces = mergeGeometries(faceGeoms, false);
          for (const g of faceGeoms) g.dispose();
          if (mergedFaces) {
            trackInterior(mergedFaces);
            const faceMat = trackInterior(new MeshBasicMaterial({ map: atlas.texture, toneMapped: false }));
            interiorGroup.add(new Mesh(mergedFaces, faceMat));
          }
          const plaqueGeom = trackInterior(new BoxGeometry(markerSize + 0.025, markerSize + 0.025, 0.022));
          const plaqueMat = trackInterior(
            new MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.72, metalness: 0.25 }),
          );
          const plaqueMesh = trackInterior(new InstancedMesh(plaqueGeom, plaqueMat, plaqueMats.length));
          plaqueMats.forEach((m, i) => plaqueMesh.setMatrixAt(i, m));
          plaqueMesh.instanceMatrix.needsUpdate = true;
          interiorGroup.add(plaqueMesh);

          if (postPositions.length > 0) {
            const postGeom = trackInterior(new BoxGeometry(0.04, 0.5, 0.04));
            const postMesh = trackInterior(new InstancedMesh(postGeom, plaqueMat, postPositions.length));
            postPositions.forEach((p, i) => {
              tmpMat.makeTranslation(p.x, p.y, p.z);
              postMesh.setMatrixAt(i, tmpMat);
            });
            postMesh.instanceMatrix.needsUpdate = true;
            interiorGroup.add(postMesh);
          }
        }
      }
    }

    // Front stage apron & optional recessed stage-lip LED
    if (ui.screenStageApron) {
      const apronH = Math.min(0.22, Math.max(0.1, room.screen.bottom * 0.22));
      const apronD = Math.max(0.68, -room.frontWallZ + 0.48);
      const apronGeom = trackInterior(new BoxGeometry(shellW - 0.04, apronH, apronD));
      const apronMat = trackInterior(new MeshStandardMaterial({ color: 0x0c0b12, roughness: 0.92, metalness: 0.04 }));
      const apronMesh = new Mesh(apronGeom, apronMat);
      apronMesh.position.set(shellCenterX, apronH / 2, room.frontWallZ + apronD / 2);
      interiorGroup.add(apronMesh);

      if (ui.screenStageLed) {
        const stageLedGeom = trackInterior(new BoxGeometry(Math.min(shellW - 0.6, room.screen.width * 1.02), 0.018, 0.02));
        stageLedMat = trackInterior(new MeshBasicMaterial({ color: 0x7c5838, toneMapped: false }));
        const stageLed = new Mesh(stageLedGeom, stageLedMat);
        stageLed.position.set(room.screen.centreX, apronH - 0.012, room.frontWallZ + apronD + 0.008);
        interiorGroup.add(stageLed);
      }
    }

    // Soft additive ambient wall glow behind the screen masking
    if (ui.screenHalo) {
      const haloTex = createScreenHaloTexture();
      if (haloTex) trackInterior(haloTex);
      const haloGeom = trackInterior(new PlaneGeometry(room.screen.width * 1.48, room.screen.height * 1.62));
      haloMat = trackInterior(
        new MeshBasicMaterial({
          map: haloTex,
          transparent: true,
          opacity: 0.42,
          blending: AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      const haloMesh = new Mesh(haloGeom, haloMat);
      haloMesh.position.set(room.screen.centreX, room.screen.centerY, room.frontWallZ + 0.03);
      interiorGroup.add(haloMesh);
    }

    // Solid architectural mounting shroud + tilted screen assembly
    const borderPad = ui.screenBorder === "velvet" ? 0.48 : ui.screenBorder === "slim" ? 0.16 : 0.04;
    const frameW = room.screen.width + borderPad;
    const frameH = room.screen.height + borderPad;

    // Proscenium pleated velvet curtains flanking both sides of the cinema screen
    if (ui.screenCurtainsVisible) {
      const apronH = ui.screenStageApron ? Math.min(0.22, Math.max(0.1, room.screen.bottom * 0.22)) : 0;
      const curtainBottomY = apronH;
      const curtainH = Math.max(0.6, room.ceilingY - curtainBottomY);
      const curtainCenterY = curtainBottomY + curtainH / 2;
      const curtainZ = room.frontWallZ + 0.13;
      const curtainHex = parseHexOrRgb(ui.screenCurtainsColor) ?? 0x2b0c14;
      const curtainMat = trackInterior(
        new MeshStandardMaterial({ color: curtainHex, roughness: 0.94, metalness: 0.02 }),
      );
      const curtainBackMat = trackInterior(
        new MeshStandardMaterial({
          color: new Color(curtainHex).multiplyScalar(0.55),
          roughness: 0.96,
          metalness: 0.01,
        }),
      );

      const leftStart = -leftMargin + 0.03;
      const leftEnd = room.screen.centreX - frameW / 2 + 0.06;
      const rightStart = room.screen.centreX + frameW / 2 - 0.06;
      const rightEnd = room.widthM + rightMargin - 0.03;
      const sides: [number, number][] = [];
      if (leftEnd - leftStart > 0.16) sides.push([leftStart, leftEnd]);
      if (rightEnd - rightStart > 0.16) sides.push([rightStart, rightEnd]);

      const pleatPositions: { x: number; z: number }[] = [];
      for (const [x0, x1] of sides) {
        const span = x1 - x0;
        const backPlane = new Mesh(trackInterior(new PlaneGeometry(span, curtainH)), curtainBackMat);
        backPlane.position.set((x0 + x1) / 2, curtainCenterY, curtainZ - 0.075);
        interiorGroup.add(backPlane);

        const count = Math.max(3, Math.min(18, Math.round(span / 0.18)));
        for (let p = 0; p < count; p++) {
          const px = x0 + ((p + 0.5) / count) * span;
          const pz = curtainZ + (p % 2 === 0 ? 0.024 : -0.024);
          pleatPositions.push({ x: px, z: pz });
        }
      }

      if (pleatPositions.length > 0) {
        const pleatGeom = trackInterior(new CylinderGeometry(0.105, 0.115, curtainH, 10));
        const pleatMesh = trackInterior(new InstancedMesh(pleatGeom, curtainMat, pleatPositions.length));
        pleatPositions.forEach((p, i) => {
          tmpMat.compose(tmpPos.set(p.x, curtainCenterY, p.z), tmpQuat.identity(), tmpScale.set(1, 1, 1.18));
          pleatMesh.setMatrixAt(i, tmpMat);
        });
        pleatMesh.instanceMatrix.needsUpdate = true;
        interiorGroup.add(pleatMesh);
      }

      // Optional upper proscenium pelmet valance when clear space exists above the screen frame
      const topGap = room.ceilingY - (room.screen.centerY + frameH / 2);
      if (topGap >= 0.28) {
        const pelmetH = Math.min(0.32, topGap * 0.72);
        const pelmet = new Mesh(
          trackInterior(new BoxGeometry(shellW - 0.06, pelmetH, 0.22)),
          curtainMat,
        );
        pelmet.position.set(shellCenterX, room.ceilingY - pelmetH / 2, curtainZ + 0.04);
        interiorGroup.add(pelmet);
      }
    }
    const housingGeom = trackInterior(
      buildScreenHousingGeometry(
        frameW,
        frameH,
        room.screen.centerY,
        room.screen.centerZ,
        screenTiltRad,
        room.screen.curveDepth,
        room.frontWallZ,
      ),
    );
    const housingMat = trackInterior(new MeshStandardMaterial({ color: 0x11101a, roughness: 0.78, metalness: 0.22 }));
    const housingMesh = new Mesh(housingGeom, housingMat);
    housingMesh.position.set(room.screen.centreX, 0, 0);
    interiorGroup.add(housingMesh);

    const screenGroup = new Group();
    screenGroup.position.set(room.screen.centreX, room.screen.centerY, room.screen.centerZ);
    screenGroup.rotation.x = screenTiltRad;

    if (ui.screenBorder !== "frameless") {
      const frameGeom = trackInterior(buildScreenGeometry(frameW, frameH, room.screen.curveDepth));
      const frameMat = trackInterior(new MeshBasicMaterial({ color: 0x030306 }));
      const frameMesh = new Mesh(frameGeom, frameMat);
      frameMesh.position.set(0, 0, -0.045);
      screenGroup.add(frameMesh);
    }

    const screenGeom = trackInterior(buildScreenGeometry(room.screen.width, room.screen.height, room.screen.curveDepth));
    const effectiveSubtitle = ui.screenSubtitleText.trim() || options.subtitleText || "Sample subtitle · Phụ đề mẫu";
    const youtubeId = ui.screenSource === "youtube" ? parseYoutubeId(ui.screenYoutubeUrl) : null;
    let screenMat: MeshBasicMaterial;

    if (youtubeId) {
      syncYoutubeLayer(youtubeId);
      // Depth-tested alpha cutout: punches a transparent window through frontWall/frame while chairs & audience still occlude the video.
      screenMat = trackInterior(
        new MeshBasicMaterial({
          color: 0x000000,
          opacity: 0,
          blending: NoBlending,
          side: FrontSide,
          toneMapped: false,
          fog: false,
        }),
      );
    } else {
      syncYoutubeLayer(null);
      const customImageUrl = ui.screenSource === "image" ? ui.screenImageUrl.trim() : "";
      const cachedImg = customImageUrl ? cachedLoadedImages.get(customImageUrl) : undefined;
      const initialTexture =
        (cachedImg
          ? createCustomImageScreenTexture(cachedImg, ui.screenShowSubtitle, effectiveSubtitle, ui.screenSubtitleColor)
          : null) ??
        createScreenTexture(
          ui.screenContent,
          ui.screenShowSubtitle,
          effectiveSubtitle,
          ui.screenSubtitleColor,
        );
      if (initialTexture) trackInterior(initialTexture);
      screenMat = trackInterior(
        initialTexture
          ? new MeshBasicMaterial({ map: initialTexture, toneMapped: false })
          : new MeshBasicMaterial({ color: 0xe8e0ff, toneMapped: false }),
      );

      if (customImageUrl && !cachedImg) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onload = () => {
          if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
          putLoadedImageCache(customImageUrl, img);
          if (disposed || buildToken !== interiorBuildToken) return;
          const customTex = createCustomImageScreenTexture(
            img,
            ui.screenShowSubtitle,
            effectiveSubtitle,
            ui.screenSubtitleColor,
          );
          if (!customTex) return;
          const prevMap = screenMat.map;
          screenMat.map = customTex;
          screenMat.needsUpdate = true;
          trackInterior(customTex);
          prevMap?.dispose();
          requestRender();
        };
        img.src = customImageUrl;
      }
    }
    const screenMesh = new Mesh(screenGeom, screenMat);
    screenGroup.add(screenMesh);
    interiorGroup.add(screenGroup);

    // Exit Doors (QCVN 06:2022/BXD: 1.30 m × 2.10 m) & Backlit EXIT Signs
    if (room.entrances.length > 0) {
      const doorH = 2.1;
      const doorW = 1.3;
      const doorFrameHex = parseHexOrRgb(ui.doorFrameColor) ?? 0x1e1c28;
      const doorHex = parseHexOrRgb(ui.doorColor) ?? 0x0a0a10;
      const doorFrameGeom = trackInterior(new BoxGeometry(0.11, doorH + 0.12, doorW + 0.16));
      const doorFrameMat = trackInterior(new MeshStandardMaterial({ color: doorFrameHex, roughness: 0.72, metalness: 0.25 }));
      const doorGeom = trackInterior(new BoxGeometry(0.08, doorH, doorW));
      const doorMat = trackInterior(
        new MeshStandardMaterial({
          color: doorHex,
          roughness: ui.doorStyle === "curtain" ? 0.96 : 0.85,
          metalness: ui.doorStyle === "curtain" ? 0.02 : 0.15,
        }),
      );

      const seamGeom = ui.doorStyle === "double" ? trackInterior(new BoxGeometry(0.095, doorH - 0.04, 0.025)) : null;
      const seamMat = ui.doorStyle === "double" ? trackInterior(new MeshStandardMaterial({ color: 0x050508, roughness: 0.95 })) : null;
      const pleatGeom = ui.doorStyle === "curtain" ? trackInterior(new CylinderGeometry(0.06, 0.06, doorH - 0.04, 8)) : null;
      const barGeom =
        ui.doorStyle !== "curtain" && ui.doorPanicBar
          ? trackInterior(new BoxGeometry(0.11, 0.055, ui.doorStyle === "double" ? doorW * 0.36 : doorW * 0.68))
          : null;
      const barMat = barGeom
        ? trackInterior(new MeshStandardMaterial({ color: 0x6b7280, roughness: 0.35, metalness: 0.8 }))
        : null;

      let signBoxGeom: BoxGeometry | null = null;
      let signBoxMat: MeshStandardMaterial | null = null;
      let signFaceGeom: PlaneGeometry | null = null;
      let signFaceMat: MeshBasicMaterial | null = null;
      if (ui.exitSignVisible) {
        const exitTex = createExitSignTexture(ui.exitSignColor, ui.exitSignText);
        if (exitTex) trackInterior(exitTex);
        signBoxGeom = trackInterior(new BoxGeometry(0.08, 0.2, 0.48));
        signBoxMat = trackInterior(new MeshStandardMaterial({ color: 0x0b0f10, roughness: 0.6 }));
        signFaceGeom = trackInterior(new PlaneGeometry(0.44, 0.17));
        signFaceMat = trackInterior(
          exitTex
            ? new MeshBasicMaterial({ map: exitTex, toneMapped: false })
            : new MeshBasicMaterial({ color: ui.exitSignColor === "red" ? 0xdc2626 : 0x22c55e, toneMapped: false }),
        );
      }

      for (const e of room.entrances) {
        const group = new Group();
        const doorFrame = new Mesh(doorFrameGeom, doorFrameMat);
        const door = new Mesh(doorGeom, doorMat);

        doorFrame.position.set(0, (doorH + 0.12) / 2, 0);
        door.position.set(0, doorH / 2, 0);
        group.add(doorFrame, door);

        if (ui.doorStyle === "curtain" && pleatGeom) {
          const pleatCount = 6;
          for (let p = 0; p < pleatCount; p++) {
            const zOff = -doorW / 2 + ((p + 0.5) / pleatCount) * doorW;
            const pleat = new Mesh(pleatGeom, doorMat);
            pleat.position.set(0.032, doorH / 2, zOff);
            group.add(pleat);
          }
        } else {
          if (seamGeom && seamMat) {
            const seam = new Mesh(seamGeom, seamMat);
            seam.position.set(0.005, doorH / 2, 0);
            group.add(seam);
          }
          if (barGeom && barMat) {
            if (ui.doorStyle === "double") {
              const leftBar = new Mesh(barGeom, barMat);
              leftBar.position.set(0.02, 1.02, -doorW * 0.24);
              const rightBar = new Mesh(barGeom, barMat);
              rightBar.position.set(0.02, 1.02, doorW * 0.24);
              group.add(leftBar, rightBar);
            } else {
              const bar = new Mesh(barGeom, barMat);
              bar.position.set(0.02, 1.02, 0);
              group.add(bar);
            }
          }
        }

        if (signBoxGeom && signBoxMat && signFaceGeom && signFaceMat) {
          const signBox = new Mesh(signBoxGeom, signBoxMat);
          const signFace = new Mesh(signFaceGeom, signFaceMat);
          const signY = Math.min(room.ceilingY - e.floorY - 0.18, doorH + 0.24);
          signBox.position.set(0.02, signY, 0);
          signFace.position.set(0.065, signY, 0);
          signFace.rotation.y = Math.PI / 2;
          group.add(signBox, signFace);
        }

        const wallX =
          e.side === "left" ? -leftMargin + 0.05 : e.side === "right" ? room.widthM + rightMargin - 0.05 : e.x;
        const wallZ =
          e.side === "center"
            ? e.position === "back"
              ? room.backWallZ - 0.05
              : room.frontWallZ + 0.05
            : Math.min(room.backWallZ - doorW / 2 - 0.12, Math.max(room.frontWallZ + doorW / 2 + 0.12, e.z));

        if (e.side === "right") group.rotation.y = Math.PI;
        else if (e.side === "center") group.rotation.y = e.position === "back" ? Math.PI / 2 : -Math.PI / 2;

        group.position.set(wallX, e.floorY, wallZ);
        interiorGroup.add(group);
      }
    }
  }

  buildInterior(currentAppearance);

  // --- 3. Sculpted Multi-Material Chairs Grouped by (style, span) ---
  const palette = Array.from({ length: HEAT_STEPS }, (_, i) => cssToHex(heatColor(i, 0, HEAT_STEPS - 1)));
  const resolvedTypeColors = new Map<string, number>();
  for (const seat of room.seats) {
    if (seat.typeColor && !resolvedTypeColors.has(seat.type)) {
      resolvedTypeColors.set(seat.type, cssToHex(seat.typeColor, DEFAULT_SEAT_COLOR));
    }
  }

  interface StyleGroup {
    fabricMesh: InstancedMesh;
    seats: SceneSeat[];
  }
  const byBucket = new Map<string, { style: SeatStyle; span: 1 | 2; seats: SceneSeat[] }>();
  for (const seat of room.seats) {
    const key = `${seat.style}:${seat.span}`;
    const bucket = byBucket.get(key);
    if (bucket) bucket.seats.push(seat);
    else byBucket.set(key, { style: seat.style, span: seat.span, seats: [seat] });
  }

  const styleGroups: StyleGroup[] = [];
  const fabricMaterial = track(
    new MeshStandardMaterial({
      color: 0xffffff,
      roughness: currentAppearance.seatFinish === "leather" ? 0.42 : 0.82,
      metalness: currentAppearance.seatFinish === "leather" ? 0.08 : 0.03,
      vertexColors: true,
    }),
  );
  const frameMaterial = track(
    new MeshStandardMaterial({
      color: parseHexOrRgb(currentAppearance.seatFrameColor) ?? 0x15131c,
      roughness: 0.78,
      metalness: 0.08,
    }),
  );

  for (const { style, span, seats: list } of byBucket.values()) {
    const { fabric, frame } =
      span === 2
        ? buildCoupleChairGeometries(style, room.reclineDeg, room.seatPitchM, room.rowPitchM)
        : buildChairGeometries(style, room.reclineDeg, room.seatPitchM, room.rowPitchM);
    track(fabric);
    track(frame);

    const fabricMesh = track(new InstancedMesh(fabric, fabricMaterial, list.length));
    const frameMesh = track(new InstancedMesh(frame, frameMaterial, list.length));
    list.forEach((seat, i) => {
      tmpQuat.setFromAxisAngle(yAxis, seat.yaw);
      tmpMat.compose(tmpPos.set(seat.x, seat.floorY, seat.z), tmpQuat, tmpScale.set(1, 1, 1));
      fabricMesh.setMatrixAt(i, tmpMat);
      frameMesh.setMatrixAt(i, tmpMat);
    });
    fabricMesh.instanceMatrix.needsUpdate = true;
    frameMesh.instanceMatrix.needsUpdate = true;
    scene.add(fabricMesh);
    scene.add(frameMesh);
    styleGroups.push({ fabricMesh, seats: list });
  }

  // Low-poly 12-triangle box proxy per seat for O(1)-cost raycasting (never added to `scene`, zero draw calls).
  let pickMesh: InstancedMesh | null = null;
  if (room.seats.length > 0) {
    const pickGeom = track(new BoxGeometry(1, 1, 1));
    const pickMat = track(new MeshBasicMaterial());
    pickMesh = track(new InstancedMesh(pickGeom, pickMat, room.seats.length));
    room.seats.forEach((seat, i) => {
      const w = seat.span * room.seatPitchM * 0.98;
      const h = seat.style === "bed" ? 0.85 : 1.1;
      const d = seat.style === "bed" ? Math.min(room.rowPitchM * 0.86, 1.45) : 0.65;
      tmpQuat.setFromAxisAngle(yAxis, seat.yaw);
      tmpMat.compose(tmpPos.set(seat.x, seat.floorY + h / 2, seat.z), tmpQuat, tmpScale.set(w, h, d));
      pickMesh!.setMatrixAt(i, tmpMat);
    });
    pickMesh.instanceMatrix.needsUpdate = true;
    pickMesh.computeBoundingSphere();
  }
  const seatByCode = new Map(room.seats.map((s) => [s.code, s]));

  // Sleek subtle selection halo ring & glowing top bar above selected seat in overview mode
  const selectIndicator = new Group();
  const ringGeom = track(new RingGeometry(0.2, 0.26, 20));
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = track(
    new MeshBasicMaterial({
      color: SELECTED_ACCENT,
      side: DoubleSide,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
    }),
  );
  const selectRing = new Mesh(ringGeom, ringMat);
  selectRing.position.y = 0.024;
  const barCapGeom = track(new BoxGeometry(0.28, 0.024, 0.036));
  const barCapMat = track(new MeshBasicMaterial({ color: 0xffd0dc, toneMapped: false }));
  const selectBar = new Mesh(barCapGeom, barCapMat);
  selectBar.position.set(0, 1.15, 0.16);
  selectIndicator.add(selectRing, selectBar);
  selectIndicator.visible = false;
  scene.add(selectIndicator);

  // --- 6. Contoured Seated Audience Silhouettes (couple seats place 2 viewers) ---
  const audienceCapacity = Math.max(
    1,
    room.seats.reduce((sum, s) => sum + s.span, 0),
  );
  const audienceGeom = track(buildAudienceGeometry(room.reclineDeg, room.eyeDropM));
  const audienceMat = track(
    new MeshStandardMaterial({
      color: 0x161521,
      roughness: 0.9,
      metalness: 0.02,
    }),
  );
  const audienceMesh = track(new InstancedMesh(audienceGeom, audienceMat, audienceCapacity));
  audienceMesh.count = 0;
  audienceMesh.visible = false;
  scene.add(audienceMesh);

  let audienceOn = options.audience;
  let viewerHeightCm = options.viewerHeightCm;
  let frontHeightCm = options.frontHeightCm;
  function updateAudience() {
    const selectedSeat = mode === "seat" && audienceOn && selected ? seatByCode.get(selected) : undefined;
    if (!selectedSeat || room.seats.length === 0) {
      audienceMesh.count = 0;
      audienceMesh.visible = false;
      return;
    }
    // `audienceGeom` already bakes `room.eyeDropM` via spine tilt; only apply viewer stature delta from 170 cm.
    const frontStatureDeltaY = sittingEyeHeightM(frontHeightCm) - EYE_HEIGHT_M;
    const halfPitch = room.seatPitchM / 2;
    let activeCount = 0;
    for (const seat of room.seats) {
      if (seat.broken || seat.rowIndex >= selectedSeat.rowIndex) continue;
      const bedDropY = seat.style === "bed" ? -0.16 : 0;
      tmpQuat.setFromAxisAngle(yAxis, seat.yaw);
      if (seat.span === 2) {
        const dx = Math.cos(seat.yaw) * halfPitch;
        const dz = -Math.sin(seat.yaw) * halfPitch;
        tmpMat.compose(tmpPos.set(seat.x - dx, seat.floorY + frontStatureDeltaY + bedDropY, seat.z - dz), tmpQuat, tmpScale.set(1, 1, 1));
        audienceMesh.setMatrixAt(activeCount++, tmpMat);
        tmpMat.compose(tmpPos.set(seat.x + dx, seat.floorY + frontStatureDeltaY + bedDropY, seat.z + dz), tmpQuat, tmpScale.set(1, 1, 1));
        audienceMesh.setMatrixAt(activeCount++, tmpMat);
      } else {
        tmpMat.compose(tmpPos.set(seat.x, seat.floorY + frontStatureDeltaY + bedDropY, seat.z), tmpQuat, tmpScale.set(1, 1, 1));
        audienceMesh.setMatrixAt(activeCount++, tmpMat);
      }
    }
    audienceMesh.count = activeCount;
    audienceMesh.visible = activeCount > 0;
    if (activeCount > 0) audienceMesh.instanceMatrix.needsUpdate = true;
  }

  // --- 7. Floating User-Mark Badges (gold = favorite, red = avoid) ---
  const markGeom = track(new SphereGeometry(0.082, 10, 8));
  const markMat = track(new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const markMesh = track(new InstancedMesh(markGeom, markMat, Math.max(1, room.seats.length)));
  markMesh.count = 0;
  markMesh.visible = false;
  scene.add(markMesh);

  let marks = options.marks;
  const color = new Color();
  const whiteColor = new Color(0xffffff);
  const hoverColor = new Color(HOVER_ACCENT);
  function updateMarks() {
    if (!marks || marks.size === 0 || room.seats.length === 0) {
      markMesh.count = 0;
      markMesh.visible = false;
      return;
    }
    let activeCount = 0;
    for (const seat of room.seats) {
      const kind = marks.get(seat.code);
      if (!kind || (mode === "seat" && seat.code === selected)) continue;
      tmpMat.compose(
        tmpPos.set(seat.x, seat.floorY + 1.18, seat.z),
        tmpQuat.identity(),
        tmpScale.set(1, 1, 1),
      );
      markMesh.setMatrixAt(activeCount, tmpMat);
      markMesh.setColorAt(activeCount, color.setHex(kind === "favorite" ? FAVORITE_MARK_COLOR : AVOID_MARK_COLOR));
      activeCount++;
    }
    markMesh.count = activeCount;
    markMesh.visible = activeCount > 0;
    if (activeCount > 0) {
      markMesh.instanceMatrix.needsUpdate = true;
      if (markMesh.instanceColor) markMesh.instanceColor.needsUpdate = true;
    }
  }

  let heat = options.heat;
  let selected = options.selected;
  let hoveredCode: string | null = null;

  function updateSelectionIndicator() {
    const s = selected ? seatByCode.get(selected) : undefined;
    if (!s || mode === "seat") {
      selectIndicator.visible = false;
      return;
    }
    selectIndicator.visible = true;
    selectIndicator.position.set(s.x, s.floorY, s.z);
    selectRing.scale.set(s.span === 2 ? 1.65 : 1, 1, 1);
    selectBar.scale.set(s.span === 2 ? 1.9 : 1, 1, 1);
  }

  function paintSeats() {
    for (const group of styleGroups) {
      group.seats.forEach((seat, i) => {
        let hex = resolvedTypeColors.get(seat.type) ?? DEFAULT_SEAT_COLOR;
        if (seat.broken) {
          hex = BROKEN_COLOR;
        } else if (heat) {
          hex = palette[Math.round(heatLevel(seat.score, options.range.min, options.range.max) * (HEAT_STEPS - 1))];
        }
        color.setHex(hex);
        // Subtle organic plush velvet micro-variation across normal rows (just like real cinema fabric)
        if (!heat && !seat.broken) {
          const micro = (((seat.rowIndex * 13 + seat.colIndex * 7) % 5) - 2) * 0.008;
          color.offsetHSL(0, 0.04, micro);
        }
        if (seat.code === selected) {
          color.setHex(SELECTED_ACCENT).lerp(whiteColor, 0.18);
        } else if (seat.code === hoveredCode && mode === "orbit") {
          color.lerp(hoverColor, 0.35);
        }
        group.fabricMesh.setColorAt(i, color);
      });
      if (group.fabricMesh.instanceColor) group.fabricMesh.instanceColor.needsUpdate = true;
    }
    updateSelectionIndicator();
  }

  // --- Dynamic House-Lights Dimmer State (0 = Movie Dimmed, 1 = House Lights On) ---
  let lightsTarget = options.lightsUp ? 1 : 0;
  let lightsLevel = lightsTarget;
  let lightTween: { start: number; from: number; to: number } | null = null;

  function applyLighting(lvl: number) {
    const heatBoost = heat ? 0.24 : 0;
    ambientLight.intensity = 0.16 + 0.5 * lvl + heatBoost;
    hemiLight.intensity = 0.24 + 0.68 * lvl + heatBoost * 0.6;
    ceilingKey.intensity = 0.08 + 1.05 * lvl + heatBoost * 0.4;
    screenBounce.intensity = 30 - 8 * lvl;
    screenFill.intensity = 0.62 - 0.14 * lvl;

    if (bulbMat) bulbMat.color.copy(bulbDimColor).lerp(bulbLitColor, lvl);
    if (sconceSlitMat) sconceSlitMat.color.copy(slitDimColor).lerp(slitLitColor, lvl);
    if (coveStripMat) coveStripMat.color.copy(coveDimColor).lerp(coveLitColor, lvl);
    if (portGlassMat) portGlassMat.color.copy(portDimColor).lerp(portLitColor, lvl);
    if (sconceGlowMat) sconceGlowMat.opacity = 0.22 + 0.44 * lvl;
    if (coveWashMat) coveWashMat.opacity = 0.15 + 0.42 * lvl;
    if (haloMat) haloMat.opacity = 0.48 - 0.24 * lvl;
    if (beamOpacityUniform) beamOpacityUniform.value = mode === "seat" ? (0.045 - 0.03 * lvl) : (0.11 - 0.075 * lvl);
    if (stageLedMat) stageLedMat.color.setHex(lvl > 0.5 ? 0x6e5136 : 0xb87638);
  }

  // --- Camera Rig: Inside-Auditorium Overview + Clamped OrbitControls + Cubic Bézier Fly-To-Seat ---
  const camera = new PerspectiveCamera(ORBIT_FOV, 4 / 3, 0.1, 220);
  camera.rotation.order = "YXZ";
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.9;
  controls.panSpeed = 0.85;
  controls.zoomSpeed = 1.25;
  controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
  controls.minDistance = 1.15;
  controls.maxDistance = Math.max(10, shellD * 1.05);
  controls.minPolarAngle = 0.18;
  // Allow tilting below target height to inspect ceiling, downlights, starlight, screen & projection booth.
  controls.maxPolarAngle = Math.PI * 0.72;

  // Pivot right in the heart of the seating bowl so rotating 360° around the room leaves balanced space
  // to inspect screen, side walls, doors, ceiling, and rear projection booth from any angle.
  const firstZ = room.rowFloors[0]?.z ?? Math.max(2.5, room.depthM * 0.3);
  const lastZ = room.rowFloors[room.rowFloors.length - 1]?.z ?? Math.max(firstZ + 2, room.depthM - 0.6);
  const midSeatingZ = (firstZ + lastZ) / 2;

  const overviewZ = Math.max(
    lastZ + 0.35,
    room.backWallZ - Math.min(0.8, Math.max(0.42, room.rearMarginM * 0.72)),
  );
  const orbitTargetY = Math.min(
    room.ceilingY - 1.4,
    Math.max(room.maxFloorY * 0.52 + 0.85, room.screen.bottom + room.screen.height * 0.32),
  );
  const overviewY = Math.min(
    room.ceilingY - 0.5,
    Math.max(room.maxFloorY + 1.95, orbitTargetY + 1.3),
  );
  const orbitPos = new Vector3(room.shellCenterX, overviewY, overviewZ);
  const orbitTarget = new Vector3(room.screen.centreX, orbitTargetY, midSeatingZ);
  const orbitQuat = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(orbitPos, orbitTarget, yAxis),
  );
  const flightPoint = new Vector3();
  let desiredOrbitDist = orbitPos.distanceTo(orbitTarget);
  let wheelZooming = false;
  let middleDollying = false;

  // Clamp camera & orbit target strictly inside interior architectural walls/ceiling/floor along the camera ray
  // without permanently crushing orbit distance when sweeping past narrow side walls or ceiling.
  const minCamX = -leftMargin + 0.38;
  const maxCamX = room.widthM + rightMargin - 0.38;
  const minCamY = 0.65;
  const maxCamY = Math.max(1.4, room.ceilingY - 0.32);
  const minCamZ = Math.max(0.55, room.screen.topZ + 0.35);
  const maxCamZ = Math.max(1.5, room.backWallZ - 0.32);

  const minTargetX = Math.max(minCamX + 0.2, 0);
  const maxTargetX = Math.min(maxCamX - 0.2, room.widthM);
  const minTargetY = 0.45;
  const maxTargetY = Math.max(1.2, Math.min(maxCamY - 0.3, room.maxFloorY + 2.2));
  const minTargetZ = Math.max(minCamZ + 0.6, firstZ * 0.45);
  const maxTargetZ = Math.min(maxCamZ - 0.4, lastZ + 0.4);
  const clampOffset = new Vector3();
  const clampDir = new Vector3();

  function clampCameraInsideRoom() {
    if (mode !== "orbit") return;
    controls.target.x = Math.max(minTargetX, Math.min(maxTargetX, controls.target.x));
    controls.target.y = Math.max(minTargetY, Math.min(maxTargetY, controls.target.y));
    controls.target.z = Math.max(minTargetZ, Math.min(maxTargetZ, controls.target.z));

    clampOffset.subVectors(camera.position, controls.target);
    const curDist = clampOffset.length();
    if (curDist < 0.001) return;
    clampDir.copy(clampOffset).divideScalar(curDist);

    let maxRayDist = controls.maxDistance;
    if (clampDir.x > 1e-5) maxRayDist = Math.min(maxRayDist, (maxCamX - controls.target.x) / clampDir.x);
    else if (clampDir.x < -1e-5) maxRayDist = Math.min(maxRayDist, (minCamX - controls.target.x) / clampDir.x);
    if (clampDir.y > 1e-5) maxRayDist = Math.min(maxRayDist, (maxCamY - controls.target.y) / clampDir.y);
    else if (clampDir.y < -1e-5) maxRayDist = Math.min(maxRayDist, (minCamY - controls.target.y) / clampDir.y);
    if (clampDir.z > 1e-5) maxRayDist = Math.min(maxRayDist, (maxCamZ - controls.target.z) / clampDir.z);
    else if (clampDir.z < -1e-5) maxRayDist = Math.min(maxRayDist, (minCamZ - controls.target.z) / clampDir.z);
    maxRayDist = Math.max(0.25, maxRayDist);

    const isZoomGesture = wheelZooming || middleDollying || activeTouches.size >= 2;
    wheelZooming = false;

    if (isZoomGesture) {
      const clampedDist = Math.max(0.25, Math.min(curDist, maxRayDist));
      desiredOrbitDist = Math.max(controls.minDistance, Math.min(controls.maxDistance, clampedDist));
      camera.position.copy(controls.target).addScaledVector(clampDir, clampedDist);
    } else {
      const targetDist = Math.max(0.25, Math.min(desiredOrbitDist, maxRayDist));
      camera.position.copy(controls.target).addScaledVector(clampDir, targetDist);
    }
    camera.lookAt(controls.target);
  }

  let mode: Room3DMode = "orbit";
  let lookYaw = 0;
  let lookPitch = 0;
  let baseYaw = 0;
  let basePitch = 0;

  interface FlightTween {
    start: number;
    curve: CubicBezierCurve3;
    fromQuat: Quaternion;
    toQuat: Quaternion;
    fromFov: number;
    toFov: number;
    onDone?: () => void;
  }
  let tween: FlightTween | null = null;

  function seatPose(code: string): { pos: Vector3; yaw: number; pitch: number; quat: Quaternion } | null {
    const eye = room.eyeOf(code, viewerHeightCm);
    if (!eye) return null;
    const pos = new Vector3(eye.x, eye.y, eye.z);
    // Look gently toward the optical centre of the screen (accounting for downward screen tilt)
    const screenAim = new Vector3(
      room.screen.centreX,
      room.screen.bottom + room.screen.height * 0.46 * Math.cos(screenTiltRad),
      room.screen.bottomZ + room.screen.height * 0.46 * Math.sin(screenTiltRad),
    );
    const aim = screenAim.sub(pos);
    const yaw = Math.atan2(-aim.x, -aim.z);
    const pitch = Math.atan2(aim.y, Math.hypot(aim.x, aim.z));
    const quat = new Quaternion().setFromEuler(new Euler(pitch, yaw, 0, "YXZ"));
    return { pos, yaw, pitch, quat };
  }

  function buildFlightCurve(fromPos: Vector3, toPos: Vector3): CubicBezierCurve3 {
    const dist = fromPos.distanceTo(toPos);
    // Lift smoothly over seat backs along a parabolic cubic Bézier arc, capped cleanly below ceiling
    const lift = Math.min(1.25, Math.max(0.28, dist * 0.14));
    const c1 = fromPos.clone().lerp(toPos, 0.25);
    const c2 = fromPos.clone().lerp(toPos, 0.78);
    c1.y = Math.min(maxCamY, Math.max(fromPos.y, toPos.y) + lift);
    c2.y = Math.min(maxCamY, Math.max(fromPos.y, toPos.y) + lift * 0.72);
    return new CubicBezierCurve3(fromPos.clone(), c1, c2, toPos.clone());
  }

  function startFlight(
    toPos: Vector3,
    toQuat: Quaternion,
    toFov: number,
    animate: boolean,
    onDone?: () => void,
  ) {
    if (!animate || prefersReducedMotion()) {
      tween = null;
      camera.position.copy(toPos);
      camera.quaternion.copy(toQuat);
      camera.fov = toFov;
      camera.updateProjectionMatrix();
      onDone?.();
      requestRender();
      return;
    }
    tween = {
      start: performance.now(),
      curve: buildFlightCurve(camera.position, toPos),
      fromQuat: camera.quaternion.clone(),
      toQuat: toQuat.clone(),
      fromFov: camera.fov,
      toFov,
      onDone,
    };
    requestRender();
  }

  function applyMode(next: Room3DMode, animate = true) {
    const pose = next === "seat" && selected ? seatPose(selected) : null;
    mode = pose ? "seat" : "orbit";
    controls.enabled = false;
    hoveredCode = null;
    options.onHover?.(null);
    canvas.style.cursor = "grab";
    updateAudience();
    updateMarks();
    applyLighting(lightsLevel);
    paintSeats();

    const targetFov =
      pose !== null
        ? adaptiveFov(SEAT_FOV, camera.aspect, 58)
        : adaptiveFov(ORBIT_FOV, camera.aspect, 64);

    if (camera.zoom !== 1) {
      camera.zoom = 1;
      camera.updateProjectionMatrix();
    }

    if (pose) {
      baseYaw = pose.yaw;
      basePitch = pose.pitch;
      lookYaw = 0;
      lookPitch = 0;
      startFlight(pose.pos, pose.quat, targetFov, animate, () => {
        camera.rotation.set(basePitch, baseYaw, 0);
      });
    } else {
      startFlight(orbitPos, orbitQuat, targetFov, animate, () => {
        controls.target.copy(orbitTarget);
        desiredOrbitDist = orbitPos.distanceTo(orbitTarget);
        controls.enabled = true;
        controls.update();
      });
    }
  }

  // --- Pointer Interaction: Tap/Hover chairs in overview; Drag to look around & 2-finger pinch zoom in seat mode ---
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const activeTouches = new Map<number, { x: number; y: number }>();
  let down: { id: number; x: number; y: number; moved: number; pinched: boolean } | null = null;
  let last = { x: 0, y: 0 };
  let lastTapTime = 0;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let cachedRect: DOMRect | null = null;
  let hoverRaf = 0;
  let pendingHoverX = 0;
  let pendingHoverY = 0;

  const invalidateRect = () => {
    cachedRect = null;
  };
  const cancelHover = () => {
    if (hoverRaf) {
      cancelAnimationFrame(hoverRaf);
      hoverRaf = 0;
    }
  };

  function touchPairDist(): number {
    const pts = [...activeTouches.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function pickSeatAt(clientX: number, clientY: number, freshRect = false): SceneSeat | null {
    if (!pickMesh) return null;
    const rect = freshRect ? (cachedRect = canvas.getBoundingClientRect()) : (cachedRect ?? (cachedRect = canvas.getBoundingClientRect()));
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(pickMesh, false)[0];
    if (hit && hit.instanceId !== undefined) {
      return room.seats[hit.instanceId] ?? null;
    }
    return null;
  }

  const onEdgeGuard = (e: PointerEvent) => {
    if (e.pointerType === "touch" && e.clientX < EDGE_GUARD_PX) {
      e.stopImmediatePropagation();
      return;
    }
    // If the user starts dragging while flying back to overview, interrupt the flight immediately so OrbitControls accepts the drag.
    if (mode === "orbit" && tween) {
      tween = null;
      controls.target.copy(orbitTarget);
      desiredOrbitDist = Math.max(controls.minDistance, Math.min(controls.maxDistance, camera.position.distanceTo(controls.target)));
      controls.enabled = true;
      controls.update();
    }
  };

  const onWheelCapture = () => {
    if (mode === "orbit") {
      if (tween) {
        tween = null;
        controls.target.copy(orbitTarget);
        controls.enabled = true;
        controls.update();
      }
      wheelZooming = true;
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "touch" && e.clientX < EDGE_GUARD_PX) return;
    cancelHover();
    if (e.pointerType === "touch") {
      activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouches.size >= 2) {
        if (down) down.pinched = true;
        if (mode === "seat") {
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {
            // Ignore synthetic/unsupported capture.
          }
          pinchStartDist = Math.max(1, touchPairDist());
          pinchStartZoom = camera.zoom;
        }
        return;
      }
    }
    if (down !== null && mode === "seat") return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, pinched: false };
    last = { x: e.clientX, y: e.clientY };
    if (e.pointerType !== "touch" && e.button === 1) middleDollying = true;
    if (mode === "seat") {
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
    } else if (e.pointerType !== "touch") {
      canvas.style.cursor = "grabbing";
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" && activeTouches.has(e.pointerId)) {
      activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouches.size >= 2) {
        if (down) down.pinched = true;
        if (mode === "seat" && pinchStartDist > 0) {
          if (tween) tween = null;
          const dist = touchPairDist();
          camera.zoom = Math.max(1, Math.min(2.5, pinchStartZoom * (dist / pinchStartDist)));
          camera.updateProjectionMatrix();
          requestRender();
        }
        return;
      }
    }
    if (down) {
      if (down.id !== e.pointerId) return;
      down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
      if (mode !== "seat") return;
      if (tween) tween = null;
      const scale = LOOK_SPEED / camera.zoom;
      lookYaw = Math.max(-LOOK_LIMIT_YAW, Math.min(LOOK_LIMIT_YAW, lookYaw + (e.clientX - last.x) * scale));
      lookPitch = Math.max(-LOOK_LIMIT_PITCH, Math.min(LOOK_LIMIT_PITCH, lookPitch + (e.clientY - last.y) * scale));
      last = { x: e.clientX, y: e.clientY };
      camera.rotation.set(basePitch + lookPitch, baseYaw + lookYaw, 0);
      requestRender();
      return;
    }
    // Desktop mouse hover preview in overview mode (never runs on touch; coalesced to 1 raycast per animation frame).
    if (mode === "orbit" && e.pointerType === "mouse" && !tween) {
      pendingHoverX = e.clientX;
      pendingHoverY = e.clientY;
      if (!hoverRaf) {
        hoverRaf = requestAnimationFrame(() => {
          hoverRaf = 0;
          if (disposed || mode !== "orbit" || tween || down) return;
          const hit = pickSeatAt(pendingHoverX, pendingHoverY);
          const nextHover = hit ? hit.code : null;
          if (nextHover !== hoveredCode) {
            hoveredCode = nextHover;
            canvas.style.cursor = hoveredCode ? "pointer" : "grab";
            options.onHover?.(hoveredCode);
            paintSeats();
            requestRender();
          }
        });
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      activeTouches.delete(e.pointerId);
      if (activeTouches.size < 2) pinchStartDist = 0;
      if (activeTouches.size === 1) {
        const [remainingId, pos] = [...activeTouches.entries()][0];
        last = { x: pos.x, y: pos.y };
        if (down) down.id = remainingId;
      }
    }
    if (!down || down.id !== e.pointerId) return;
    const tap = !down.pinched && down.moved < TAP_MAX_MOVE_PX && e.type === "pointerup";
    down = null;
    middleDollying = false;
    canvas.style.cursor = mode === "orbit" && hoveredCode ? "pointer" : "grab";
    if (mode === "seat") {
      // Double-tap in seat mode smoothly recentres gaze & resets zoom onto the cinema screen
      if (tap) {
        const now = performance.now();
        if (
          now - lastTapTime < 320 &&
          (Math.abs(lookYaw) > 0.01 || Math.abs(lookPitch) > 0.01 || camera.zoom > 1.01)
        ) {
          lookYaw = 0;
          lookPitch = 0;
          camera.zoom = 1;
          camera.updateProjectionMatrix();
          camera.rotation.set(basePitch, baseYaw, 0);
          requestRender();
        }
        lastTapTime = now;
      }
      return;
    }
    if (!tap || mode !== "orbit") return;
    const picked = pickSeatAt(e.clientX, e.clientY, true);
    if (picked) options.onPick(picked.code);
  };

  const onWindowBlur = () => {
    down = null;
    middleDollying = false;
    activeTouches.clear();
    pinchStartDist = 0;
    canvas.style.cursor = "grab";
  };

  const onPointerLeave = () => {
    cancelHover();
    if (hoveredCode !== null) {
      hoveredCode = null;
      options.onHover?.(null);
      paintSeats();
      requestRender();
    }
  };

  canvas.addEventListener("pointerdown", onEdgeGuard, { capture: true });
  canvas.addEventListener("wheel", onWheelCapture, { capture: true, passive: true });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("scroll", invalidateRect, { passive: true });
  window.addEventListener("resize", invalidateRect, { passive: true });

  // --- On-Demand Render Loop (stops immediately when idle to protect iOS PWA battery/GPU) ---
  let raf = 0;
  let disposed = false;
  let lost = false;

  function frame(now: number) {
    raf = 0;
    if (disposed || lost || document.hidden) return;
    let keepGoing = false;

    if (tween) {
      const elapsed = Math.min(1, (now - tween.start) / FLIGHT_MS);
      // Cubic ease-in-out for cinematic camera flight
      const ease = elapsed < 0.5 ? 4 * elapsed * elapsed * elapsed : 1 - (-2 * elapsed + 2) ** 3 / 2;
      camera.position.copy(tween.curve.getPoint(ease, flightPoint));
      camera.quaternion.slerpQuaternions(tween.fromQuat, tween.toQuat, ease);
      camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * ease;
      camera.updateProjectionMatrix();
      if (elapsed >= 1) {
        const done = tween.onDone;
        tween = null;
        done?.();
      } else {
        keepGoing = true;
      }
    }

    if (lightTween) {
      const elapsed = Math.min(1, (now - lightTween.start) / DIMMER_MS);
      const ease = 1 - (1 - elapsed) ** 3;
      lightsLevel = lightTween.from + (lightTween.to - lightTween.from) * ease;
      applyLighting(lightsLevel);
      if (elapsed >= 1) {
        lightTween = null;
      } else {
        keepGoing = true;
      }
    }

    if (keepGoing) raf = requestAnimationFrame(frame);
    renderer.render(scene, camera);
    if (cssRenderer && cssScene && activeYoutubeId && youtubeWrapper) {
      camera.updateMatrixWorld();
      screenCamPos.copy(screenWorldCenter).applyMatrix4(camera.matrixWorldInverse);
      // Hide via visibility (not display:none) when behind the camera so the YouTube player never resets.
      const inFront = screenCamPos.z < room.screen.width * 0.45;
      youtubeWrapper.style.visibility = inFront ? "visible" : "hidden";
      if (inFront) cssRenderer.render(cssScene, camera);
    }
  }

  function requestRender() {
    if (raf || disposed || lost || document.hidden) return;
    raf = requestAnimationFrame(frame);
  }

  controls.addEventListener("change", () => {
    clampCameraInsideRoom();
    requestRender();
  });

  let lostTimer = 0;
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.clearTimeout(lostTimer);
    lostTimer = window.setTimeout(() => {
      if (lost && !disposed && !document.hidden) options.onFailed();
    }, 2500);
  };
  const onRestored = () => {
    lost = false;
    window.clearTimeout(lostTimer);
    requestRender();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  const pauseRendering = () => {
    cancelHover();
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (activeYoutubeId && youtubeIframe) sendYoutubeCommand("pauseVideo");
  };
  const onVisibility = () => {
    if (document.hidden) {
      pauseRendering();
      return;
    }
    if (lost) {
      // Give WebKit a short grace window to fire `webglcontextrestored` after resuming from background.
      window.clearTimeout(lostTimer);
      lostTimer = window.setTimeout(() => {
        if (lost && !disposed && !document.hidden) options.onFailed();
      }, 2500);
    } else {
      requestRender();
    }
  };
  const onPageHide = () => {
    tween = null;
    lightTween = null;
    pauseRendering();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);

  let currentHost: HTMLElement = host;
  let resizeTimer = 0;
  function fit() {
    cachedRect = null;
    const w = currentHost.clientWidth;
    const h = currentHost.clientHeight;
    if ((w === sizeW && h === sizeH) || w === 0 || h === 0) return;
    sizeW = w;
    sizeH = h;
    renderer.setSize(w, h, false);
    cssRenderer?.setSize(w, h);
    camera.aspect = w / h;
    if (!tween) {
      camera.fov =
        mode === "seat"
          ? adaptiveFov(SEAT_FOV, camera.aspect, 58)
          : adaptiveFov(ORBIT_FOV, camera.aspect, 64);
    }
    camera.updateProjectionMatrix();
    requestRender();
  }
  const observer = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(fit, RESIZE_DEBOUNCE_MS);
  });
  observer.observe(currentHost);

  // Initial paint & framing
  applyLighting(lightsLevel);
  paintSeats();
  updateMarks();
  fit();
  applyMode(options.initialMode === "seat" && selected ? "seat" : "orbit", false);

  return {
    setMode: (next) => {
      const targetMode: Room3DMode = next === "seat" && selected ? "seat" : "orbit";
      if (targetMode === mode) return;
      applyMode(targetMode, true);
    },
    recenter: () => {
      if (mode === "seat" && selected) applyMode("seat", true);
      else applyMode("orbit", true);
    },
    setHeat: (on) => {
      heat = on;
      applyLighting(lightsLevel);
      paintSeats();
      requestRender();
    },
    setSelected: (code) => {
      selected = code && seatByCode.has(code) ? code : null;
      paintSeats();
      updateAudience();
      updateMarks();
      if (mode === "seat") {
        if (selected) applyMode("seat", true);
        else applyMode("orbit", true);
      } else {
        requestRender();
      }
    },
    setAudience: (on) => {
      audienceOn = on;
      updateAudience();
      requestRender();
    },
    setLightsUp: (on) => {
      const next = on ? 1 : 0;
      if (next === lightsTarget) return;
      lightsTarget = next;
      if (prefersReducedMotion()) {
        lightTween = null;
        lightsLevel = next;
        applyLighting(lightsLevel);
        requestRender();
        return;
      }
      lightTween = { start: performance.now(), from: lightsLevel, to: next };
      requestRender();
    },
    setHeights: (nextViewerCm, nextFrontCm) => {
      const viewerChanged = nextViewerCm !== viewerHeightCm;
      const frontChanged = nextFrontCm !== frontHeightCm;
      if (!viewerChanged && !frontChanged) return;
      viewerHeightCm = nextViewerCm;
      frontHeightCm = nextFrontCm;
      if (frontChanged) updateAudience();
      if (viewerChanged && mode === "seat" && selected) {
        const pose = seatPose(selected);
        if (pose) {
          tween = null;
          camera.position.copy(pose.pos);
          baseYaw = pose.yaw;
          basePitch = pose.pitch;
          camera.rotation.set(basePitch + lookPitch, baseYaw + lookYaw, 0);
        }
      }
      requestRender();
    },
    setMarks: (next) => {
      marks = next;
      updateMarks();
      requestRender();
    },
    setAppearance: (rawNext) => {
      if (disposed) return;
      const next = normalizeRoom3DAppearance(rawNext);
      const carpetChanged =
        next.carpetStyle !== currentAppearance.carpetStyle || next.carpetColor !== currentAppearance.carpetColor;
      currentAppearance = next;

      if (carpetChanged) {
        const prevCarpet = carpetTex;
        carpetTex = createCarpetTexture(shellW / 2.2, shellD / 2.2, next.carpetStyle, next.carpetColor);
        baseFloorMat.map = carpetTex;
        baseFloorMat.needsUpdate = true;
        if (slabMaterial) {
          slabMaterial.map = carpetTex;
          slabMaterial.needsUpdate = true;
        }
        if (stairMat) {
          stairMat.map = carpetTex;
          stairMat.needsUpdate = true;
        }
        prevCarpet?.dispose();
      }

      fabricMaterial.roughness = next.seatFinish === "leather" ? 0.42 : 0.82;
      fabricMaterial.metalness = next.seatFinish === "leather" ? 0.08 : 0.03;
      fabricMaterial.needsUpdate = true;
      frameMaterial.color.setHex(parseHexOrRgb(next.seatFrameColor) ?? 0x15131c);

      buildInterior(next);
      applyLighting(lightsLevel);
      requestRender();
    },
    setYoutubeMuted: (muted) => {
      youtubeMuted = muted;
      if (!activeYoutubeId || !youtubeIframe) return;
      if (muted) {
        sendYoutubeCommand("mute");
      } else {
        sendYoutubeCommand("unMute");
        sendYoutubeCommand("playVideo");
      }
    },
    mountTo: (target) => {
      if (disposed || target === currentHost) return;
      observer.unobserve(currentHost);
      currentHost = target;
      currentHost.appendChild(stageEl);
      observer.observe(currentHost);
      sizeW = 0;
      sizeH = 0;
      fit();
    },
    refit: () => {
      sizeW = 0;
      sizeH = 0;
      fit();
    },
    dispose: () => {
      disposed = true;
      tween = null;
      lightTween = null;
      cancelHover();
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(lostTimer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("scroll", invalidateRect);
      window.removeEventListener("resize", invalidateRect);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      canvas.removeEventListener("pointerdown", onEdgeGuard, { capture: true });
      canvas.removeEventListener("wheel", onWheelCapture, { capture: true });
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      syncYoutubeLayer(null);
      cssRenderer?.domElement.remove();
      cssRenderer = null;
      cssScene = null;
      interiorGroup.clear();
      for (const item of interiorDisposables) item.dispose();
      interiorDisposables.length = 0;
      carpetTex?.dispose();
      carpetTex = null;
      for (const item of disposables) item.dispose();
      renderer.dispose();
      // Immediately return GPU memory: iOS Safari counts every live context/canvas against the page limit.
      renderer.forceContextLoss();
      stageEl.remove();
    },
  };
}
