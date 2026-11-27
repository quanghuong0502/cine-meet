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
import { computeYoutubeCoverLayout, parseYoutubeId, YOUTUBE_EMBED_HOST, youtubeScreenEmbedUrl } from "@/lib/movie/youtube";
import { loadYouTubeApi, YT_STATE, type YtPlayer } from "@/lib/movie/youtube-api";
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
  type ScreenBorderStyle,
  type ScreenContentPreset,
  type StarlightColor,
  type SubtitleColor,
  type WallStyle,
} from "@/lib/seat-layout/room-3d-appearance.defaults";
import type { SeatStyle } from "@/lib/seat-layout/types";
import { EYE_HEIGHT_M, HEAD_ABOVE_EYE_M, sittingEyeHeightM } from "@/services/seat-score";
import { heatColor, heatLevel } from "./heat-color";
import {
  build4dxWallProps,
  buildAisleHandrails,
  buildCeilingAndCornerDetails,
  buildEmergencyLightUnit,
  buildHighlightRingsOverlay,
  buildHolderTagsOverlay,
  buildSeatFlagsOverlay,
  buildSeatNumberMesh,
  buildSightlineOverlay,
  buildSnackPropRig,
  buildStageSubwoofers,
  composeRoomSnapshot,
  createRoomSignTexture,
  type Room3DMeta,
  type Room3DSnapshotMeta,
} from "./room-3d-extras";

export type { Room3DMeta, Room3DSnapshotMeta };
export type Room3DCameraPreset = "overview" | "entrance" | "frontRow" | "booth";
export interface Room3DCameraState {
  mode: Room3DMode;
  pos: [number, number, number];
  target: [number, number, number];
  lookYaw: number;
  lookPitch: number;
  zoom: number;
}

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
  setCameraPreset: (preset: Room3DCameraPreset) => void;
  recenter: () => void;
  setHeat: (on: boolean) => void;
  setSelected: (code: string | null) => void;
  setAudience: (on: boolean) => void;
  setLightsUp: (on: boolean) => void;
  setHeights: (viewerHeightCm: number, frontHeightCm: number) => void;
  setMarks: (marks: Map<string, SeatMarkKind3D> | undefined) => void;
  setSightline: (on: boolean) => void;
  setOccupancy: (reserved: Set<string> | undefined, holders: Map<string, string> | undefined) => void;
  setHighlightedCodes: (codes: Set<string> | undefined) => void;
  /** Returns current orbit/POV camera coordinates so scene rebuilds on the same layout keep the user's exact vantage. */
  getCameraState: () => Room3DCameraState;
  /** Applies a clamped yaw/pitch viewing offset in seated POV mode (used by mobile gyroscope look-around). */
  setLookOffset: (yawRad: number, pitchRad: number) => void;
  /** Updates auditorium visual UI/fixtures in-place inside the same WebGL context (preserves camera pose). */
  setAppearance: (appearance: Room3DAppearance) => void;
  /** Mutes or unmutes the active YouTube cinema screen iframe (no-op when not in YouTube mode). */
  setYoutubeMuted: (muted: boolean) => void;
  /** Captures a shareable PNG snapshot of the current 3D view with an optional cinema watermark bar. */
  captureSnapshot: (meta?: Room3DSnapshotMeta) => Promise<Blob | null>;
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
  reservedCodes?: Set<string>;
  holderLabels?: Map<string, string>;
  highlightedCodes?: Set<string>;
  initialCameraState?: Room3DCameraState | null;
  sightline?: boolean;
  roomMeta?: Room3DMeta;
  subtitleText?: string;
  appearance?: Room3DAppearance;
  youtubeMuted?: boolean;
  /** Called whenever the YouTube player falls back or resets its real mute state (keeps UI honest). */
  onYoutubeMutedChange?: (muted: boolean) => void;
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
const SEAT_MAX_ZOOM = 2.2;
const FLIGHT_MS = 480;
const DIMMER_MS = 340;
const CURTAIN_MS = 620;

const DEFAULT_SEAT_COLOR = 0x8e1e36;
const BROKEN_COLOR = 0x242029;
const RESERVED_SEAT_COLOR = 0x2a3140;
const FRIEND_SEAT_COLOR = 0x0ea5e9;
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

function cylPart(
  rTop: number,
  rBot: number,
  h: number,
  x: number,
  y: number,
  z: number,
  seg = 12,
  rotX = 0,
  rotZ = 0,
): BufferGeometry {
  const g = new CylinderGeometry(rTop, rBot, h, seg);
  if (rotX !== 0) g.rotateX(rotX);
  if (rotZ !== 0) g.rotateZ(rotZ);
  g.translate(x, y, z);
  return normalizePart(g);
}

function paintPart(geom: BufferGeometry, hex: number): BufferGeometry {
  const c = new Color(hex);
  const count = geom.getAttribute("position").count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geom.setAttribute("color", new BufferAttribute(arr, 3));
  return geom;
}

/** Integrated armrest cupholder (molded outer sleeve + brushed metallic rim + deep dark cup socket). */
function addCupholder(
  frameParts: BufferGeometry[],
  hardwareParts: BufferGeometry[],
  x: number,
  topY: number,
  z: number,
  outerR = 0.043,
  depth = 0.095,
) {
  frameParts.push(cylPart(outerR, outerR * 0.84, depth, x, topY - depth / 2, z, 12));
  hardwareParts.push(paintPart(cylPart(outerR + 0.005, outerR + 0.002, 0.011, x, topY + 0.003, z, 14), 0x6a7288));
  hardwareParts.push(paintPart(cylPart(outerR * 0.78, outerR * 0.78, 0.004, x, topY + 0.0095, z, 14), 0x050508));
}

/** Luxury Gold-Class swivel popcorn & snack tray mounted via brushed steel stem off the console armrest. */
function addSwivelTray(
  hardwareParts: BufferGeometry[],
  pivotX: number,
  armTopY: number,
  pivotZ: number,
  trayX: number,
  trayZ: number,
  trayW = 0.24,
  trayD = 0.17,
) {
  const trayY = armTopY + 0.068;
  // Vertical brushed steel pivot post + horizontal support arm
  hardwareParts.push(paintPart(cylPart(0.011, 0.013, 0.064, pivotX, armTopY + 0.032, pivotZ, 10), 0x6a7286));
  const armDx = trayX - pivotX;
  const armDz = trayZ - pivotZ;
  const armLen = Math.hypot(armDx, armDz);
  if (armLen > 0.01) {
    const link = new BoxGeometry(armLen, 0.014, 0.022);
    link.rotateY(-Math.atan2(armDz, armDx));
    link.translate((pivotX + trayX) / 2, trayY - 0.012, (pivotZ + trayZ) / 2);
    hardwareParts.push(paintPart(normalizePart(link), 0x565d70));
  }
  // Smoked-walnut tabletop + dark perimeter edge lip
  hardwareParts.push(paintPart(roundedPart(trayW, 0.015, trayD, trayX, trayY, trayZ, 0.007), 0x5d4536));
  hardwareParts.push(paintPart(roundedPart(trayW + 0.012, 0.011, trayD + 0.012, trayX, trayY - 0.003, trayZ, 0.006), 0x2a1f18));
}

/** Protective molded polypropylene rear back shell shielding upholstery from rear-row foot traffic. */
function addBackShell(
  frameParts: BufferGeometry[],
  width: number,
  height: number,
  cushionH: number,
  seatD: number,
  backThick: number,
  tilt: number,
) {
  const shellOffset = backThick / 2 + 0.01;
  frameParts.push(
    roundedPart(
      width * 0.96,
      height * 0.94,
      0.02,
      0,
      cushionH + (height / 2) * Math.cos(tilt) - 0.04 - shellOffset * Math.sin(tilt),
      seatD / 2 - 0.025 + (height / 2) * Math.sin(tilt) + shellOffset * Math.cos(tilt),
      0.014,
      tilt,
    ),
  );
}

interface ChairGeometries {
  fabric: BufferGeometry;
  frame: BufferGeometry;
  hardware: BufferGeometry | null;
}

/**
 * Sculpted multi-material cinema chair facing `-z` (toward the screen), sitting on `y = 0`, centred at `x = 0, z = 0`.
 * Splits plush beveled upholstery (`fabric`), matte frame/armrests/back-shell (`frame`), and metallic/wood convenience
 * hardware (`hardware`: armrest cupholders, Gold-Class swivel popcorn trays, cinema-bed snack caddies, 4DX footrest/nozzles)
 * calibrated to Ferco / Figueras / Irwin & CJ 4DPLEX real-world dimensions.
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
  const hardwareParts: BufferGeometry[] = [];

  if (style === "bed") {
    const bedW = seatPitchM * 0.96;
    const bedD = Math.min(rowPitchM * 0.86, 1.45);
    const caddyW = 0.095;
    const mattressW = bedW - caddyW - 0.015;
    const mattressX = -caddyW * 0.45;
    const caddyX = bedW / 2 - caddyW / 2;

    // Low dark architectural plinth + integrated right bedside snack/drink console
    frameParts.push(boxPart(bedW * 0.96, 0.14, bedD * 0.96, 0, 0.07, -0.04));
    frameParts.push(roundedPart(caddyW, 0.36, 0.46, caddyX, 0.28, 0.16, 0.018));
    hardwareParts.push(paintPart(roundedPart(caddyW + 0.01, 0.018, 0.48, caddyX, 0.468, 0.16, 0.008), 0x5d4536));
    addCupholder(frameParts, hardwareParts, caddyX, 0.474, -0.005, 0.036, 0.075);

    // Plush mattress + duvet throw + angled headboard bolster + pillow
    fabricParts.push(roundedPart(mattressW, 0.24, bedD, mattressX, 0.26, -0.04, 0.055));
    fabricParts.push(roundedPart(mattressW * 0.98, 0.09, bedD * 0.64, mattressX, 0.41, -0.17, 0.038));
    fabricParts.push(roundedPart(mattressW * 0.94, 0.52, 0.17, mattressX, 0.59, bedD / 2 - 0.15, 0.06, 0.36));
    fabricParts.push(roundedPart(mattressW * 0.76, 0.14, 0.22, mattressX, 0.47, bedD / 2 - 0.28, 0.05, 0.25));
  } else if (style === "recliner") {
    // Luxury Gold-Class recliner (Ferco Verona/Milano ~1.09 m upright, ~1.07 m at deep recline)
    const cushionH = 0.46;
    const seatD = 0.58;
    const armW = 0.094;
    const innerW = w - armW * 1.4;
    const backH = 0.72;
    const backTilt = Math.max(tilt, 0.32);
    const armX = (w - armW) / 2;

    // Matte dark recliner base + wide sculpted console armrests + flush console cupholder + swivel popcorn tray + recline panel
    frameParts.push(boxPart(w * 0.78, 0.24, seatD * 0.86, 0, 0.12, 0.02));
    frameParts.push(roundedPart(armW, 0.44, seatD + 0.08, -armX, 0.36, 0, 0.028));
    frameParts.push(roundedPart(armW, 0.44, seatD + 0.08, armX, 0.36, 0, 0.028));
    addCupholder(frameParts, hardwareParts, armX, 0.58, -seatD / 2 + 0.035, 0.042, 0.085);
    addSwivelTray(hardwareParts, -armX, 0.58, -seatD / 2 + 0.035, -0.095, -seatD / 2 - 0.035, 0.24, 0.17);
    hardwareParts.push(paintPart(boxPart(0.012, 0.075, 0.042, armX + armW / 2 + 0.002, 0.47, -0.06), 0x768098));

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
  } else if (style === "4dx") {
    // CJ 4DPLEX / CGV 4DX motion seat (~1.08 m): steel motion base, suspended footrest bar, bucket wings, air nozzles & deep cupholder
    const cushionH = 0.46;
    const seatD = 0.52;
    const armW = 0.072;
    const innerW = w - armW * 1.55;
    const backH = 0.68;
    const armX = (w - armW) / 2;

    // Raised heavy-duty steel motion platform + hydraulic actuator struts + suspended metal footrest rail
    frameParts.push(boxPart(w * 0.88, 0.11, seatD * 0.94, 0, 0.055, 0.02));
    frameParts.push(boxPart(w * 0.54, 0.22, 0.34, 0, 0.21, 0.04));
    hardwareParts.push(paintPart(cylPart(0.022, 0.026, 0.22, -w * 0.24, 0.21, 0.04, 10, 0, 0.22), 0x626a7e));
    hardwareParts.push(paintPart(cylPart(0.022, 0.026, 0.22, w * 0.24, 0.21, 0.04, 10, 0, -0.22), 0x626a7e));
    // Hanging 4DX footrest bar + twin angled mounting rods
    hardwareParts.push(paintPart(roundedPart(innerW * 0.92, 0.032, 0.068, 0, 0.135, -seatD / 2 - 0.13, 0.012), 0x666e82));
    hardwareParts.push(paintPart(cylPart(0.013, 0.013, 0.24, -innerW * 0.36, 0.22, -seatD / 2 - 0.05, 8, -0.68), 0x4c5366));
    hardwareParts.push(paintPart(cylPart(0.013, 0.013, 0.24, innerW * 0.36, 0.22, -seatD / 2 - 0.05, 8, -0.68), 0x4c5366));

    // Sturdy boxed armrests + deep anti-spill right cupholder + rear protective shell
    frameParts.push(roundedPart(armW * 0.8, 0.44, seatD * 0.9, -armX, 0.36, 0.02, 0.018));
    frameParts.push(roundedPart(armW * 0.8, 0.44, seatD * 0.9, armX, 0.36, 0.02, 0.018));
    frameParts.push(roundedPart(armW, 0.065, seatD + 0.05, -armX, 0.59, -0.01, 0.022));
    frameParts.push(roundedPart(armW, 0.065, seatD + 0.05, armX, 0.59, -0.01, 0.022));
    addCupholder(frameParts, hardwareParts, armX - 0.008, 0.618, -seatD / 2 - 0.032, 0.044, 0.11);
    addBackShell(frameParts, innerW, backH, cushionH, seatD, 0.13, tilt);

    // Sport-bolstered seat cushion, bucket side bolsters, contoured backrest & high headrest with twin shoulder effect nozzles
    fabricParts.push(roundedPart(innerW, 0.15, seatD, 0, cushionH - 0.075, -0.01, 0.048, -0.04));
    fabricParts.push(
      roundedPart(
        innerW,
        backH,
        0.125,
        0,
        cushionH + (backH / 2) * Math.cos(tilt) - 0.04,
        seatD / 2 - 0.03 + (backH / 2) * Math.sin(tilt),
        0.048,
        tilt,
      ),
    );
    // Lateral sport torso bolsters
    const wingY = cushionH + backH * 0.42 * Math.cos(tilt) - 0.02;
    const wingZ = seatD / 2 - 0.07 + backH * 0.42 * Math.sin(tilt);
    fabricParts.push(roundedPart(0.055, backH * 0.52, 0.12, -innerW * 0.45, wingY, wingZ, 0.024, tilt));
    fabricParts.push(roundedPart(0.055, backH * 0.52, 0.12, innerW * 0.45, wingY, wingZ, 0.024, tilt));
    // Twin shoulder air-blast / scent nozzles flanking upper headrest
    const nozzleY = cushionH + (backH - 0.12) * Math.cos(tilt) - 0.02;
    const nozzleZ = seatD / 2 - 0.055 + (backH - 0.12) * Math.sin(tilt);
    hardwareParts.push(paintPart(roundedPart(0.048, 0.078, 0.058, -innerW * 0.42, nozzleY, nozzleZ, 0.014, tilt), 0x727b92));
    hardwareParts.push(paintPart(roundedPart(0.048, 0.078, 0.058, innerW * 0.42, nozzleY, nozzleZ, 0.014, tilt), 0x727b92));
  } else if (style === "vip") {
    // High-back VIP cinema chair (Ferco/Figueras 1,050–1,080 mm total height)
    const cushionH = 0.45;
    const seatD = 0.52;
    const armW = 0.072;
    const innerW = w - armW * 1.55;
    const backH = 0.66;
    const armX = (w - armW) / 2;

    // Dark pedestal, stanchions, sculpted shared armrests, outer rear shell & integrated armrest cupholder
    frameParts.push(boxPart(w * 0.56, 0.26, 0.32, 0, 0.13, 0.06));
    frameParts.push(roundedPart(armW * 0.72, 0.44, seatD * 0.88, -armX, 0.34, 0.02, 0.018));
    frameParts.push(roundedPart(armW * 0.72, 0.44, seatD * 0.88, armX, 0.34, 0.02, 0.018));
    frameParts.push(roundedPart(armW, 0.065, seatD + 0.04, -armX, 0.58, 0.0, 0.024));
    frameParts.push(roundedPart(armW, 0.065, seatD + 0.04, armX, 0.58, 0.0, 0.024));
    addCupholder(frameParts, hardwareParts, armX - 0.01, 0.608, -seatD / 2 - 0.034, 0.045, 0.102);
    addBackShell(frameParts, innerW, backH, cushionH, seatD, 0.125, tilt);

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
    const armX = (w - armW) / 2;

    frameParts.push(boxPart(w * 0.46, 0.27, 0.24, 0, 0.135, 0.06));
    frameParts.push(roundedPart(armW * 0.68, 0.42, seatD * 0.84, -armX, 0.33, 0.02, 0.014));
    frameParts.push(roundedPart(armW * 0.68, 0.42, seatD * 0.84, armX, 0.33, 0.02, 0.014));
    frameParts.push(roundedPart(armW, 0.055, seatD + 0.04, -armX, 0.56, 0.0, 0.02));
    frameParts.push(roundedPart(armW, 0.055, seatD + 0.04, armX, 0.56, 0.0, 0.02));
    addCupholder(frameParts, hardwareParts, armX - 0.01, 0.585, -seatD / 2 - 0.03, 0.043, 0.094);
    addBackShell(frameParts, innerW, backH, cushionH, seatD, 0.11, tilt);

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
  const hardware =
    hardwareParts.length > 0 ? mergeParts(hardwareParts, paintPart(normalizePart(new BoxGeometry(0.01, 0.01, 0.01)), 0x666e80)) : null;
  return { fabric, frame, hardware };
}

/**
 * Couple / Sweetbox seat (`span === 2`): continuous double-wide plush bench without a middle armrest,
 * enclosed on left and right by tall architectural privacy divider panels (1.12 m) with twin outer cupholders
 * (and optional Gold-Class snack trays, cinema-bed bedside caddies, or 4DX motion footrest bar).
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
  const hardwareParts: BufferGeometry[] = [];

  if (style === "bed") {
    const bedD = Math.min(rowPitchM * 0.86, 1.45);
    const railW = 0.092;
    const railX = (totalW - railW) / 2;
    frameParts.push(boxPart(totalW * 0.97, 0.14, bedD * 0.96, 0, 0.07, -0.04));
    frameParts.push(roundedPart(railW, 0.5, bedD * 0.74, -railX, 0.41, 0.04, 0.024));
    frameParts.push(roundedPart(railW, 0.5, bedD * 0.74, railX, 0.41, 0.04, 0.024));
    // Twin smoked-walnut bedside snack ledges + recessed cupholders on both side rails
    hardwareParts.push(paintPart(roundedPart(railW + 0.014, 0.018, 0.48, -railX, 0.668, 0.04, 0.008), 0x5d4536));
    hardwareParts.push(paintPart(roundedPart(railW + 0.014, 0.018, 0.48, railX, 0.668, 0.04, 0.008), 0x5d4536));
    addCupholder(frameParts, hardwareParts, -railX, 0.674, -0.11, 0.036, 0.075);
    addCupholder(frameParts, hardwareParts, railX, 0.674, -0.11, 0.036, 0.075);

    fabricParts.push(roundedPart(totalW - railW * 2 - 0.01, 0.24, bedD, 0, 0.26, -0.04, 0.055));
    fabricParts.push(roundedPart(totalW - railW * 2 - 0.03, 0.09, bedD * 0.64, 0, 0.41, -0.17, 0.038));
    fabricParts.push(roundedPart(totalW - railW * 2 - 0.05, 0.52, 0.17, 0, 0.59, bedD / 2 - 0.15, 0.06, 0.36));
    fabricParts.push(roundedPart(seatPitchM * 0.64, 0.14, 0.22, -seatPitchM * 0.4, 0.47, bedD / 2 - 0.28, 0.05, 0.25));
    fabricParts.push(roundedPart(seatPitchM * 0.64, 0.14, 0.22, seatPitchM * 0.4, 0.47, bedD / 2 - 0.28, 0.05, 0.25));
  } else {
    const cushionH = 0.45;
    const seatD = style === "recliner" ? 0.58 : 0.52;
    const wallT = 0.075;
    const innerW = totalW - wallT * 2;
    const backH = style === "recliner" ? 0.72 : style === "4dx" ? 0.68 : style === "vip" ? 0.67 : 0.65;
    const backTilt = style === "recliner" ? Math.max(tilt, 0.32) : tilt;
    const dividerH = style === "4dx" ? 0.62 : 1.12;
    const dividerD = seatD + 0.18;

    // Dark structural base + Sweetbox privacy walls (or low 4DX side consoles) + inner outer-side cupholders
    frameParts.push(boxPart(innerW * 0.9, style === "4dx" ? 0.12 : 0.25, seatD * 0.84, 0, style === "4dx" ? 0.06 : 0.125, 0.04));
    frameParts.push(roundedPart(wallT, dividerH, dividerD, -(totalW - wallT) / 2, dividerH / 2, 0.04, 0.032));
    frameParts.push(roundedPart(wallT, dividerH, dividerD, (totalW - wallT) / 2, dividerH / 2, 0.04, 0.032));
    // Inner armrest ledges along both outer walls with 1 personal cupholder per viewer
    const cupX = innerW / 2 - 0.048;
    frameParts.push(roundedPart(0.09, 0.055, seatD * 0.72, -cupX, 0.56, -0.02, 0.018));
    frameParts.push(roundedPart(0.09, 0.055, seatD * 0.72, cupX, 0.56, -0.02, 0.018));
    addCupholder(frameParts, hardwareParts, -cupX, 0.588, -seatD / 2 + 0.02, 0.043, 0.095);
    addCupholder(frameParts, hardwareParts, cupX, 0.588, -seatD / 2 + 0.02, 0.043, 0.095);
    addBackShell(frameParts, innerW, backH, cushionH, seatD, 0.125, backTilt);

    if (style === "recliner") {
      // Twin swivel popcorn/snack trays pivoting cleanly from left & right side walls
      addSwivelTray(hardwareParts, -cupX, 0.588, -seatD / 2 + 0.08, -innerW * 0.28, -seatD / 2 - 0.04, 0.24, 0.17);
      addSwivelTray(hardwareParts, cupX, 0.588, -seatD / 2 + 0.08, innerW * 0.28, -seatD / 2 - 0.04, 0.24, 0.17);
    } else if (style === "4dx") {
      // Full-width 4DX steel footrest rail + hydraulic struts + twin outer headrest air nozzles
      hardwareParts.push(paintPart(roundedPart(innerW * 0.94, 0.034, 0.07, 0, 0.135, -seatD / 2 - 0.13, 0.012), 0x666e82));
      hardwareParts.push(paintPart(cylPart(0.014, 0.014, 0.24, -innerW * 0.38, 0.22, -seatD / 2 - 0.05, 8, -0.68), 0x4c5366));
      hardwareParts.push(paintPart(cylPart(0.014, 0.014, 0.24, innerW * 0.38, 0.22, -seatD / 2 - 0.05, 8, -0.68), 0x4c5366));
      const nozzleY = cushionH + (backH - 0.12) * Math.cos(backTilt) - 0.02;
      const nozzleZ = seatD / 2 - 0.055 + (backH - 0.12) * Math.sin(backTilt);
      hardwareParts.push(paintPart(roundedPart(0.05, 0.08, 0.058, -innerW * 0.44, nozzleY, nozzleZ, 0.014, backTilt), 0x727b92));
      hardwareParts.push(paintPart(roundedPart(0.05, 0.08, 0.058, innerW * 0.44, nozzleY, nozzleZ, 0.014, backTilt), 0x727b92));
    }

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
  const hardware =
    hardwareParts.length > 0 ? mergeParts(hardwareParts, paintPart(normalizePart(new BoxGeometry(0.01, 0.01, 0.01)), 0x666e80)) : null;
  return { fabric, frame, hardware };
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

/**
 * Builds a single-draw-call low-profile 3D mitered perimeter masking frame with an open center window and a tight inner
 * light-trap bevel flush against the dark proscenium wall. The inner lip overlaps the screen edge by 8 mm at `z = +0.004 m`
 * to eliminate subpixel seams on `antialias: false` mobile WebGL for both image and YouTube screens without looking like a
 * thick wall-mounted whiteboard or TV box.
 */
function buildScreenFrameGeometry(
  screenW: number,
  screenH: number,
  borderStyle: ScreenBorderStyle,
  curveDepth: number,
): BufferGeometry {
  const outerPad = borderStyle === "velvet" ? 0.2 : borderStyle === "slim" ? 0.055 : 0.012;
  const bevelW = borderStyle === "velvet" ? 0.028 : borderStyle === "slim" ? 0.014 : 0.006;
  const zFront = borderStyle === "velvet" ? 0.026 : borderStyle === "slim" ? 0.016 : 0.008;
  const zLip = 0.004;
  const zBack = -0.05;
  const overlap = 0.008;

  const halfW = screenW / 2;
  const halfH = screenH / 2;
  const innerX = Math.max(0.05, halfW - overlap);
  const innerY = Math.max(0.05, halfH - overlap);
  const bevelX = halfW + bevelW - overlap;
  const bevelY = halfH + bevelW - overlap;
  const outerX = halfW + outerPad;
  const outerY = halfH + outerPad;

  // Profile rings from inner screen lip -> tight light-trap bevel -> flush velvet face -> rear shroud return
  const rings: { x: number; y: number; z: number; ao: number }[] = [
    { x: innerX, y: innerY, z: zLip, ao: 0.32 },
    { x: bevelX, y: bevelY, z: zFront, ao: 0.72 },
    { x: outerX, y: outerY, z: zFront, ao: 0.62 },
    { x: outerX, y: outerY, z: zBack, ao: 0.42 },
  ];

  // CCW corner signs around the frame perimeter (looking from +Z toward the screen)
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];

  const pos: number[] = [];
  const col: number[] = [];
  const curveZ = (x: number) => {
    if (curveDepth <= 0 || halfW <= 0) return 0;
    const u = Math.min(1, Math.abs(x) / halfW);
    return curveDepth * u * u;
  };
  const pushV = (x: number, y: number, z: number, ao: number) => {
    pos.push(x, y, z + curveZ(x));
    col.push(ao, ao, ao);
  };

  for (let r = 0; r < rings.length - 1; r++) {
    const r0 = rings[r];
    const r1 = rings[r + 1];
    for (let e = 0; e < 4; e++) {
      const [sx0, sy0] = corners[e];
      const [sx1, sy1] = corners[(e + 1) % 4];
      const isHorizontal = sy0 === sy1;
      const segs = isHorizontal && curveDepth > 0 ? 24 : 1;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs;
        const t1 = (s + 1) / segs;
        const x0i = (sx0 + (sx1 - sx0) * t0) * r0.x;
        const y0i = (sy0 + (sy1 - sy0) * t0) * r0.y;
        const x0j = (sx0 + (sx1 - sx0) * t1) * r0.x;
        const y0j = (sy0 + (sy1 - sy0) * t1) * r0.y;
        const x1i = (sx0 + (sx1 - sx0) * t0) * r1.x;
        const y1i = (sy0 + (sy1 - sy0) * t0) * r1.y;
        const x1j = (sx0 + (sx1 - sx0) * t1) * r1.x;
        const y1j = (sy0 + (sy1 - sy0) * t1) * r1.y;

        // Outward-wound CCW triangles (`D × T`) across inner bevel, front face, and outer return
        pushV(x0i, y0i, r0.z, r0.ao);
        pushV(x1i, y1i, r1.z, r1.ao);
        pushV(x1j, y1j, r1.z, r1.ao);

        pushV(x0i, y0i, r0.z, r0.ao);
        pushV(x1j, y1j, r1.z, r1.ao);
        pushV(x0j, y0j, r0.z, r0.ao);
      }
    }
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
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
let cachedStageReflectCanvas: HTMLCanvasElement | null | undefined;
let cachedStageLedWashCanvas: HTMLCanvasElement | null | undefined;
let cachedFrontWallCanvas: HTMLCanvasElement | null | undefined;
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

const CARPET_TILE_M = 1.6;

/** Projects true 1:1 world-space metre UVs onto floors, row slabs & stair treads so carpet textures never stretch or squish. */
function applyWorldBoxUVs(geom: BufferGeometry, tileM = CARPET_TILE_M): BufferGeometry {
  const pos = geom.getAttribute("position");
  const norm = geom.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    if (ny >= nx && ny >= nz) {
      uv[i * 2] = x / tileM;
      uv[i * 2 + 1] = -z / tileM;
    } else if (nz >= nx) {
      uv[i * 2] = x / tileM;
      uv[i * 2 + 1] = y / tileM;
    } else {
      uv[i * 2] = z / tileM;
      uv[i * 2 + 1] = y / tileM;
    }
  }
  geom.setAttribute("uv", new BufferAttribute(uv, 2));
  return geom;
}

let cachedCarpetBumpCanvas: HTMLCanvasElement | null | undefined;
let cachedChairShadowCanvas: HTMLCanvasElement | null | undefined;
let cachedAisleSpillCanvas: HTMLCanvasElement | null | undefined;

/** Soft dark elliptical contact shadow texture placed directly beneath each chair base so seats sit grounded on the carpet. */
function createChairShadowTexture(): CanvasTexture | null {
  if (cachedChairShadowCanvas === undefined) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (!ctx) {
      cachedChairShadowCanvas = null;
    } else {
      ctx.clearRect(0, 0, 64, 64);
      const g = ctx.createRadialGradient(32, 34, 4, 32, 34, 30);
      g.addColorStop(0, "rgba(4, 3, 10, 0.72)");
      g.addColorStop(0.52, "rgba(4, 3, 10, 0.36)");
      g.addColorStop(0.82, "rgba(4, 3, 10, 0.1)");
      g.addColorStop(1, "rgba(4, 3, 10, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      cachedChairShadowCanvas = c;
    }
  }
  if (!cachedChairShadowCanvas) return null;
  const tex = new CanvasTexture(cachedChairShadowCanvas);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/** Soft horizontal light spill decal texture cast onto carpet treads by each aisle step LED strip. */
function createAisleLedSpillTexture(): CanvasTexture | null {
  if (cachedAisleSpillCanvas === undefined) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (!ctx) {
      cachedAisleSpillCanvas = null;
    } else {
      ctx.clearRect(0, 0, 64, 64);
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
      g.addColorStop(0, "rgba(255, 255, 255, 0.85)");
      g.addColorStop(0.35, "rgba(255, 255, 255, 0.34)");
      g.addColorStop(0.72, "rgba(255, 255, 255, 0.08)");
      g.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      cachedAisleSpillCanvas = c;
    }
  }
  if (!cachedAisleSpillCanvas) return null;
  const tex = new CanvasTexture(cachedAisleSpillCanvas);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/** Bakes physical architectural ambient occlusion (corner/baseboard/cornice falloff) into room wall vertices. */
function bakeWallAO(
  geom: BufferGeometry,
  w: number,
  h: number,
  floorHeightAtLocalX: (localX: number) => number,
): BufferGeometry {
  const pos = geom.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const halfW = w / 2;
  const halfH = h / 2;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const worldY = ly + halfH;
    const floorY = floorHeightAtLocalX(lx);
    const distFloor = Math.max(0, worldY - floorY);
    const distCeil = Math.max(0, h - worldY);
    const distCorner = Math.max(0, halfW - Math.abs(lx));

    const floorAO = 0.5 + 0.5 * smoothstep01(0, 1.15, distFloor);
    const ceilAO = 0.62 + 0.38 * smoothstep01(0, 0.95, distCeil);
    const cornerAO = 0.58 + 0.42 * smoothstep01(0, 1.25, distCorner);
    const ao = Math.max(0.34, Math.min(1, floorAO * ceilAO * cornerAO));
    colors[i * 3] = ao;
    colors[i * 3 + 1] = ao;
    colors[i * 3 + 2] = ao;
  }
  geom.setAttribute("color", new BufferAttribute(colors, 3));
  return geom;
}

/** Bakes soft perimeter corner ambient occlusion into the auditorium ceiling plane. */
function bakeCeilingAO(geom: BufferGeometry, w: number, d: number): BufferGeometry {
  const pos = geom.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const halfW = w / 2;
  const halfD = d / 2;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const dx = Math.max(0, halfW - Math.abs(lx));
    const dz = Math.max(0, halfD - Math.abs(ly));
    const aoX = 0.58 + 0.42 * smoothstep01(0, 1.35, dx);
    const aoZ = 0.62 + 0.38 * smoothstep01(0, 1.35, dz);
    const ao = Math.max(0.4, Math.min(1, aoX * aoZ));
    colors[i * 3] = ao;
    colors[i * 3 + 1] = ao;
    colors[i * 3 + 2] = ao;
  }
  geom.setAttribute("color", new BufferAttribute(colors, 3));
  return geom;
}

/** Bakes wall-junction & under-riser crease ambient occlusion into world-space floor slabs and stair treads. */
function bakeFloorAO(
  geom: BufferGeometry,
  xMin: number,
  xMax: number,
  zCreaseBack: number | null,
  zCreaseFront: number | null,
): BufferGeometry {
  const pos = geom.getAttribute("position");
  const norm = geom.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const ny = norm ? norm.getY(i) : 1;
    const distWall = Math.max(0, Math.min(x - xMin, xMax - x));
    const wallAO = 0.56 + 0.44 * smoothstep01(0, 1.05, distWall);
    const backAO =
      zCreaseBack !== null && ny > 0.5
        ? 0.64 + 0.36 * smoothstep01(0, 0.42, Math.max(0, zCreaseBack - z))
        : 1;
    const frontAO =
      zCreaseFront !== null && ny > 0.5
        ? 0.62 + 0.38 * smoothstep01(0, 0.55, Math.max(0, z - zCreaseFront))
        : 1;
    const sideDarken = ny > 0.5 ? 1 : 0.72;
    const ao = Math.max(0.38, Math.min(1, wallAO * backAO * frontAO * sideDarken));
    colors[i * 3] = ao;
    colors[i * 3 + 1] = ao;
    colors[i * 3 + 2] = ao;
  }
  geom.setAttribute("color", new BufferAttribute(colors, 3));
  return geom;
}
function getProceduralCarpetBumpCanvas(): HTMLCanvasElement | null {
  if (cachedCarpetBumpCanvas !== undefined) return cachedCarpetBumpCanvas;
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cachedCarpetBumpCanvas = null;
    return null;
  }
  const img = ctx.createImageData(SIZE, SIZE);
  const out = img.data;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grain = h - Math.floor(h);
      const tuft = (((x + (y & 2)) & 3) === 0 ? 0.16 : -0.05) + ((y & 3) === 0 ? 0.12 : -0.04);
      const v = Math.max(0, Math.min(255, Math.round((0.46 + tuft + (grain - 0.5) * 0.36) * 255)));
      const idx = (y * SIZE + x) * 4;
      out[idx] = v;
      out[idx + 1] = v;
      out[idx + 2] = v;
      out[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cachedCarpetBumpCanvas = canvas;
  return canvas;
}

function getCarpetCanvas(style: CarpetStyle, baseHex: string): HTMLCanvasElement | null {
  const key = `${style}:${baseHex}`;
  const existing = cachedCarpetCanvases.get(key);
  if (existing) return existing;
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = shadeHex(baseHex, 1, "#161320");
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Fine woven broadloom tuft base common across all cinema carpets
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 1400; i++) {
    const px = Math.floor(rand() * SIZE);
    const py = Math.floor(rand() * SIZE);
    ctx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.032)" : "rgba(0, 0, 0, 0.14)";
    ctx.fillRect(px, py, 2, 2);
  }

  if (style === "striped") {
    // Plush directional ribbed auditorium broadloom
    for (let x = 0; x < SIZE; x += 32) {
      const g = ctx.createLinearGradient(x, 0, x + 32, 0);
      g.addColorStop(0, "rgba(0, 0, 0, 0.22)");
      g.addColorStop(0.22, "rgba(255, 255, 255, 0.055)");
      g.addColorStop(0.55, "rgba(255, 255, 255, 0.015)");
      g.addColorStop(0.85, "rgba(0, 0, 0, 0.14)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.22)");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 32, SIZE);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    for (let y = 0; y < SIZE; y += 4) ctx.fillRect(0, y, SIZE, 1);
  } else if (style === "solid") {
    // Dense cut-pile matte wool broadloom with soft micro-pile variation
    for (let i = 0; i < 900; i++) {
      const px = Math.floor(rand() * SIZE);
      const py = Math.floor(rand() * SIZE);
      ctx.fillStyle = i % 3 === 0 ? "rgba(255, 255, 255, 0.022)" : "rgba(0, 0, 0, 0.085)";
      ctx.fillRect(px, py, 3, 2);
    }
  } else {
    // Authentic woven Axminster cinema carpet: subtle tonal diamond lattice + warm burgundy/slate flecks
    ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
    ctx.lineWidth = 2;
    const step = 64;
    for (let o = -SIZE; o <= SIZE * 2; o += step) {
      ctx.beginPath();
      ctx.moveTo(o, 0);
      ctx.lineTo(o + SIZE, SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o, SIZE);
      ctx.lineTo(o + SIZE, 0);
      ctx.stroke();
    }
    // Small woven intersection nodes
    ctx.fillStyle = "rgba(255, 215, 175, 0.06)";
    for (let y = 0; y < SIZE; y += step / 2) {
      for (let x = 0; x < SIZE; x += step / 2) {
        if (((x / (step / 2)) + (y / (step / 2))) % 2 === 0) {
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
      }
    }
    for (let i = 0; i < 650; i++) {
      const x = rand() * SIZE;
      const y = rand() * SIZE;
      const r = 1.2 + rand() * 2.2;
      ctx.fillStyle =
        i % 4 === 0
          ? "rgba(182, 58, 92, 0.14)"
          : i % 4 === 1
            ? "rgba(188, 152, 104, 0.09)"
            : "rgba(64, 72, 114, 0.14)";
      ctx.fillRect(x, y, r, r);
    }
  }

  return putCanvasCache(cachedCarpetCanvases, key, canvas);
}

/** Procedural plush dark cinema carpet texture (256×256) with optional pile bump map. */
function createCarpetTexture(
  repeatX: number,
  repeatZ: number,
  style: CarpetStyle,
  baseHex: string,
): { map: CanvasTexture; bumpMap: CanvasTexture | null } | null {
  const canvas = getCarpetCanvas(style, baseHex);
  if (!canvas) return null;
  const rx = Math.max(1, repeatX);
  const ry = Math.max(1, repeatZ);
  const map = new CanvasTexture(canvas);
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.repeat.set(rx, ry);
  map.colorSpace = SRGBColorSpace;

  const bumpCanvas = getProceduralCarpetBumpCanvas();
  let bumpMap: CanvasTexture | null = null;
  if (bumpCanvas) {
    bumpMap = new CanvasTexture(bumpCanvas);
    bumpMap.wrapS = RepeatWrapping;
    bumpMap.wrapT = RepeatWrapping;
    bumpMap.repeat.set(rx * 2, ry * 2);
  }
  return { map, bumpMap };
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

function getCeilingCanvas(
  style: CeilingStyle,
  baseHex: string,
  starlightColor: StarlightColor = "cool",
): HTMLCanvasElement | null {
  const key = `${style}:${baseHex}:${style === "starlight" ? starlightColor : ""}`;
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
    const rainbowPalette = [
      [186, 230, 253],
      [253, 224, 150],
      [216, 180, 254],
      [253, 164, 175],
      [224, 242, 254],
    ] as const;
    for (let i = 0; i < 48; i++) {
      const sx = rand() * 256;
      const sy = rand() * 256;
      const r = rand() > 0.8 ? 2.3 : 1.3;
      const alpha = 0.4 + rand() * 0.56;
      let rgb: readonly [number, number, number];
      if (starlightColor === "warm") {
        rgb = i % 3 === 0 ? [255, 214, 145] : [255, 240, 206];
      } else if (starlightColor === "rainbow") {
        rgb = rainbowPalette[i % rainbowPalette.length];
      } else {
        rgb = i % 3 === 0 ? [255, 242, 222] : [200, 226, 255];
      }
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.3);
      halo.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(2)})`);
      halo.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 3.3, 0, Math.PI * 2);
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
  starlightColor: StarlightColor = "cool",
): CanvasTexture | null {
  const canvas = getCeilingCanvas(style, baseHex, starlightColor);
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
  const cell = 96;
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
    ctx.fillRect(ox + 3, oy + 3, cell - 6, cell - 6);
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(ox + 7, oy + 7, cell - 14, cell - 14);

    ctx.save();
    ctx.font = `700 ${label.length > 2 ? 32 : label.length > 1 ? 42 : 54}px -apple-system, BlinkMacSystemFont, 'Be Vietnam Pro', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = style.text;
    ctx.fillText(label, ox + cell / 2, oy + cell / 2 + 2, cell - 20);
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

  // Soft rectangular feathered light-spill alpha mask (white base tinted dynamically via `haloMat.color`)
  const img = ctx.createImageData(256, 128);
  const data = img.data;
  for (let y = 0; y < 128; y++) {
    const ny = Math.abs((y + 0.5) / 128 - 0.5) * 2; // 0 at center, 1 at edge
    for (let x = 0; x < 256; x++) {
      const nx = Math.abs((x + 0.5) / 256 - 0.5) * 2;
      // Soft rounded-rectangle SDF extending outside the inner screen box [0..0.68] to 1.0
      const dx = Math.max(0, nx - 0.62) / 0.38;
      const dy = Math.max(0, ny - 0.56) / 0.44;
      const d = Math.hypot(dx, dy);
      const falloff = d >= 1 ? 0 : (1 - d) ** 2.15;
      const idx = (y * 256 + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(falloff * 185);
    }
  }
  ctx.putImageData(img, 0, 0);

  cachedScreenHaloCanvas = canvas;
  return canvas;
}

/** Soft neutral rectangular light-spill texture behind the screen framing (tinted dynamically to match the movie frame). */
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

function getStageReflectCanvas(): HTMLCanvasElement | null {
  if (cachedStageReflectCanvas !== undefined) return cachedStageReflectCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cachedStageReflectCanvas = null;
    return null;
  }
  const img = ctx.createImageData(256, 128);
  const data = img.data;
  for (let y = 0; y < 128; y++) {
    // v = 0 near front wall / screen base, v = 1 toward audience front edge of stage
    const v = (y + 0.5) / 128;
    const zFade = Math.sin(Math.min(1, v * 1.15) * Math.PI * 0.5) * (1 - v) ** 1.45;
    for (let x = 0; x < 256; x++) {
      const nx = Math.abs((x + 0.5) / 256 - 0.5) * 2;
      const xFade = nx >= 1 ? 0 : (1 - nx * nx) ** 1.7;
      const idx = (y * 256 + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(zFade * xFade * 190);
    }
  }
  ctx.putImageData(img, 0, 0);
  cachedStageReflectCanvas = canvas;
  return canvas;
}

function createStageReflectTexture(): CanvasTexture | null {
  const canvas = getStageReflectCanvas();
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function getStageLedWashCanvas(): HTMLCanvasElement | null {
  if (cachedStageLedWashCanvas !== undefined) return cachedStageLedWashCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cachedStageLedWashCanvas = null;
    return null;
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "rgba(255, 206, 146, 0.72)");
  grad.addColorStop(0.32, "rgba(242, 168, 92, 0.32)");
  grad.addColorStop(0.75, "rgba(218, 130, 64, 0.07)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 64);
  cachedStageLedWashCanvas = canvas;
  return canvas;
}

function createStageLedWashTexture(): CanvasTexture | null {
  const canvas = getStageLedWashCanvas();
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function getFrontWallCanvas(): HTMLCanvasElement | null {
  if (cachedFrontWallCanvas !== undefined) return cachedFrontWallCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cachedFrontWallCanvas = null;
    return null;
  }
  // Pitch-black Dolby/CGV acoustic velour baffle wall (absorbs 99% of stray light — never grey vertical stripes)
  ctx.fillStyle = "#030305";
  ctx.fillRect(0, 0, 256, 256);
  let seed = 9137;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 900; i++) {
    const gx = rand() * 256;
    const gy = rand() * 256;
    ctx.fillStyle = i % 3 === 0 ? "rgba(255,255,255,0.008)" : "rgba(0,0,0,0.2)";
    ctx.fillRect(gx, gy, 2, 2);
  }
  cachedFrontWallCanvas = canvas;
  return canvas;
}

function createFrontWallTexture(repeatX: number, repeatY: number): CanvasTexture | null {
  const canvas = getFrontWallCanvas();
  if (!canvas) return null;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
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

function computeScreenCanvasSize(aspect: number): { w: number; h: number } {
  const clamped = Math.max(1.1, Math.min(3.2, Number.isFinite(aspect) && aspect > 0 ? aspect : 2.39));
  const w = clamped >= 1.7 ? 1280 : 1024;
  const h = Math.max(384, Math.min(896, Math.round(w / clamped)));
  return { w, h };
}

function paintScreenFilmGrain(ctx: CanvasRenderingContext2D, w: number, h: number, seedInit: number) {
  let seed = seedInit;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  ctx.save();
  for (let i = 0; i < 1600; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    ctx.fillStyle = i % 2 === 0 ? "rgba(255, 252, 245, 0.022)" : "rgba(0, 0, 0, 0.045)";
    ctx.fillRect(gx, gy, 2, 2);
  }
  ctx.restore();
}

function paintNoirScreen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const horizonY = Math.round(h * 0.72);
  // Moody neon-noir rain-slicked metropolis at night
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#040610");
  sky.addColorStop(0.36, "#10162c");
  sky.addColorStop(0.62, "#291e38");
  sky.addColorStop(0.75, "#5c2b3d");
  sky.addColorStop(1, "#090810");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Warm atmospheric city horizon bloom + secondary cool cyan alley glow
  const bloom = ctx.createRadialGradient(w * 0.5, horizonY - h * 0.04, h * 0.04, w * 0.5, horizonY - h * 0.04, w * 0.44);
  bloom.addColorStop(0, "rgba(255, 174, 102, 0.48)");
  bloom.addColorStop(0.38, "rgba(220, 76, 118, 0.24)");
  bloom.addColorStop(0.72, "rgba(44, 112, 192, 0.12)");
  bloom.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);

  const cyanGlow = ctx.createRadialGradient(w * 0.24, horizonY - h * 0.06, 10, w * 0.24, horizonY - h * 0.06, w * 0.28);
  cyanGlow.addColorStop(0, "rgba(72, 186, 255, 0.24)");
  cyanGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = cyanGlow;
  ctx.fillRect(0, 0, w, h);

  let seed = 8080;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Distant atmospheric skyline silhouettes for depth
  for (let x = 0; x < w; ) {
    const bw = Math.round((w / 1024) * (28 + rand() * 52));
    const bh = Math.round(h * (0.24 + rand() * 0.36));
    const top = horizonY - bh;
    ctx.fillStyle = "rgba(22, 22, 40, 0.72)";
    ctx.fillRect(x, top, Math.max(12, bw - 2), bh + 12);
    x += bw;
  }

  // Soft city mist band separating far and foreground towers
  const mist = ctx.createLinearGradient(0, horizonY - h * 0.22, 0, horizonY + 8);
  mist.addColorStop(0, "rgba(230, 128, 120, 0)");
  mist.addColorStop(0.75, "rgba(225, 134, 126, 0.14)");
  mist.addColorStop(1, "rgba(28, 22, 42, 0.42)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, horizonY - h * 0.22, w, h * 0.24);

  // Foreground skyscrapers with crisp lit office windows & rooftop beacons
  const stepY = Math.max(11, Math.round(h * 0.026));
  const stepX = Math.max(9, Math.round(w * 0.01));
  for (let x = 0; x < w; ) {
    const bw = Math.round((w / 1024) * (36 + rand() * 62));
    const bh = Math.round(h * (0.16 + rand() * 0.42));
    const top = horizonY - bh;
    ctx.fillStyle = "#0f0f1b";
    ctx.fillRect(x, top, Math.max(18, bw - 3), bh + 14);
    if (bh > h * 0.36 && rand() > 0.45) {
      ctx.fillStyle = "rgba(255, 76, 98, 0.85)";
      ctx.beginPath();
      ctx.arc(x + bw * 0.5, top - 4, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let wy = top + stepY; wy < horizonY - 10; wy += stepY) {
      for (let wx = x + 6; wx < x + bw - 10; wx += stepX) {
        if (rand() > 0.62) {
          ctx.fillStyle = rand() > 0.28 ? "rgba(255, 214, 146, 0.54)" : "rgba(120, 210, 255, 0.46)";
          ctx.fillRect(wx, wy, Math.max(4, stepX * 0.46), Math.max(5, stepY * 0.5));
        }
      }
    }
    x += bw;
  }

  // Wet street reflection deck with vertical rain-slicked neon streaks
  const street = ctx.createLinearGradient(0, horizonY, 0, h);
  street.addColorStop(0, "#151224");
  street.addColorStop(1, "#06050c");
  ctx.fillStyle = street;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  for (let i = 0; i < 32; i++) {
    const rx = w * (0.04 + rand() * 0.92);
    const ry = horizonY + (h - horizonY) * (0.08 + rand() * 0.78);
    const rw = w * (0.018 + rand() * 0.055);
    const warm = i % 3 !== 0;
    const g = ctx.createRadialGradient(rx, ry, 2, rx, ry, rw);
    g.addColorStop(0, warm ? "rgba(255, 186, 114, 0.36)" : "rgba(92, 192, 255, 0.34)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(rx - rw, ry - 9, rw * 2, 18);
  }

  paintScreenFilmGrain(ctx, w, h, 8821);
}

function paintGridScreen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const minDim = Math.min(w, h);
  // Precision cinema optical framing & sightline calibration chart (true circles at every screen aspect)
  const bg = ctx.createRadialGradient(cx, cy, minDim * 0.08, cx, cy, Math.max(w, h) * 0.62);
  bg.addColorStop(0, "#1d2638");
  bg.addColorStop(0.65, "#111724");
  bg.addColorStop(1, "#090c14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cell = Math.max(48, Math.round(minDim / 8));
  ctx.strokeStyle = "rgba(148, 178, 224, 0.14)";
  ctx.lineWidth = 1;
  for (let x = cx % cell; x < w; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = cy % cell; y < h; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Safe-action (93%) & safe-title (84%) borders
  const padX1 = Math.round(w * 0.035);
  const padY1 = Math.round(h * 0.045);
  const padX2 = Math.round(w * 0.08);
  const padY2 = Math.round(h * 0.1);
  ctx.strokeStyle = "rgba(148, 198, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(padX1, padY1, w - padX1 * 2, h - padY1 * 2);
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
  ctx.strokeRect(padX2, padY2, w - padX2 * 2, h - padY2 * 2);
  ctx.setLineDash([]);

  // Center optical crosshair & true target circles
  ctx.strokeStyle = "rgba(186, 224, 255, 0.48)";
  ctx.lineWidth = 2;
  const rOuter = minDim * 0.25;
  const rInner = minDim * 0.085;
  const arm = minDim * 0.33;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();

  // Corner framing L-brackets
  ctx.strokeStyle = "rgba(248, 250, 252, 0.74)";
  ctx.lineWidth = 4;
  const mX = Math.round(w * 0.022);
  const mY = Math.round(h * 0.03);
  const bLen = Math.round(minDim * 0.065);
  const corners: [number, number, number, number][] = [
    [mX, mY, 1, 1],
    [w - mX, mY, -1, 1],
    [mX, h - mY, 1, -1],
    [w - mX, h - mY, -1, -1],
  ];
  for (const [bx, by, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(bx + sx * bLen, by);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx, by + sy * bLen);
    ctx.stroke();
  }
}

function paintCosmosScreen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5;
  const horizonY = h * 0.7;

  // High-contrast anamorphic cinema twilight sky (deep midnight zenith -> fiery golden horizon)
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#02040b");
  sky.addColorStop(0.24, "#071128");
  sky.addColorStop(0.46, "#17325c");
  sky.addColorStop(0.61, "#a84a2d");
  sky.addColorStop(0.695, "#ffba74");
  sky.addColorStop(0.76, "#221628");
  sky.addColorStop(1, "#04040a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  let seed = 2026;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Faint diagonal Milky Way atmospheric dust band across upper night sky
  ctx.save();
  ctx.translate(w * 0.36, h * 0.22);
  ctx.rotate(-0.34);
  const milky = ctx.createRadialGradient(0, 0, 10, 0, 0, w * 0.36);
  milky.addColorStop(0, "rgba(154, 188, 255, 0.12)");
  milky.addColorStop(0.45, "rgba(110, 148, 224, 0.05)");
  milky.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.scale(1.6, 0.28);
  ctx.fillStyle = milky;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Crisp pinprick stars in upper zenith
  for (let i = 0; i < 210; i++) {
    const sx = rand() * w;
    const sy = rand() * (h * 0.44);
    const alpha = (1 - sy / (h * 0.44)) ** 1.2 * (0.22 + rand() * 0.72);
    const r = rand() > 0.9 ? 1.5 : 0.85;
    ctx.fillStyle = i % 5 === 0 ? `rgba(255, 226, 184, ${alpha.toFixed(2)})` : `rgba(218, 236, 255, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dramatic backlit sunset volumetric glow
  const sunY = horizonY - h * 0.02;
  const atmos = ctx.createRadialGradient(cx, sunY, h * 0.04, cx, sunY, w * 0.38);
  atmos.addColorStop(0, "rgba(255, 248, 224, 0.95)");
  atmos.addColorStop(0.18, "rgba(255, 198, 124, 0.72)");
  atmos.addColorStop(0.46, "rgba(226, 104, 58, 0.3)");
  atmos.addColorStop(0.75, "rgba(68, 118, 206, 0.1)");
  atmos.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = atmos;
  ctx.fillRect(0, 0, w, h);

  // Subtle volumetric sunset crepuscular rays fanning upward from behind central peaks
  ctx.save();
  for (let i = -3; i <= 3; i++) {
    const rayAngle = i * 0.16;
    ctx.save();
    ctx.translate(cx, sunY);
    ctx.rotate(rayAngle);
    const rg = ctx.createLinearGradient(0, 0, 0, -h * 0.56);
    rg.addColorStop(0, "rgba(255, 226, 174, 0.16)");
    rg.addColorStop(0.55, "rgba(255, 184, 120, 0.04)");
    rg.addColorStop(1, "rgba(255, 184, 120, 0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(w * 0.085, -h * 0.56);
    ctx.lineTo(-w * 0.085, -h * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Layered backlit storm/twilight cloud decks (bright golden rim underside + deep slate cloud tops)
  for (let i = 0; i < 14; i++) {
    const clX = w * (0.04 + (i / 13) * 0.92) + (rand() - 0.5) * (w * 0.06);
    const clY = h * (0.28 + rand() * 0.28);
    const rw = w * (0.08 + rand() * 0.13);
    const rh = h * (0.02 + rand() * 0.026);
    const nearSun = Math.max(0, 1 - Math.abs(clX - cx) / (w * 0.45));
    ctx.save();
    ctx.translate(clX, clY);
    ctx.scale(1, rh / rw);
    // Warm sunlit under-rim
    const rim = ctx.createRadialGradient(0, rw * 0.18, 2, 0, rw * 0.18, rw);
    rim.addColorStop(0, `rgba(255, 198, 134, ${(0.12 + nearSun * 0.28).toFixed(2)})`);
    rim.addColorStop(1, "rgba(255, 198, 134, 0)");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(0, rw * 0.18, rw, 0, Math.PI * 2);
    ctx.fill();
    // Dark upper cloud volume for contrast
    const top = ctx.createRadialGradient(0, -rw * 0.12, 2, 0, -rw * 0.12, rw * 0.88);
    top.addColorStop(0, "rgba(10, 16, 36, 0.36)");
    top.addColorStop(1, "rgba(10, 16, 36, 0)");
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.arc(0, -rw * 0.12, rw * 0.88, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Sharp multi-octave fractal alpine mountain ranges (genuine craggy peaks instead of wavy smooth hills)
  const drawAlpineRange = (
    baseY: number,
    amp: number,
    phase: number,
    valleyDip: number,
    fill: string | CanvasGradient,
    rimColor?: string,
  ) => {
    const steps = 160;
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = u * w;
      const centerDist = Math.abs(u - 0.5) * 2;
      const valley = 1 - valleyDip * Math.exp(-centerDist * centerDist * 4.5);
      // Multi-octave ridged noise for crisp natural alpine crags
      const n1 = 1 - Math.abs(Math.sin(u * 9.5 + phase));
      const n2 = (1 - Math.abs(Math.sin(u * 23.0 + phase * 1.9))) * 0.48;
      const n3 = (1 - Math.abs(Math.sin(u * 51.0 + phase * 3.1))) * 0.2;
      const n4 = (1 - Math.abs(Math.sin(u * 107.0 + phase * 5.7))) * 0.08;
      const ridge = (n1 + n2 + n3 + n4) / 1.76;
      const y = baseY - ridge * amp * valley;
      pts.push([x, y]);
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    if (rimColor) {
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = pts[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };

  // Far misty mountain peaks
  const farGrad = ctx.createLinearGradient(0, horizonY - h * 0.24, 0, horizonY + 12);
  farGrad.addColorStop(0, "rgba(38, 36, 68, 0.85)");
  farGrad.addColorStop(1, "rgba(116, 68, 72, 0.45)");
  drawAlpineRange(horizonY + h * 0.02, h * 0.24, 1.3, 0.55, farGrad);

  // Warm golden mist nestled in the mountain valley
  const valleyMist = ctx.createLinearGradient(0, horizonY - h * 0.14, 0, horizonY + 10);
  valleyMist.addColorStop(0, "rgba(255, 186, 128, 0)");
  valleyMist.addColorStop(1, "rgba(255, 194, 134, 0.24)");
  ctx.fillStyle = valleyMist;
  ctx.fillRect(0, horizonY - h * 0.14, w, h * 0.14 + 10);

  // Mid-range dark alpine silhouette with warm sunset rim kiss near center
  const midGrad = ctx.createLinearGradient(0, horizonY - h * 0.16, 0, horizonY + 16);
  midGrad.addColorStop(0, "#141222");
  midGrad.addColorStop(1, "#0b0a14");
  drawAlpineRange(horizonY + h * 0.04, h * 0.18, 3.8, 0.72, midGrad, "rgba(255, 198, 140, 0.18)");

  // Crisp anamorphic horizontal lens flare cutting across the solar horizon
  const flare = ctx.createLinearGradient(w * 0.12, sunY, w * 0.88, sunY);
  flare.addColorStop(0, "rgba(100, 180, 255, 0)");
  flare.addColorStop(0.28, "rgba(110, 190, 255, 0.14)");
  flare.addColorStop(0.5, "rgba(255, 242, 214, 0.5)");
  flare.addColorStop(0.72, "rgba(110, 190, 255, 0.14)");
  flare.addColorStop(1, "rgba(100, 180, 255, 0)");
  ctx.fillStyle = flare;
  ctx.fillRect(w * 0.12, sunY - 2, w * 0.76, 4);

  // Deep reflective alpine lake (dark mirror surface + organic randomized golden specular flecks — no barcode stripes)
  const lake = ctx.createLinearGradient(0, horizonY, 0, h);
  lake.addColorStop(0, "#161426");
  lake.addColorStop(0.28, "#0b0c18");
  lake.addColorStop(1, "#030308");
  ctx.fillStyle = lake;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  const lakeGlow = ctx.createRadialGradient(cx, horizonY + 8, 6, cx, horizonY + h * 0.12, w * 0.22);
  lakeGlow.addColorStop(0, "rgba(255, 188, 118, 0.34)");
  lakeGlow.addColorStop(0.5, "rgba(218, 112, 74, 0.1)");
  lakeGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = lakeGlow;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  for (let i = 0; i < 165; i++) {
    const t = Math.pow(rand(), 1.35);
    const y = horizonY + 3 + t * (h - horizonY - 12);
    const coneHalf = w * (0.014 + t * 0.11);
    const offset = (rand() - 0.5) * 2 * coneHalf;
    const glintW = (8 + rand() * 34) * (0.35 + t * 1.25);
    const glintH = 1.0 + t * 1.9;
    const alpha = Math.max(0.04, (0.58 - t * 0.44) * (0.4 + rand() * 0.6));
    const gx = cx + offset;
    const gg = ctx.createLinearGradient(gx - glintW * 0.5, y, gx + glintW * 0.5, y);
    gg.addColorStop(0, "rgba(255, 192, 124, 0)");
    gg.addColorStop(0.5, `rgba(255, 224, 174, ${alpha.toFixed(2)})`);
    gg.addColorStop(1, "rgba(255, 192, 124, 0)");
    ctx.fillStyle = gg;
    ctx.fillRect(gx - glintW * 0.5, y, glintW, glintH);
  }

  // Deep pitch-black rocky shore silhouettes framing bottom-left & bottom-right corners for cinematic depth
  const drawCornerCliff = (fromLeft: boolean) => {
    ctx.fillStyle = "#040409";
    ctx.beginPath();
    if (fromLeft) {
      ctx.moveTo(0, h);
      ctx.lineTo(0, horizonY + h * 0.02);
      ctx.lineTo(w * 0.11, horizonY + h * 0.05);
      ctx.lineTo(w * 0.19, horizonY + h * 0.13);
      ctx.lineTo(w * 0.31, horizonY + h * 0.24);
      ctx.lineTo(w * 0.38, h);
    } else {
      ctx.moveTo(w, h);
      ctx.lineTo(w, horizonY + h * 0.01);
      ctx.lineTo(w * 0.89, horizonY + h * 0.05);
      ctx.lineTo(w * 0.8, horizonY + h * 0.14);
      ctx.lineTo(w * 0.69, horizonY + h * 0.25);
      ctx.lineTo(w * 0.62, h);
    }
    ctx.closePath();
    ctx.fill();
  };
  drawCornerCliff(true);
  drawCornerCliff(false);

  paintScreenFilmGrain(ctx, w, h, 3109);
}

function getScreenCanvas(
  preset: ScreenContentPreset,
  aspect: number,
  showSubtitle: boolean,
  subtitleText: string,
  subtitleColor: SubtitleColor,
): HTMLCanvasElement | null {
  const { w, h } = computeScreenCanvasSize(aspect);
  const key = `${preset}|${w}x${h}|${showSubtitle ? 1 : 0}|${subtitleText}|${subtitleColor}`;
  const existing = cachedScreenCanvases.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (preset === "noir") {
    paintNoirScreen(ctx, w, h);
  } else if (preset === "grid") {
    paintGridScreen(ctx, w, h);
  } else {
    paintCosmosScreen(ctx, w, h);
  }

  // Gentle organic optical vignette (kept light because the projection shader handles physical lens falloff + bezel AO)
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.36, w * 0.5, h * 0.5, Math.max(w, h) * 0.64);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(0.75, "rgba(0, 0, 0, 0.08)");
  vig.addColorStop(1, "rgba(0, 0, 0, 0.28)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Crisp DCI-proportioned subtitle in the bottom safe-title region
  if (showSubtitle) {
    paintScreenSubtitle(ctx, w, h, subtitleText, subtitleColor);
  }

  return putCanvasCache(cachedScreenCanvases, key, canvas);
}

/**
 * Samples a fast 16×8 grid from any screen canvas to derive a pleasing, luminance-balanced cinema bounce color
 * so screen light spill onto the front wall, stage apron, and front seats naturally matches the movie frame.
 */
function sampleCanvasScreenTint(canvas: HTMLCanvasElement | null, fallbackHex = 0xc4dcff): Color {
  const out = new Color(fallbackHex);
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return out;
  try {
    const sample = document.createElement("canvas");
    sample.width = 16;
    sample.height = 8;
    const sCtx = sample.getContext("2d", { willReadFrequently: true });
    if (!sCtx) return out;
    sCtx.drawImage(canvas, 0, 0, 16, 8);
    const data = sCtx.getImageData(0, 0, 16, 8).data;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let wSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = max > 0.001 ? (max - min) / max : 0;
      // Weight brighter and subtly colorful areas more than pitch-black borders
      const weight = (0.15 + lum * 0.85) * (0.65 + sat * 0.75);
      rSum += r * weight;
      gSum += g * weight;
      bSum += b * weight;
      wSum += weight;
    }
    if (wSum > 0.001) {
      const avg = new Color(rSum / wSum, gSum / wSum, bSum / wSum);
      const hsl = { h: 0, s: 0, l: 0 };
      avg.getHSL(hsl);
      // Keep bounce light bright & cinematic (never muddy dark or neon-oversaturated)
      out.setHSL(hsl.h, Math.min(0.42, hsl.s * 0.78), Math.max(0.68, Math.min(0.84, 0.56 + hsl.l * 0.34)));
    }
  } catch {
    // CORS-tainted external images fall back cleanly to neutral cinema xenon tint.
  }
  return out;
}

const MAX_LOADED_IMAGE_CACHE = 8;
const cachedLoadedImages = new Map<string, HTMLImageElement>();

function putLoadedImageCache(url: string, img: HTMLImageElement): HTMLImageElement {
  if (cachedLoadedImages.size >= MAX_LOADED_IMAGE_CACHE && !cachedLoadedImages.has(url)) {
    const oldest = cachedLoadedImages.keys().next().value;
    if (oldest !== undefined) cachedLoadedImages.delete(oldest);
  }
  cachedLoadedImages.set(url, img);
  return img;
}

type SurfacePbrKind = "wall" | "ceiling" | "carpet";

interface SurfacePbrCanvases {
  albedo: HTMLCanvasElement;
  bump: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
}

const MAX_SURFACE_PBR_CACHE = 6;
const cachedSurfacePbrCanvases = new Map<string, SurfacePbrCanvases>();

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Computes aspect-preserving physical tile size (metres) and repeat counts from a surface's dimensions (`surfaceW × surfaceH`),
 * the uploaded image's natural aspect ratio (`imgAspect`), and the user's configured repeat count (`repeatCount`, 1–12).
 * Guarantees `repeatCount` complete, uncropped characters/frames fit cleanly inside the surface without stretching.
 */
function computeSurfaceTileLayout(
  surfaceW: number,
  surfaceH: number,
  imgAspect: number,
  repeatCount: number,
): { tileW: number; tileH: number; repeatX: number; repeatY: number } {
  const n = Math.max(1, Math.min(12, Math.round(repeatCount) || 1));
  const safeAspect = Math.max(0.25, Math.min(4.0, imgAspect || 1));
  const tileWFromW = surfaceW / n;
  const tileHFromW = tileWFromW / safeAspect;
  const tileHFromH = surfaceH / n;
  const tileWFromH = tileHFromH * safeAspect;
  const tileW = tileHFromW <= tileHFromH ? tileWFromW : tileWFromH;
  const tileH = tileW / safeAspect;
  return {
    tileW,
    tileH,
    repeatX: surfaceW / tileW,
    repeatY: surfaceH / tileH,
  };
}

/**
 * Synthesizes surface-appropriate PBR canvases (`albedo`, `bump`, `roughness`) from an arbitrary uploaded photo:
 * - Preserves the FULL uploaded image at its natural aspect ratio (up to `512 px` max side — never crops off characters).
 * - Auto-detects already-seamless tiles; otherwise applies a subtle `4.5%` symmetric border soften so repeat edges meet seamlessly with zero ghosting over the subject.
 * - Calibrates cinema light-absorption, micro-relief (bump) and physical roughness specifically for `carpet`, `wall`, or `ceiling`.
 */
function getSurfacePbrCanvases(
  url: string,
  img: HTMLImageElement,
  kind: SurfacePbrKind,
  style: string,
): SurfacePbrCanvases | null {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (nw <= 0 || nh <= 0) return null;

  const safeAspect = Math.max(0.25, Math.min(4.0, nw / nh));
  const round8 = (n: number) => Math.max(128, Math.round(n / 8) * 8);
  const W = safeAspect >= 1 ? 512 : round8(512 * safeAspect);
  const H = safeAspect >= 1 ? round8(512 / safeAspect) : 512;

  const key = `${kind}|${style}|${W}x${H}|${url}`;
  const existing = cachedSurfacePbrCanvases.get(key);
  if (existing) return existing;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = W;
  srcCanvas.height = H;
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) return null;

  // Draw the entire uploaded photo without cropping so characters remain 100% intact
  srcCtx.drawImage(img, 0, 0, nw, nh, 0, 0, W, H);

  let srcData: Uint8ClampedArray;
  try {
    srcData = srcCtx.getImageData(0, 0, W, H).data;
  } catch {
    return null;
  }

  // Detect whether opposite borders already tile seamlessly
  let edgeDiff = 0;
  let edgeSamples = 0;
  for (let y = 0; y < H; y += 4) {
    const l = (y * W) * 4;
    const rIdx = (y * W + (W - 1)) * 4;
    edgeDiff +=
      Math.abs(srcData[l] - srcData[rIdx]) +
      Math.abs(srcData[l + 1] - srcData[rIdx + 1]) +
      Math.abs(srcData[l + 2] - srcData[rIdx + 2]);
    edgeSamples += 3;
  }
  for (let x = 0; x < W; x += 4) {
    const t = x * 4;
    const bIdx = ((H - 1) * W + x) * 4;
    edgeDiff +=
      Math.abs(srcData[t] - srcData[bIdx]) +
      Math.abs(srcData[t + 1] - srcData[bIdx + 1]) +
      Math.abs(srcData[t + 2] - srcData[bIdx + 2]);
    edgeSamples += 3;
  }
  const alreadySeamless = edgeSamples > 0 && edgeDiff / edgeSamples < 14;

  const albedoCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  albedoCanvas.width = bumpCanvas.width = roughCanvas.width = W;
  albedoCanvas.height = bumpCanvas.height = roughCanvas.height = H;
  const aCtx = albedoCanvas.getContext("2d");
  const bCtx = bumpCanvas.getContext("2d");
  const rCtx = roughCanvas.getContext("2d");
  if (!aCtx || !bCtx || !rCtx) return null;

  const aImg = aCtx.createImageData(W, H);
  const bImg = bCtx.createImageData(W, H);
  const rImg = rCtx.createImageData(W, H);
  const aOut = aImg.data;
  const bOut = bImg.data;
  const rOut = rImg.data;

  const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
  const halfW = W / 2;
  const halfH = H / 2;

  for (let y = 0; y < H; y++) {
    // Symmetric outer-border soften (only outermost ~4.5%) so repeat boundaries meet smoothly without ghosting the center character
    const ty = alreadySeamless ? 1 : smoothstep01(0.0, 0.045, Math.min(y, H - 1 - y) / halfH);
    const wySelf = 0.5 + 0.5 * ty;
    const yMirror = H - 1 - y;
    for (let x = 0; x < W; x++) {
      const tx = alreadySeamless ? 1 : smoothstep01(0.0, 0.045, Math.min(x, W - 1 - x) / halfW);
      const wxSelf = 0.5 + 0.5 * tx;
      const xMirror = W - 1 - x;

      const i1 = (y * W + x) * 4;
      let r = srcData[i1];
      let g = srcData[i1 + 1];
      let b = srcData[i1 + 2];
      if (wxSelf < 0.999) {
        const imx = (y * W + xMirror) * 4;
        r = r * wxSelf + srcData[imx] * (1 - wxSelf);
        g = g * wxSelf + srcData[imx + 1] * (1 - wxSelf);
        b = b * wxSelf + srcData[imx + 2] * (1 - wxSelf);
      }
      if (wySelf < 0.999) {
        const imy = (yMirror * W + x) * 4;
        r = r * wySelf + srcData[imy] * (1 - wySelf);
        g = g * wySelf + srcData[imy + 1] * (1 - wySelf);
        b = b * wySelf + srcData[imy + 2] * (1 - wySelf);
      }

      // Fast deterministic tileable hash in [-0.5, 0.5]
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grain = h - Math.floor(h) - 0.5;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      let bumpVal = lum;
      let roughVal = 0.88;

      if (kind === "carpet") {
        const toneScale = lum > 0.55 ? (0.55 + (lum - 0.55) * 0.42) / lum : 0.92;
        const tuft = (((x + (y & 2)) & 3) === 0 ? 0.032 : -0.012) + ((y & 3) === 0 ? 0.024 : -0.01);
        const rib = style === "striped" ? (x % 32 < 14 ? 0.038 : -0.03) : 0;
        const micro = grain * 9 + (tuft + rib) * 38;
        r = r * toneScale + micro;
        g = g * toneScale + micro;
        b = b * toneScale + micro;
        bumpVal = 0.42 * lum + 0.32 * (0.5 + tuft * 3.5 + rib * 2) + 0.26 * (0.5 + grain);
        roughVal = 0.96 - lum * 0.08 + grain * 0.05;
      } else if (kind === "wall") {
        const toneScale = lum > 0.68 ? (0.68 + (lum - 0.68) * 0.5) / lum : 0.96;
        let groove = 0;
        if (style === "slats") {
          const slot = x % 24;
          if (slot >= 20) groove = -0.3;
          else if (slot <= 1) groove = 0.08;
        } else if (style === "panels") {
          if (x % 128 < 4 || y % 256 < 4) groove = -0.26;
        }
        const mul = toneScale * (1 + groove * 0.55);
        r = r * mul + grain * 4;
        g = g * mul + grain * 4;
        b = b * mul + grain * 4;
        bumpVal = 0.68 * lum + 0.22 * (0.5 + groove * 1.4) + 0.1 * (0.5 + grain);
        roughVal = groove < -0.15 ? 0.96 : 0.88 - lum * 0.12;
      } else {
        const toneScale = lum > 0.6 ? (0.6 + (lum - 0.6) * 0.42) / lum : 0.9;
        let seam = 0;
        if (style === "coffered" && (x % 128 < 4 || y % 128 < 4)) seam = -0.32;
        const mul = toneScale * (1 + seam * 0.5);
        r = r * mul + grain * 4;
        g = g * mul + grain * 4;
        b = b * mul + grain * 4;
        bumpVal = 0.62 * lum + 0.26 * (0.5 + seam * 1.3) + 0.12 * (0.5 + grain);
        roughVal = seam < -0.15 ? 0.78 : 0.93 - lum * 0.08;
      }

      aOut[i1] = clampByte(r);
      aOut[i1 + 1] = clampByte(g);
      aOut[i1 + 2] = clampByte(b);
      aOut[i1 + 3] = 255;

      const bByte = clampByte(bumpVal * 255);
      bOut[i1] = bByte;
      bOut[i1 + 1] = bByte;
      bOut[i1 + 2] = bByte;
      bOut[i1 + 3] = 255;

      const rByte = clampByte(roughVal * 255);
      rOut[i1] = rByte;
      rOut[i1 + 1] = rByte;
      rOut[i1 + 2] = rByte;
      rOut[i1 + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  if (kind === "ceiling" && style === "starlight") {
    let seed = 4242;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 42; i++) {
      const px = rand() * W;
      const py = rand() * H;
      const rad = 0.8 + rand() * 1.35;
      aCtx.fillStyle = i % 4 === 0 ? "rgba(255, 224, 178, 0.88)" : "rgba(212, 232, 255, 0.82)";
      aCtx.beginPath();
      aCtx.arc(px, py, rad, 0, Math.PI * 2);
      aCtx.fill();
    }
  }

  const entry: SurfacePbrCanvases = { albedo: albedoCanvas, bump: bumpCanvas, roughness: roughCanvas };
  if (cachedSurfacePbrCanvases.size >= MAX_SURFACE_PBR_CACHE && !cachedSurfacePbrCanvases.has(key)) {
    const oldest = cachedSurfacePbrCanvases.keys().next().value;
    if (oldest !== undefined) cachedSurfacePbrCanvases.delete(oldest);
  }
  cachedSurfacePbrCanvases.set(key, entry);
  return entry;
}

interface SurfacePbrTextures {
  map: CanvasTexture;
  bumpMap: CanvasTexture;
  roughnessMap: CanvasTexture;
  bumpScale: number;
  roughness: number;
  metalness: number;
}

interface SurfaceTextureOptions {
  repeatX: number;
  repeatY: number;
  offsetX?: number;
  offsetY?: number;
}

function createCustomSurfaceTextures(
  url: string,
  img: HTMLImageElement,
  kind: SurfacePbrKind,
  style: string,
  opts: SurfaceTextureOptions,
): SurfacePbrTextures | null {
  const canvases = getSurfacePbrCanvases(url, img, kind, style);
  if (!canvases) return null;

  const rx = Math.max(0.01, opts.repeatX);
  const ry = Math.max(0.01, opts.repeatY);
  const ox = opts.offsetX ?? 0;
  const oy = opts.offsetY ?? 0;
  const makeTile = (canvas: HTMLCanvasElement, isColor: boolean) => {
    const tex = new CanvasTexture(canvas);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(rx, ry);
    if (ox !== 0 || oy !== 0) tex.offset.set(ox, oy);
    if (isColor) tex.colorSpace = SRGBColorSpace;
    return tex;
  };

  return {
    map: makeTile(canvases.albedo, true),
    bumpMap: makeTile(canvases.bump, false),
    roughnessMap: makeTile(canvases.roughness, false),
    bumpScale: kind === "wall" ? 0.052 : kind === "carpet" ? 0.044 : 0.038,
    roughness: kind === "carpet" ? 0.98 : kind === "wall" ? 0.95 : 0.94,
    metalness: kind === "carpet" ? 0.01 : 0.02,
  };
}

function loadSurfaceImage(url: string, onLoaded: (img: HTMLImageElement) => void): HTMLImageElement | null {
  const cached = cachedLoadedImages.get(url);
  if (cached) return cached;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.onload = () => {
    if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
    putLoadedImageCache(url, img);
    onLoaded(img);
  };
  img.src = url;
  return null;
}

function paintScreenSubtitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  subtitleText: string,
  subtitleColor: SubtitleColor,
): void {
  if (subtitleText.trim().length === 0) return;
  ctx.save();
  // Authentic DCI cinema subtitle proportions (~3.6% of screen height) so the screen feels monumentally wide
  const fontSize = Math.round(Math.max(17, Math.min(24, h * 0.036)));
  ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Be Vietnam Pro', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const subY = Math.round(h * 0.935);
  const maxWidth = Math.round(w * 0.78);
  ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 1.5;
  ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.13));
  ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
  ctx.strokeText(subtitleText, w / 2, subY, maxWidth);
  ctx.fillStyle = subtitleColor === "yellow" ? "#fef08a" : "#f4f5f7";
  ctx.fillText(subtitleText, w / 2, subY, maxWidth);
  ctx.restore();
}

interface ScreenTextureResult {
  texture: CanvasTexture;
  tint: Color;
}

/**
 * Aspect-matched atmospheric cinema still (`1280×536` for 2.39:1, `1280×692` for 1.85:1, `1024×716` for 1.43:1)
 * with sample subtitles at the DCI bottom safe-title zone and sampled bounce color.
 */
function createScreenTexture(
  preset: ScreenContentPreset,
  aspect: number,
  showSubtitle: boolean,
  subtitleText: string,
  subtitleColor: SubtitleColor,
): ScreenTextureResult | null {
  const canvas = getScreenCanvas(preset, aspect, showSubtitle, subtitleText, subtitleColor);
  if (!canvas) return null;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { texture, tint: sampleCanvasScreenTint(canvas) };
}

/** Composites an uploaded/external image onto a true-aspect cinema screen canvas with undistorted cover-crop & optional subtitle. */
function createCustomImageScreenTexture(
  img: HTMLImageElement,
  aspect: number,
  showSubtitle: boolean,
  subtitleText: string,
  subtitleColor: SubtitleColor,
): ScreenTextureResult | null {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (nw <= 0 || nh <= 0) return null;
  const { w, h } = computeScreenCanvasSize(aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, w, h);

  // Center-crop ("cover") to fill the exact screen aspect ratio without horizontal/vertical stretching
  const targetRatio = w / h;
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
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  // Subtle cinema lens edge vignette (projection shader adds physical gain falloff & recessed bezel AO)
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.42, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(0.82, "rgba(0, 0, 0, 0.06)");
  vig.addColorStop(1, "rgba(0, 0, 0, 0.22)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  if (showSubtitle) {
    paintScreenSubtitle(ctx, w, h, subtitleText, subtitleColor);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { texture, tint: sampleCanvasScreenTint(canvas) };
}

/**
 * Single-pass luminous cinema projection screen shader (Dolby / Harkness laser projection optics):
 * - Crisp high-contrast luminous projection punch (never dusty grey chalkboard washout)
 * - Gentle off-axis matte viewing gain & subtle optical lens uniformity
 * - Realistic micro house-lights sheen when room lights are on, deepening into rich cinema contrast when dimmed
 * - Razor-clean narrow edge kiss against pitch-black velvet masking
 */
function createProjectionScreenMaterial(
  map: CanvasTexture,
  screenW: number,
  screenH: number,
  borderStyle: ScreenBorderStyle,
  initialLightsLevel: number,
): ShaderMaterial {
  const borderWeight = borderStyle === "velvet" ? 1.0 : borderStyle === "slim" ? 0.6 : 0.25;
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uLightsLevel: { value: initialLightsLevel },
      uBorderStyle: { value: borderWeight },
      uScreenSize: { value: new Vector2(Math.max(0.5, screenW), Math.max(0.5, screenH)) },
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
      uniform sampler2D uMap;
      uniform float uLightsLevel;
      uniform float uBorderStyle;
      uniform vec2 uScreenSize;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec3 tex = texture2D(uMap, vUv).rgb;

        // Subtle matte cinema screen angular gain + gentle projector center luminance uniformity
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float ndv = clamp(dot(normalize(vWorldNormal), viewDir), 0.22, 1.0);
        float angularGain = mix(0.84, 1.05, pow(ndv, 0.36));
        vec2 centered = (vUv - 0.5) * 2.0;
        float lensFalloff = mix(1.04, 0.9, clamp(dot(centered, centered) * 0.42, 0.0, 1.0));

        // Ultra-fine acoustic micro-perforation texture scaled to physical metres
        vec2 mPos = vUv * uScreenSize;
        float micro = 1.0 + sin(mPos.x * 92.0) * sin(mPos.y * 92.0) * 0.007;

        // Luminous cinema projection contrast & brightness boost (crisp deep blacks + glowing highlights)
        vec3 projected = pow(max(tex, vec3(0.0)), vec3(1.06)) * mix(1.24, 1.1, uLightsLevel);
        projected *= angularGain * lensFalloff * micro;

        // Realistic subtle house-lights ambient reflection in linear space (keeps blacks dark, never chalky grey!)
        float topSpill = smoothstep(0.25, 1.0, vUv.y) * 0.0022 * uLightsLevel;
        float ambientLift = uLightsLevel * 0.0042 + topSpill;
        projected += vec3(0.95, 0.91, 0.86) * ambientLift;

        // Razor-crisp narrow 2 cm edge kiss against jet-black velvet masking (no muddy inner smudge)
        float edgeX = min(vUv.x, 1.0 - vUv.x) * uScreenSize.x;
        float edgeY = min(vUv.y, 1.0 - vUv.y) * uScreenSize.y;
        float recess = smoothstep(0.0, 0.022, edgeX) * smoothstep(0.0, 0.022, edgeY);
        projected *= mix(1.0 - 0.1 * uBorderStyle, 1.0, recess);

        gl_FragColor = vec4(projected, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

function buildScreenYoutubeUrl(videoId: string, muted: boolean, startSeconds?: number): string {
  const origin =
    typeof window !== "undefined" && /^https?:$/i.test(window.location.protocol)
      ? window.location.origin
      : undefined;
  return youtubeScreenEmbedUrl(videoId, { muted, origin, startSeconds });
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
      setCameraPreset() {},
      recenter() {},
      setHeat() {},
      setSelected() {},
      setAudience() {},
      setLightsUp() {},
      setHeights() {},
      setMarks() {},
      setSightline() {},
      setOccupancy() {},
      setHighlightedCodes() {},
      getCameraState: () => ({ mode: "orbit", pos: [0, 3, 8], target: [0, 1.5, 0], lookYaw: 0, lookPitch: 0, zoom: 1 }),
      setLookOffset() {},
      setAppearance() {},
      setYoutubeMuted() {},
      captureSnapshot: async () => null,
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
  const ambientLight = new AmbientLight(0xd4ddf5, 0.22);
  scene.add(ambientLight);

  const hemiLight = new HemisphereLight(0xffe9cf, 0x0b0912, 0.32);
  scene.add(hemiLight);

  const ceilingKey = new DirectionalLight(0xffe7c8, 0.46);
  ceilingKey.position.set(shellCenterX, room.ceilingY + 2, shellCenterZ + 2);
  ceilingKey.target.position.set(shellCenterX, 0.8, room.depthM * 0.45);
  scene.add(ceilingKey);
  scene.add(ceilingKey.target);

  // Two spatial ceiling tungsten downlight pools casting realistic warm light-and-shadow falloff across seats, steps & walls
  const poolRange = Math.max(12, shellD * 0.95);
  const housePoolFront = new PointLight(0xffdca8, 22, poolRange, 2.0);
  housePoolFront.position.set(shellCenterX, room.ceilingY - 0.35, room.frontWallZ + shellD * 0.34);
  scene.add(housePoolFront);

  const housePoolBack = new PointLight(0xffdca8, 22, poolRange, 2.0);
  housePoolBack.position.set(shellCenterX, room.ceilingY - 0.35, room.frontWallZ + shellD * 0.72);
  scene.add(housePoolBack);

  const screenTiltRad = (room.screen.tiltDeg * Math.PI) / 180;

  // Screen bounce light with true inverse-square falloff (softly kisses nearby walls/seats without floodlighting bright custom surfaces)
  const screenBounce = new PointLight(0xb8d4ff, 6, Math.max(16, room.backWallZ * 1.4), 2.0);
  screenBounce.position.set(room.screen.centreX, room.screen.centerY, room.screen.centerZ + 1.35);
  scene.add(screenBounce);

  const screenFill = new DirectionalLight(0x9ec2f7, 0.14);
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

  // --- 1. Persistent Stepped Stadium Floor, Contrast Risers & Aisle Stairs (Carpet/Floor PBR swaps in-place) ---
  let carpetTex: CanvasTexture | null = null;
  let carpetBumpTex: CanvasTexture | null = null;
  let carpetRoughTex: CanvasTexture | null = null;
  let carpetBuildToken = 0;

  const floorXMin = -leftMargin;
  const floorXMax = room.widthM + rightMargin;
  const baseFloorGeom = new PlaneGeometry(shellW, shellD, 12, 12);
  baseFloorGeom.rotateX(-Math.PI / 2);
  baseFloorGeom.translate(shellCenterX, 0.004, shellCenterZ);
  applyWorldBoxUVs(baseFloorGeom);
  bakeFloorAO(baseFloorGeom, floorXMin, floorXMax, null, room.frontWallZ + 0.5);
  track(baseFloorGeom);
  const baseFloorMat = track(
    new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0.01,
      vertexColors: true,
    }),
  );
  const baseFloor = new Mesh(baseFloorGeom, baseFloorMat);
  scene.add(baseFloor);

  let slabMaterial: MeshStandardMaterial | null = null;
  if (room.floorSlabs.length > 0) {
    slabMaterial = track(
      new MeshStandardMaterial({
        color: 0xf4f2f8,
        roughness: 0.96,
        metalness: 0.01,
        vertexColors: true,
      }),
    );

    // Build all tiered row slabs with world-space metre UVs + wall/under-riser AO (merged into 1 draw call)
    const slabParts: BufferGeometry[] = [];
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
      const g = new BoxGeometry(shellW - 0.02, h, d + 0.01, 10, 1, 4);
      g.translate(shellCenterX, h / 2, (slab.zStart + slab.zEnd) / 2);
      const hasBackRiser = i < room.floorSlabs.length - 1 && room.floorSlabs[i + 1].height > slab.height + 0.02;
      slabParts.push(
        bakeFloorAO(
          applyWorldBoxUVs(normalizePart(g)),
          floorXMin,
          floorXMax,
          hasBackRiser ? slab.zEnd : room.backWallZ,
          null,
        ),
      );

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
    const mergedSlabs = mergeGeometries(slabParts, false);
    for (const p of slabParts) p.dispose();
    if (mergedSlabs) {
      track(mergedSlabs);
      scene.add(new Mesh(mergedSlabs, slabMaterial));
    }
    if (riserMesh) {
      riserMesh.instanceMatrix.needsUpdate = true;
      scene.add(riserMesh);
    }
    if (lipMesh) {
      lipMesh.instanceMatrix.needsUpdate = true;
      scene.add(lipMesh);
    }
  }

  // Real intermediate stair treads along open vertical/side walkways (world-space UVs + crisp front riser & nosing trim)
  let stairMat: MeshStandardMaterial | null = null;
  if (room.aisleSteps.length > 0) {
    stairMat = track(
      new MeshStandardMaterial({
        color: 0xeceaf2,
        roughness: 0.92,
        metalness: 0.02,
      }),
    );
    const stairParts: BufferGeometry[] = [];
    const stepRiserGeom = track(new PlaneGeometry(1, 1));
    const stepRiserMat = track(new MeshStandardMaterial({ color: 0x0a0810, roughness: 0.95, metalness: 0.02 }));
    const stepRiserMesh = track(new InstancedMesh(stepRiserGeom, stepRiserMat, room.aisleSteps.length));
    const stepLipGeom = track(new BoxGeometry(1, 0.016, 0.036));
    const stepLipMat = track(new MeshStandardMaterial({ color: 0x262134, roughness: 0.68, metalness: 0.16 }));
    const stepLipMesh = track(new InstancedMesh(stepLipGeom, stepLipMat, room.aisleSteps.length));

    room.aisleSteps.forEach((step, i) => {
      const g = new BoxGeometry(step.widthM, step.heightM, step.depthM);
      g.translate(step.x, step.y, step.z);
      stairParts.push(applyWorldBoxUVs(normalizePart(g)));

      tmpMat.compose(
        tmpPos.set(step.x, step.y, step.z - step.depthM / 2 - 0.004),
        tmpQuat.setFromAxisAngle(yAxis, Math.PI),
        tmpScale.set(step.widthM - 0.01, step.heightM, 1),
      );
      stepRiserMesh.setMatrixAt(i, tmpMat);
      tmpMat.compose(
        tmpPos.set(step.x, step.y + step.heightM / 2 + 0.003, step.z - step.depthM / 2 + 0.016),
        tmpQuat.identity(),
        tmpScale.set(step.widthM - 0.01, 1, 1),
      );
      stepLipMesh.setMatrixAt(i, tmpMat);
    });
    const mergedStairs = mergeGeometries(stairParts, false);
    for (const p of stairParts) p.dispose();
    if (mergedStairs) {
      track(mergedStairs);
      scene.add(new Mesh(mergedStairs, stairMat));
    }
    stepRiserMesh.instanceMatrix.needsUpdate = true;
    stepLipMesh.instanceMatrix.needsUpdate = true;
    scene.add(stepRiserMesh, stepLipMesh);
  }

  function assignCarpetMaps(
    nextMap: CanvasTexture | null,
    nextBump: CanvasTexture | null,
    nextRough: CanvasTexture | null,
    bumpScale: number,
    roughness: number,
    metalness: number,
  ) {
    const prevMap = carpetTex;
    const prevBump = carpetBumpTex;
    const prevRough = carpetRoughTex;
    carpetTex = nextMap;
    carpetBumpTex = nextBump;
    carpetRoughTex = nextRough;

    for (const mat of [baseFloorMat, slabMaterial, stairMat]) {
      if (!mat) continue;
      mat.map = nextMap;
      mat.bumpMap = nextBump;
      mat.bumpScale = bumpScale;
      mat.roughnessMap = nextRough;
      mat.roughness = roughness;
      mat.metalness = metalness;
      mat.needsUpdate = true;
    }
    prevMap?.dispose();
    prevBump?.dispose();
    prevRough?.dispose();
  }

  function applyCarpetSurface(ui: Room3DAppearance, triggerRender = false) {
    const token = ++carpetBuildToken;
    const customUrl = ui.carpetImageUrl.trim();
    const repeatCount = ui.carpetImageRepeat;
    const carpetOpts = (img: HTMLImageElement): SurfaceTextureOptions => {
      const imgAspect = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
      const layout = computeSurfaceTileLayout(shellW, shellD, imgAspect, repeatCount);
      const phaseX = Math.round(layout.repeatX) % 2 === 1 ? 0.5 : 0;
      const phaseY = Math.round(layout.repeatY) % 2 === 1 ? 0.5 : 0;
      return {
        repeatX: CARPET_TILE_M / layout.tileW,
        repeatY: CARPET_TILE_M / layout.tileH,
        offsetX: phaseX - shellCenterX / layout.tileW,
        offsetY: phaseY + shellCenterZ / layout.tileH,
      };
    };
    const applyCustom = (img: HTMLImageElement) => {
      if (disposed || token !== carpetBuildToken) return;
      const pbr = createCustomSurfaceTextures(customUrl, img, "carpet", ui.carpetStyle, carpetOpts(img));
      if (!pbr) return;
      assignCarpetMaps(pbr.map, pbr.bumpMap, pbr.roughnessMap, pbr.bumpScale, pbr.roughness, pbr.metalness);
      requestRender();
    };

    if (customUrl) {
      const cached = loadSurfaceImage(customUrl, applyCustom);
      if (cached) {
        const pbr = createCustomSurfaceTextures(customUrl, cached, "carpet", ui.carpetStyle, carpetOpts(cached));
        if (pbr) {
          assignCarpetMaps(pbr.map, pbr.bumpMap, pbr.roughnessMap, pbr.bumpScale, pbr.roughness, pbr.metalness);
          if (triggerRender) requestRender();
          return;
        }
      }
    }

    const fallback = createCarpetTexture(1, 1, ui.carpetStyle, ui.carpetColor);
    assignCarpetMaps(fallback?.map ?? null, fallback?.bumpMap ?? null, null, 0.022, 0.94, 0.02);
    if (triggerRender) requestRender();
  }

  applyCarpetSurface(currentAppearance);

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
  let beamColorUniform: { value: Color } | null = null;
  let screenLightsUniform: { value: number } | null = null;
  let stageLedMat: MeshBasicMaterial | null = null;
  let stageLedWashMat: MeshBasicMaterial | null = null;
  let stageReflectMat: MeshBasicMaterial | null = null;
  let ceilingReflectMat: MeshBasicMaterial | null = null;
  let sideWallReflectMat: MeshBasicMaterial | null = null;
  let aisleLedSpillMat: MeshBasicMaterial | null = null;
  let haloMat: MeshBasicMaterial | null = null;
  let leftCurtainWing: Group | null = null;
  let rightCurtainWing: Group | null = null;
  let leftCurtainClosedScale = 1;
  let rightCurtainClosedScale = 1;
  const screenTintColor = new Color(0xc4dcff);
  const beamBaseColor = new Color(0xc2dcff);
  const whiteTintRef = new Color(0xdce8ff);
  // Dynamic House-Lights Dimmer State (0 = Movie Dimmed, 1 = House Lights On) — hoisted above `buildInterior`
  let lightsTarget = options.lightsUp ? 1 : 0;
  let lightsLevel = lightsTarget;
  let lightTween: { start: number; from: number; to: number } | null = null;
  // Animated velvet proscenium curtains (0 = dramatic pre-show framing when lights up, 1 = retracted wide open for movie)
  let curtainTarget = options.lightsUp ? 0 : 1;
  let curtainOpen = curtainTarget;
  let curtainTween: { start: number; from: number; to: number } | null = null;

  function applyCurtainOpen(v: number) {
    const open = currentAppearance.screenCurtainsAnimated ? v : 1;
    if (leftCurtainWing) leftCurtainWing.scale.x = leftCurtainClosedScale + (1 - leftCurtainClosedScale) * open;
    if (rightCurtainWing) rightCurtainWing.scale.x = rightCurtainClosedScale + (1 - rightCurtainClosedScale) * open;
  }

  function applyScreenTint(nextTint: Color) {
    screenTintColor.copy(nextTint);
    screenBounce.color.copy(nextTint);
    screenFill.color.copy(nextTint).lerp(whiteTintRef, 0.18);
    if (haloMat) haloMat.color.copy(nextTint);
    if (stageReflectMat) stageReflectMat.color.copy(nextTint);
    if (ceilingReflectMat) ceilingReflectMat.color.copy(nextTint);
    if (sideWallReflectMat) sideWallReflectMat.color.copy(nextTint);
    if (beamColorUniform) beamColorUniform.value.copy(beamBaseColor).lerp(nextTint, 0.28);
  }

  const bulbDimColor = new Color(0x0a090d);
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
  let youtubeGlazeEl: HTMLDivElement | null = null;
  let youtubeCssW = 1280;
  let youtubeCssH = 536;
  let activeYoutubeId: string | null = null;
  let youtubeMuted = options.youtubeMuted ?? true;
  let youtubeSyncToken = 0;
  let ytPlayer: YtPlayer | null = null;
  let ytReady = false;
  let youtubePlayerToken = 0;
  let youtubeVerifyTimer = 0;
  let youtubeApiFallback = false;
  let pausedYoutubeByVisibility = false;
  const screenWorldCenter = new Vector3(room.screen.centreX, room.screen.centerY, room.screen.centerZ);
  const screenCamPos = new Vector3();

  function clearYoutubeVerifyTimer() {
    if (youtubeVerifyTimer) {
      window.clearTimeout(youtubeVerifyTimer);
      youtubeVerifyTimer = 0;
    }
  }

  function teardownYoutubePlayer() {
    youtubePlayerToken++;
    clearYoutubeVerifyTimer();
    ytPlayer = null;
    ytReady = false;
    youtubeApiFallback = false;
  }

  function postYoutubeCommand(func: string, args: unknown[] = []) {
    const win = youtubeIframe?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(JSON.stringify({ event: "command", func, args }), YOUTUBE_EMBED_HOST);
    } catch {
      // Ignore cross-origin frame messaging errors before the YouTube player finishes mounting.
    }
  }

  function sendYoutubeListeningHandshake(iframe: HTMLIFrameElement) {
    const win = iframe.contentWindow;
    if (!win) return;
    try {
      win.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), YOUTUBE_EMBED_HOST);
    } catch {
      // Ignore cross-origin frame messaging errors before the YouTube player finishes mounting.
    }
  }

  function scheduleYoutubeUnmuteVerify() {
    clearYoutubeVerifyTimer();
    const expectedToken = youtubePlayerToken;
    youtubeVerifyTimer = window.setTimeout(() => {
      youtubeVerifyTimer = 0;
      if (disposed || expectedToken !== youtubePlayerToken || youtubeMuted || !activeYoutubeId) return;
      if (!ytPlayer || !ytReady) return;
      try {
        const state = ytPlayer.getPlayerState?.();
        const actuallyMuted = ytPlayer.isMuted?.() ?? false;
        const stalled = state !== undefined && state !== YT_STATE.playing && state !== YT_STATE.buffering;
        if (actuallyMuted || stalled) {
          // Browser/iOS autoplay policy blocked unmuted playback — fall back cleanly to muted play and sync UI.
          youtubeMuted = true;
          ytPlayer.mute();
          ytPlayer.playVideo();
          options.onYoutubeMutedChange?.(true);
        }
      } catch {
        // Ignore transient YouTube IFrame API errors during teardown.
      }
    }, 750);
  }

  function applyYoutubeAudio(muted: boolean) {
    clearYoutubeVerifyTimer();
    youtubeMuted = muted;
    if (!activeYoutubeId || !youtubeIframe) return;
    if (muted) {
      if (ytPlayer && ytReady) {
        try {
          ytPlayer.mute();
        } catch {
          postYoutubeCommand("mute");
        }
      } else {
        postYoutubeCommand("mute");
      }
      return;
    }

    // Run synchronously inside the user's click/tap gesture so Safari / iOS PWA preserves audio activation.
    if (ytPlayer && ytReady) {
      try {
        ytPlayer.unMute();
        ytPlayer.setVolume?.(100);
        ytPlayer.playVideo();
      } catch {
        postYoutubeCommand("unMute");
        postYoutubeCommand("setVolume", [100]);
        postYoutubeCommand("playVideo");
      }
    } else {
      if (youtubeApiFallback) sendYoutubeListeningHandshake(youtubeIframe);
      postYoutubeCommand("unMute");
      postYoutubeCommand("setVolume", [100]);
      postYoutubeCommand("playVideo");
    }
    scheduleYoutubeUnmuteVerify();
  }

  function syncYoutubeOpticalGlaze(lvl: number, borderStyle: ScreenBorderStyle) {
    if (!youtubeGlazeEl) return;
    const shadowPx = borderStyle === "velvet" ? 14 : borderStyle === "slim" ? 8 : 4;
    const shadowAlpha = borderStyle === "velvet" ? 0.28 : borderStyle === "slim" ? 0.18 : 0.1;
    const topWash = (lvl * 0.045).toFixed(3);
    const midWash = (lvl * 0.022).toFixed(3);
    youtubeGlazeEl.style.boxShadow = `inset 0 0 ${shadowPx}px rgba(0, 0, 0, ${shadowAlpha})`;
    youtubeGlazeEl.style.background =
      lvl > 0.01
        ? `linear-gradient(180deg, rgba(235, 232, 224, ${topWash}) 0%, rgba(235, 232, 224, ${midWash}) 100%)`
        : "none";
  }

  function createAndAttachYoutubeIframe(videoId: string, startSeconds = 0) {
    if (!youtubeWrapper) return;
    teardownYoutubePlayer();
    youtubeIframe?.remove();
    const playerToken = youtubePlayerToken;

    const cover = computeYoutubeCoverLayout(youtubeCssW, youtubeCssH);
    const iframe = document.createElement("iframe");
    iframe.src = buildScreenYoutubeUrl(videoId, youtubeMuted, startSeconds);
    iframe.title = "YouTube cinema screen";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.style.cssText = `position:absolute;left:${cover.left}px;top:${cover.top}px;width:${cover.width}px;height:${cover.height}px;border:0;display:block;pointer-events:none`;
    iframe.addEventListener("load", () => {
      if (disposed || playerToken !== youtubePlayerToken || youtubeIframe !== iframe) return;
      if (youtubeApiFallback) {
        sendYoutubeListeningHandshake(iframe);
        if (!youtubeMuted) {
          postYoutubeCommand("unMute");
          postYoutubeCommand("setVolume", [100]);
          postYoutubeCommand("playVideo");
        }
      }
    });
    youtubeIframe = iframe;
    if (youtubeGlazeEl) youtubeWrapper.insertBefore(iframe, youtubeGlazeEl);
    else youtubeWrapper.appendChild(iframe);

    void loadYouTubeApi()
      .then((yt) => {
        if (disposed || playerToken !== youtubePlayerToken || youtubeIframe !== iframe) return;
        const player = new yt.Player(iframe, {
          host: YOUTUBE_EMBED_HOST,
          events: {
            onReady: () => {
              if (disposed || playerToken !== youtubePlayerToken || youtubeIframe !== iframe) return;
              ytReady = true;
              try {
                if (youtubeMuted) {
                  player.mute();
                  player.playVideo();
                } else {
                  player.unMute();
                  player.setVolume?.(100);
                  player.playVideo();
                  scheduleYoutubeUnmuteVerify();
                }
              } catch {
                // Ignore transient YouTube IFrame API errors.
              }
            },
            onStateChange: ({ data }) => {
              if (disposed || playerToken !== youtubePlayerToken || youtubeIframe !== iframe) return;
              if (data === YT_STATE.ended) {
                try {
                  player.playVideo();
                } catch {
                  postYoutubeCommand("playVideo");
                }
              }
            },
          },
        });
        ytPlayer = player;
      })
      .catch(() => {
        if (disposed || playerToken !== youtubePlayerToken || youtubeIframe !== iframe) return;
        youtubeApiFallback = true;
        sendYoutubeListeningHandshake(iframe);
        if (!youtubeMuted) {
          postYoutubeCommand("unMute");
          postYoutubeCommand("setVolume", [100]);
          postYoutubeCommand("playVideo");
        }
      });
  }

  function syncYoutubeLayer(videoId: string | null) {
    const syncToken = ++youtubeSyncToken;
    if (!videoId) {
      scene.background = bgColor;
      renderer.setClearColor(0x050508, 1);
      pausedYoutubeByVisibility = false;
      teardownYoutubePlayer();
      if (activeYoutubeId !== null || cssScreenObj !== null) {
        activeYoutubeId = null;
        if (cssScreenObj && cssScene) cssScene.remove(cssScreenObj);
        cssScreenObj = null;
        youtubeIframe?.remove();
        youtubeIframe = null;
        youtubeGlazeEl?.remove();
        youtubeGlazeEl = null;
        youtubeWrapper?.remove();
        youtubeWrapper = null;
        if (cssRenderer) cssRenderer.domElement.style.display = "none";
        if (!youtubeMuted) {
          youtubeMuted = true;
          options.onYoutubeMutedChange?.(true);
        }
      }
      return;
    }

    scene.background = null;
    renderer.setClearColor(0x050508, 0);

    // Preserve the live player when switching quick themes / walls / lights while keeping the same YouTube video.
    if (activeYoutubeId === videoId && youtubeIframe && cssScreenObj && cssRenderer) {
      cssRenderer.domElement.style.display = "block";
      syncYoutubeOpticalGlaze(lightsLevel, currentAppearance.screenBorder);
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
        teardownYoutubePlayer();
        youtubeIframe?.remove();
        youtubeIframe = null;
        youtubeGlazeEl?.remove();
        youtubeGlazeEl = null;
        youtubeWrapper?.remove();

        activeYoutubeId = videoId;
        youtubeCssW = 1280;
        youtubeCssH = Math.max(360, Math.round(youtubeCssW * (room.screen.height / Math.max(0.1, room.screen.width))));

        youtubeWrapper = document.createElement("div");
        youtubeWrapper.style.cssText = `position:relative;width:${youtubeCssW}px;height:${youtubeCssH}px;background:#000;overflow:hidden;pointer-events:none;backface-visibility:hidden`;

        youtubeGlazeEl = document.createElement("div");
        youtubeGlazeEl.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:2";
        youtubeWrapper.appendChild(youtubeGlazeEl);
        syncYoutubeOpticalGlaze(lightsLevel, currentAppearance.screenBorder);

        createAndAttachYoutubeIframe(videoId);

        cssScreenObj = new CSS3DObjectCtor(youtubeWrapper);
        // `CSS3DObject` sets `pointerEvents = "auto"` in its constructor; override so WebGL owns 100% of orbit/click input.
        youtubeWrapper.style.pointerEvents = "none";
        cssScreenObj.position.set(room.screen.centreX, room.screen.centerY, room.screen.centerZ);
        cssScreenObj.rotation.x = screenTiltRad;
        cssScreenObj.scale.set(room.screen.width / youtubeCssW, room.screen.height / youtubeCssH, 1);
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
    beamColorUniform = null;
    screenLightsUniform = null;
    stageLedMat = null;
    stageLedWashMat = null;
    stageReflectMat = null;
    ceilingReflectMat = null;
    sideWallReflectMat = null;
    aisleLedSpillMat = null;
    haloMat = null;
    leftCurtainWing = null;
    rightCurtainWing = null;
    leftCurtainClosedScale = 1;
    rightCurtainClosedScale = 1;

    const sconceAccent = SCONCE_ACCENT_STOPS[ui.sconceColor] ?? SCONCE_ACCENT_STOPS.warm;
    slitDimColor.setHex(sconceAccent.dim);
    slitLitColor.setHex(sconceAccent.lit);
    const coveAccent = SCONCE_ACCENT_STOPS[ui.coveLedColor] ?? SCONCE_ACCENT_STOPS.warm;
    coveDimColor.setHex(coveAccent.dim);
    coveLitColor.setHex(coveAccent.lit);

    // Architectural walls & ceiling (supports synthesized PBR materials from uploaded/external images)
    const wallTexSide = createAcousticWallTexture(shellD / 2.2, room.ceilingY / 2.5, ui.wallStyle, ui.wallColor);
    if (wallTexSide) trackInterior(wallTexSide);
    const wallTexBack = createAcousticWallTexture(shellW / 2.2, room.ceilingY / 2.5, ui.wallStyle, ui.wallColor);
    if (wallTexBack) trackInterior(wallTexBack);
    const ceilTex = createCeilingTexture(shellW / 2.8, shellD / 2.8, ui.ceilingStyle, ui.ceilingColor, ui.starlightColor);
    if (ceilTex) trackInterior(ceilTex);

    const sideWallMat = trackInterior(
      new MeshStandardMaterial({
        color: 0xffffff,
        map: wallTexSide,
        roughness: 0.94,
        metalness: 0.02,
        vertexColors: true,
      }),
    );
    const backWallMat = trackInterior(
      new MeshStandardMaterial({
        color: 0xe6e4f0,
        map: wallTexBack,
        roughness: 0.95,
        metalness: 0.02,
        vertexColors: true,
      }),
    );
    const frontWallTex = createFrontWallTexture(shellW / 2.2, room.ceilingY / 2.4);
    if (frontWallTex) trackInterior(frontWallTex);
    const frontWallMat = trackInterior(
      new MeshStandardMaterial({
        color: frontWallTex ? 0xffffff : 0x030305,
        map: frontWallTex,
        roughness: 0.99,
        metalness: 0.0,
      }),
    );
    const ceilMat = trackInterior(
      new MeshStandardMaterial({
        color: 0xffffff,
        map: ceilTex,
        roughness: 0.93,
        metalness: 0.03,
        vertexColors: true,
      }),
    );

    const applyCustomPbr = (
      mat: MeshStandardMaterial,
      pbr: SurfacePbrTextures,
    ) => {
      const prevMap = mat.map;
      const prevBump = mat.bumpMap;
      const prevRough = mat.roughnessMap;
      mat.map = pbr.map;
      mat.bumpMap = pbr.bumpMap;
      mat.bumpScale = pbr.bumpScale;
      mat.roughnessMap = pbr.roughnessMap;
      mat.roughness = pbr.roughness;
      mat.metalness = pbr.metalness;
      mat.needsUpdate = true;
      trackInterior(pbr.map);
      trackInterior(pbr.bumpMap);
      trackInterior(pbr.roughnessMap);
      prevMap?.dispose();
      prevBump?.dispose();
      prevRough?.dispose();
    };

    const planeSurfaceOpts = (
      surfaceW: number,
      surfaceH: number,
      img: HTMLImageElement,
      repeatCount: number,
    ): SurfaceTextureOptions => {
      const imgAspect = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
      const layout = computeSurfaceTileLayout(surfaceW, surfaceH, imgAspect, repeatCount);
      const phaseX = Math.round(layout.repeatX) % 2 === 1 ? 0.5 : 0;
      const phaseY = Math.round(layout.repeatY) % 2 === 1 ? 0.5 : 0;
      return {
        repeatX: layout.repeatX,
        repeatY: layout.repeatY,
        offsetX: phaseX - 0.5 * layout.repeatX,
        offsetY: phaseY - 0.5 * layout.repeatY,
      };
    };

    const customWallUrl = ui.wallImageUrl.trim();
    if (customWallUrl) {
      const wallRepeat = ui.wallImageRepeat;
      const applyWallImg = (img: HTMLImageElement) => {
        if (disposed || buildToken !== interiorBuildToken) return;
        const sidePbr = createCustomSurfaceTextures(
          customWallUrl,
          img,
          "wall",
          ui.wallStyle,
          planeSurfaceOpts(shellD, room.ceilingY, img, wallRepeat),
        );
        const backPbr = createCustomSurfaceTextures(
          customWallUrl,
          img,
          "wall",
          ui.wallStyle,
          planeSurfaceOpts(shellW, room.ceilingY, img, wallRepeat),
        );
        if (sidePbr) applyCustomPbr(sideWallMat, sidePbr);
        if (backPbr) applyCustomPbr(backWallMat, backPbr);
        requestRender();
      };
      const cachedWall = loadSurfaceImage(customWallUrl, applyWallImg);
      if (cachedWall) {
        const sidePbr = createCustomSurfaceTextures(
          customWallUrl,
          cachedWall,
          "wall",
          ui.wallStyle,
          planeSurfaceOpts(shellD, room.ceilingY, cachedWall, wallRepeat),
        );
        const backPbr = createCustomSurfaceTextures(
          customWallUrl,
          cachedWall,
          "wall",
          ui.wallStyle,
          planeSurfaceOpts(shellW, room.ceilingY, cachedWall, wallRepeat),
        );
        if (sidePbr) applyCustomPbr(sideWallMat, sidePbr);
        if (backPbr) applyCustomPbr(backWallMat, backPbr);
      }
    }

    const customCeilUrl = ui.ceilingImageUrl.trim();
    if (customCeilUrl) {
      const ceilRepeat = ui.ceilingImageRepeat;
      const applyCeilImg = (img: HTMLImageElement) => {
        if (disposed || buildToken !== interiorBuildToken) return;
        const ceilPbr = createCustomSurfaceTextures(
          customCeilUrl,
          img,
          "ceiling",
          ui.ceilingStyle,
          planeSurfaceOpts(shellW, shellD, img, ceilRepeat),
        );
        if (ceilPbr) applyCustomPbr(ceilMat, ceilPbr);
        requestRender();
      };
      const cachedCeil = loadSurfaceImage(customCeilUrl, applyCeilImg);
      if (cachedCeil) {
        const ceilPbr = createCustomSurfaceTextures(
          customCeilUrl,
          cachedCeil,
          "ceiling",
          ui.ceilingStyle,
          planeSurfaceOpts(shellW, shellD, cachedCeil, ceilRepeat),
        );
        if (ceilPbr) applyCustomPbr(ceilMat, ceilPbr);
      }
    }

    const firstRowFloorZ = room.rowFloors.length > 0 ? room.rowFloors[0].z : Math.max(1.5, room.frontWallZ + 1.5);
    const lastRowFloorZ =
      room.rowFloors.length > 0 ? room.rowFloors[room.rowFloors.length - 1].z : Math.max(firstRowFloorZ + 1, room.backWallZ - 1);
    const rakedFloorYAtZ = (z: number) => {
      if (z <= firstRowFloorZ || lastRowFloorZ <= firstRowFloorZ) return 0;
      const t = Math.min(1, Math.max(0, (z - firstRowFloorZ) / (lastRowFloorZ - firstRowFloorZ)));
      return t * room.maxFloorY;
    };

    // Subdivided enclosure planes with baked architectural corner, baseboard & cornice AO
    const leftWallGeom = trackInterior(
      bakeWallAO(new PlaneGeometry(shellD, room.ceilingY, 16, 10), shellD, room.ceilingY, (lx) =>
        rakedFloorYAtZ(shellCenterZ - lx),
      ),
    );
    const leftWall = new Mesh(leftWallGeom, sideWallMat);
    leftWall.position.set(-leftMargin, room.ceilingY / 2, shellCenterZ);
    leftWall.rotation.y = Math.PI / 2;
    interiorGroup.add(leftWall);

    const rightWallGeom = trackInterior(
      bakeWallAO(new PlaneGeometry(shellD, room.ceilingY, 16, 10), shellD, room.ceilingY, (lx) =>
        rakedFloorYAtZ(shellCenterZ + lx),
      ),
    );
    const rightWall = new Mesh(rightWallGeom, sideWallMat);
    rightWall.position.set(room.widthM + rightMargin, room.ceilingY / 2, shellCenterZ);
    rightWall.rotation.y = -Math.PI / 2;
    interiorGroup.add(rightWall);

    const frontWallGeom = trackInterior(new PlaneGeometry(shellW, room.ceilingY));
    const frontWall = new Mesh(frontWallGeom, frontWallMat);
    frontWall.position.set(shellCenterX, room.ceilingY / 2, room.frontWallZ);
    interiorGroup.add(frontWall);

    const backWallGeom = trackInterior(
      bakeWallAO(new PlaneGeometry(shellW, room.ceilingY, 16, 10), shellW, room.ceilingY, () => room.maxFloorY),
    );
    const backWall = new Mesh(backWallGeom, backWallMat);
    backWall.position.set(shellCenterX, room.ceilingY / 2, room.backWallZ);
    backWall.rotation.y = Math.PI;
    interiorGroup.add(backWall);

    const ceilingGeom = trackInterior(
      bakeCeilingAO(new PlaneGeometry(shellW, shellD, 14, 14), shellW, shellD),
    );
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

    // Recessed ceiling HVAC air diffusers & 4 architectural corner acoustic bass-trap columns
    if (ui.ceilingDetailsVisible) {
      interiorGroup.add(buildCeilingAndCornerDetails(room, leftMargin, rightMargin, trackInterior));
    }

    // Industrial 4DX wall wind-effect blowers & strobe pods (auto-mounted in rooms with 4DX seats)
    if (ui.fourDxWallPropsVisible) {
      const fourDxProps = build4dxWallProps(room, leftMargin, rightMargin, trackInterior);
      if (fourDxProps) interiorGroup.add(fourDxProps);
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

    // Volumetric cinema projector beam (dual-shell concentric squircle frustum + xenon lens hotspot, 2 draw calls)
    if (ui.projectorBeamVisible) {
      const lensVec = new Vector3(room.projectionPort.x, room.projectionPort.y, room.projectionPort.z - 0.085);
      const screenCenterVec = new Vector3(room.screen.centreX, room.screen.centerY, room.screen.centerZ + 0.05);
      const beamLength = lensVec.distanceTo(screenCenterVec);

      const buildBeamShell = (scale: number): BufferGeometry => {
        const g = new CylinderGeometry(1, 1, beamLength, 36, 1, true);
        const posAttr = g.attributes.position;
        const endRx = room.screen.width * 0.46 * scale;
        const endRz = room.screen.height * 0.46 * scale;
        const startRx = 0.14 * scale;
        const startRz = 0.08 * scale;
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vy = posAttr.getY(i);
          const vz = posAttr.getZ(i);
          const t = (vy + beamLength * 0.5) / beamLength;
          // Soft squircle cross-section matching the rectangular screen frame without hard corner seams
          const sx = Math.sign(vx) * Math.pow(Math.abs(vx), 0.78);
          const sz = Math.sign(vz) * Math.pow(Math.abs(vz), 0.78);
          const rx = startRx + (endRx - startRx) * t;
          const rz = startRz + (endRz - startRz) * t;
          posAttr.setXYZ(i, sx * rx, vy, sz * rz);
        }
        posAttr.needsUpdate = true;
        g.computeVertexNormals();
        return g;
      };

      const outerShell = buildBeamShell(1.0);
      const innerShell = buildBeamShell(0.58);
      const beamGeom = mergeGeometries([outerShell, innerShell], false);
      outerShell.dispose();
      innerShell.dispose();

      const beamAxis = new Vector3().subVectors(screenCenterVec, lensVec).normalize();
      const upRef = new Vector3(0, 1, 0);
      const beamX = new Vector3().crossVectors(beamAxis, upRef).normalize();
      const beamZ = new Vector3().crossVectors(beamX, beamAxis).normalize();
      const beamBasis = new Matrix4().makeBasis(beamX, beamAxis, beamZ);

      beamOpacityUniform = { value: 0.16 };
      beamColorUniform = { value: beamBaseColor.clone().lerp(screenTintColor, 0.28) };
      const beamMat = trackInterior(
        new ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
          blending: AdditiveBlending,
          uniforms: {
            uOpacity: beamOpacityUniform,
            uColor: beamColorUniform,
            uBeamAxis: { value: beamAxis.clone() },
            uNearFade: { value: ui.projectionPortVisible ? 0.04 : 0.18 },
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
        uniform vec3 uBeamAxis;
        uniform float uNearFade;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float ndv = abs(dot(normalize(vWorldNormal), viewDir));
          // Normalize silhouette rolloff against view-axis foreshortening so the beam stays
          // visible from the rear overview camera while still feathering smoothly to 0 at edges.
          float alongAxis = abs(dot(viewDir, uBeamAxis));
          float maxNdv = max(0.2, sqrt(max(0.0, 1.0 - alongAxis * alongAxis)));
          float edgeFade = pow(clamp(ndv / maxNdv, 0.0, 1.0), 1.85);
          float density = mix(1.65, 0.42, pow(vUv.y, 0.72));
          float ends = smoothstep(0.0, uNearFade, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
          float angle = vUv.x * 6.2831853;
          float rays = 0.76 + 0.24 * sin(angle * 7.0 + vUv.y * 2.5) * cos(angle * 11.0 - 0.8);
          float alpha = clamp(edgeFade * density * ends * rays * uOpacity, 0.0, 0.48);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
        }),
      );
      if (beamGeom) {
        trackInterior(beamGeom);
        const beamMesh = new Mesh(beamGeom, beamMat);
        beamMesh.position.copy(lensVec).add(screenCenterVec).multiplyScalar(0.5);
        beamMesh.quaternion.setFromRotationMatrix(beamBasis);
        beamMesh.frustumCulled = false;
        beamMesh.renderOrder = 8;
        interiorGroup.add(beamMesh);
      }

      // Soft xenon projector lens hotspot at the rear booth window (shown only when the booth window itself is visible)
      if (ui.projectionPortVisible) {
        const lensFlareGeom = trackInterior(new PlaneGeometry(0.56, 0.42));
        const lensFlareMat = trackInterior(
          new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            uniforms: {
              uOpacity: beamOpacityUniform,
              uColor: { value: new Color(0xdceaff) },
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float core = exp(-r * r * 9.0);
          float halo = exp(-r * r * 2.4) * 0.45;
          float alpha = clamp((core + halo) * min(1.0, uOpacity * 5.8), 0.0, 0.92);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
          }),
        );
        const lensFlareMesh = new Mesh(lensFlareGeom, lensFlareMat);
        lensFlareMesh.position.copy(lensVec);
        lensFlareMesh.rotation.y = Math.PI;
        lensFlareMesh.renderOrder = 9;
        interiorGroup.add(lensFlareMesh);
      }
    }

    // Luminous LED step-nosing strips + realistic soft carpet light spill along open vertical & side aisles
    if (ui.aisleLedVisible && room.aisleLights.length > 0) {
      const ledHex = AISLE_LED_HEX[ui.aisleLedColor] ?? AISLE_LED_HEX.amber;
      const aisleLedMat = trackInterior(new MeshBasicMaterial({ color: ledHex, toneMapped: false }));
      const stripGeom = trackInterior(new BoxGeometry(1, 0.02, 0.028));
      const stripMesh = trackInterior(new InstancedMesh(stripGeom, aisleLedMat, room.aisleLights.length));

      const spillTex = createAisleLedSpillTexture();
      if (spillTex) trackInterior(spillTex);
      aisleLedSpillMat = spillTex
        ? trackInterior(
            new MeshBasicMaterial({
              color: ledHex,
              map: spillTex,
              transparent: true,
              opacity: 0.24,
              blending: AdditiveBlending,
              depthWrite: false,
              toneMapped: false,
            }),
          )
        : null;
      const spillGeom = aisleLedSpillMat ? trackInterior(new PlaneGeometry(1, 1)) : null;
      if (spillGeom) spillGeom.rotateX(-Math.PI / 2);
      const spillMesh =
        aisleLedSpillMat && spillGeom
          ? trackInterior(new InstancedMesh(spillGeom, aisleLedSpillMat, room.aisleLights.length))
          : null;

      room.aisleLights.forEach((light, i) => {
        tmpMat.compose(
          tmpPos.set(light.x, light.y + 0.011, light.z),
          tmpQuat.identity(),
          tmpScale.set(light.widthM, 1, 1),
        );
        stripMesh.setMatrixAt(i, tmpMat);
        if (spillMesh) {
          tmpMat.compose(
            tmpPos.set(light.x, light.y + 0.008, light.z + 0.09),
            tmpQuat.identity(),
            tmpScale.set(light.widthM * 1.38, 1, 0.26),
          );
          spillMesh.setMatrixAt(i, tmpMat);
        }
      });
      stripMesh.instanceMatrix.needsUpdate = true;
      interiorGroup.add(stripMesh);
      if (spillMesh) {
        spillMesh.instanceMatrix.needsUpdate = true;
        interiorGroup.add(spillMesh);
      }
    }

    // Matte-black sloped handrails along stepped vertical & side aisles (never behind horizontal cross-aisles)
    if (ui.aisleHandrailsVisible) {
      const ledHex = AISLE_LED_HEX[ui.aisleLedColor] ?? AISLE_LED_HEX.amber;
      const handrails = buildAisleHandrails(room, leftMargin, rightMargin, ui.aisleLedVisible, ledHex, trackInterior);
      if (handrails) interiorGroup.add(handrails);
    }

    // Illuminated Row Letter Markers (`A, B, C...`) on step treads, step risers, aisles, or side walls (2 draw calls total)
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
      const rowFloorByIdx = new Map(room.rowFloors.map((f) => [f.rowIndex, f]));
      const atlas = createRowMarkerAtlas(
        rows.map((r) => r.row),
        ui.rowMarkersColor,
      );

      if (atlas) {
        trackInterior(atlas.texture);
        const faceGeoms: BufferGeometry[] = [];
        const plaqueMats: Matrix4[] = [];
        const placement = ui.rowMarkersPlacement;
        const leftWallQuat = new Quaternion().setFromAxisAngle(yAxis, Math.PI / 2);
        const rightWallQuat = new Quaternion().setFromAxisAngle(yAxis, -Math.PI / 2);
        const aisleTiltQuat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.38);
        const stepTreadQuat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
        const stepRiserQuat = new Quaternion().setFromAxisAngle(yAxis, Math.PI);
        const faceOffset = new Vector3();
        const postPositions: Vector3[] = [];

        const pushMarker = (
          rowSlot: number,
          pos: Vector3,
          quat: Quaternion,
          size: number,
          bezelDepth: number,
          bezelPad = 0.025,
        ) => {
          const gx = rowSlot % atlas.cols;
          const gy = Math.floor(rowSlot / atlas.cols);
          const u0 = gx / atlas.cols;
          const u1 = (gx + 1) / atlas.cols;
          const v1 = 1 - gy / atlas.gridRows;
          const v0 = 1 - (gy + 1) / atlas.gridRows;

          const plane = new PlaneGeometry(size, size);
          const uv = plane.attributes.uv;
          for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
          }
          faceOffset.set(0, 0, bezelDepth / 2 + 0.0018).applyQuaternion(quat);
          tmpMat.compose(tmpPos.copy(pos).add(faceOffset), quat, tmpScale.set(1, 1, 1));
          plane.applyMatrix4(tmpMat);
          faceGeoms.push(plane);

          const m = new Matrix4().compose(
            pos,
            quat,
            new Vector3(size + bezelPad, size + bezelPad, bezelDepth),
          );
          plaqueMats.push(m);
        };

        const roomMidX = room.widthM / 2;
        rows.forEach((r, slot) => {
          if (placement === "wall") {
            const leftBlocked = room.entrances.some((e) => e.side === "left" && Math.abs(e.z - r.z) < 0.95);
            const rightBlocked = room.entrances.some((e) => e.side === "right" && Math.abs(e.z - r.z) < 0.95);
            const markerY = Math.min(room.ceilingY - 0.5, r.floorY + 1.24);
            if (!leftBlocked) {
              pushMarker(slot, new Vector3(-leftMargin + 0.022, markerY, r.z), leftWallQuat, 0.26, 0.022);
            }
            if (!rightBlocked) {
              pushMarker(slot, new Vector3(room.widthM + rightMargin - 0.022, markerY, r.z), rightWallQuat, 0.26, 0.022);
            }
            return;
          }

          if (placement === "step" || placement === "riser") {
            // Inlaid Gradus-style step tread tiles or backlit vertical step-riser badges on every open walkway
            const rf = rowFloorByIdx.get(r.rowIndex);
            const zFront = (rf?.z ?? r.z) - room.rowPitchM / 2;
            const prevFloor = rowFloorByIdx.get(r.rowIndex - 1);
            const prevH = prevFloor ? prevFloor.height : 0;

            for (const wx of room.aisleLightXs) {
              const filled = r.seats.some((s) => Math.abs(s.x - wx) < room.seatPitchM * (s.span * 0.5 + 0.35));
              if (filled) continue;

              if (placement === "step") {
                pushMarker(
                  slot,
                  new Vector3(wx, r.floorY + 0.0045, zFront + 0.2),
                  stepTreadQuat,
                  0.21,
                  0.008,
                  0.026,
                );
                continue;
              }

              // Riser mode: mount on the exposed upper vertical riser right below the main row step nosing
              let stepBaseY = prevH;
              for (const st of room.aisleSteps) {
                if (Math.abs(st.x - wx) < 0.25 && Math.abs(st.z + st.depthM / 2 - zFront) < 0.08) {
                  const stTop = st.y + st.heightM / 2;
                  if (stTop < r.floorY - 0.04 && stTop > stepBaseY) stepBaseY = stTop;
                }
              }
              const exposedRise = r.floorY - stepBaseY;
              if (exposedRise >= 0.08) {
                const riserSize = Math.min(0.14, Math.max(0.095, exposedRise * 0.72));
                pushMarker(
                  slot,
                  new Vector3(wx, r.floorY - exposedRise / 2, zFront - 0.0045),
                  stepRiserQuat,
                  riserSize,
                  0.008,
                  0.018,
                );
              } else {
                // Flat front rows without a step rise fall back cleanly to a flush floor indicator
                pushMarker(
                  slot,
                  new Vector3(wx, r.floorY + 0.0045, zFront + 0.2),
                  stepTreadQuat,
                  0.18,
                  0.008,
                  0.024,
                );
              }
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
            pushMarker(slot, new Vector3(mx, r.floorY + 0.54, r.z + 0.14), aisleTiltQuat, 0.22, 0.022);
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
          const plaqueGeom = trackInterior(new BoxGeometry(1, 1, 1));
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

    // Backlit seat number plates on upper rear chair shells (1 draw call across the room)
    if (ui.seatNumbersVisible && room.seats.length > 0) {
      const seatNumMesh = buildSeatNumberMesh(room.seats, room, trackInterior);
      if (seatNumMesh) interiorGroup.add(seatNumMesh);
    }

    // Deep matte-carpeted cinema stage platform (no shiny chalk-tray ledge), under-lip LED & screen reflection pool
    const firstRowZ = room.rowFloors[0]?.z ?? Math.max(2.5, room.depthM * 0.3);
    const apronH = ui.screenStageApron ? Math.min(0.22, Math.max(0.11, room.screen.bottom * 0.2)) : 0;
    const apronD = Math.min(
      Math.max(0.85, firstRowZ - room.frontWallZ - 0.85),
      Math.max(1.08, -room.frontWallZ + 0.86),
    );
    const reflectTex = createStageReflectTexture();
    if (reflectTex) trackInterior(reflectTex);

    if (ui.screenStageApron) {
      const toeH = apronH * 0.34;
      const deckH = apronH - toeH;
      const toeRecess = 0.06;
      const frontEdgeZ = room.frontWallZ + apronD;

      // Recessed jet-black toe-kick plinth underneath stage overhang
      const plinthGeom = trackInterior(new BoxGeometry(shellW - 0.04, toeH, Math.max(0.35, apronD - toeRecess)));
      const plinthMat = trackInterior(new MeshStandardMaterial({ color: 0x040407, roughness: 0.98, metalness: 0.01 }));
      const plinthMesh = new Mesh(plinthGeom, plinthMat);
      plinthMesh.position.set(shellCenterX, toeH / 2, room.frontWallZ + (apronD - toeRecess) / 2);
      interiorGroup.add(plinthMesh);

      // Deep matte dark-carpeted cinema stage deck (grounded, low-reflection, never a bright shelf)
      const deckGeom = trackInterior(new BoxGeometry(shellW - 0.04, deckH, apronD));
      const deckMat = trackInterior(new MeshStandardMaterial({ color: 0x08080e, roughness: 0.96, metalness: 0.01 }));
      const deckMesh = new Mesh(deckGeom, deckMat);
      deckMesh.position.set(shellCenterX, toeH + deckH / 2, room.frontWallZ + apronD / 2);
      interiorGroup.add(deckMesh);

      // Soft additive screen light reflection pool washing across the stage deck below the screen
      stageReflectMat = trackInterior(
        new MeshBasicMaterial({
          color: screenTintColor.clone(),
          map: reflectTex,
          transparent: true,
          opacity: 0.18,
          blending: AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      const reflectW = Math.min(shellW - 0.14, room.screen.width * 1.18);
      const reflectMesh = new Mesh(trackInterior(new PlaneGeometry(reflectW, apronD * 0.94)), stageReflectMat);
      reflectMesh.rotation.x = -Math.PI / 2;
      reflectMesh.position.set(room.screen.centreX, apronH + 0.004, room.frontWallZ + apronD * 0.5);
      interiorGroup.add(reflectMesh);

      if (ui.screenStageLed) {
        const ledW = Math.min(shellW - 0.4, room.screen.width * 1.04);
        const stageLedGeom = trackInterior(new BoxGeometry(ledW, 0.012, 0.014));
        stageLedMat = trackInterior(new MeshBasicMaterial({ color: 0x9c6d42, toneMapped: false }));
        const stageLed = new Mesh(stageLedGeom, stageLedMat);
        // Tucked discreetly underneath the stage overhang inside the toe-kick recess
        stageLed.position.set(room.screen.centreX, toeH - 0.006, frontEdgeZ - toeRecess + 0.01);
        interiorGroup.add(stageLed);

        const washTex = createStageLedWashTexture();
        if (washTex) trackInterior(washTex);
        stageLedWashMat = trackInterior(
          new MeshBasicMaterial({
            map: washTex,
            transparent: true,
            opacity: 0.28,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        const washMesh = new Mesh(trackInterior(new PlaneGeometry(ledW * 1.04, 0.44)), stageLedWashMat);
        washMesh.rotation.x = -Math.PI / 2;
        washMesh.position.set(room.screen.centreX, 0.009, frontEdgeZ + 0.18);
        interiorGroup.add(washMesh);
      }
    }

    // Soft cinema screen light spill washing across the front ceiling directly above the screen
    if (reflectTex) {
      const ceilSpillD = Math.min(3.4, Math.max(1.5, shellD * 0.28));
      const ceilSpillW = Math.min(shellW - 0.16, room.screen.width * 1.24);
      ceilingReflectMat = trackInterior(
        new MeshBasicMaterial({
          color: screenTintColor.clone(),
          map: reflectTex,
          transparent: true,
          opacity: 0.16,
          blending: AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      const ceilSpillMesh = new Mesh(trackInterior(new PlaneGeometry(ceilSpillW, ceilSpillD)), ceilingReflectMat);
      ceilSpillMesh.rotation.x = Math.PI / 2;
      ceilSpillMesh.position.set(room.screen.centreX, room.ceilingY - 0.014, room.frontWallZ + ceilSpillD * 0.5);
      interiorGroup.add(ceilSpillMesh);

      // Subtle ScreenX-inspired screen bounce glow washing across the front portion of the left & right side walls
      if (ui.screenWallWash) {
        const wallSpillD = Math.min(5.2, Math.max(2.2, shellD * 0.42));
        const wallSpillH = Math.min(room.ceilingY - 0.16, room.screen.height * 1.56);
        sideWallReflectMat = trackInterior(
          new MeshBasicMaterial({
            color: screenTintColor.clone(),
            map: reflectTex,
            transparent: true,
            opacity: 0.18,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        const wallSpillGeom = trackInterior(new PlaneGeometry(wallSpillD, wallSpillH));
        const leftWallSpill = new Mesh(wallSpillGeom, sideWallReflectMat);
        leftWallSpill.position.set(-leftMargin + 0.012, room.screen.centerY, room.frontWallZ + wallSpillD * 0.48);
        leftWallSpill.rotation.y = Math.PI / 2;
        const rightWallSpill = new Mesh(wallSpillGeom, sideWallReflectMat);
        rightWallSpill.position.set(room.widthM + rightMargin - 0.012, room.screen.centerY, room.frontWallZ + wallSpillD * 0.48);
        rightWallSpill.rotation.y = -Math.PI / 2;
        interiorGroup.add(leftWallSpill, rightWallSpill);
      }
    }

    // Commercial cinema Proscenium architecture: matte-black acoustic baffle skirt below screen, upper masking fascia,
    // and front side-wall light-trap wings so the screen reads as a recessed theater stage (never a wall-hung whiteboard)
    const borderPad = ui.screenBorder === "velvet" ? 0.4 : ui.screenBorder === "slim" ? 0.11 : 0.024;
    const frameW = room.screen.width + borderPad;
    const frameH = room.screen.height + borderPad;
    const prosceniumBlackMat = trackInterior(
      new MeshStandardMaterial({ color: 0x030305, roughness: 0.99, metalness: 0.0 }),
    );
    const baffleZ = Math.min(room.screen.bottomZ, room.screen.centerZ) - 0.045;
    const baffleDepth = Math.max(0.06, baffleZ - room.frontWallZ);
    const baffleFrontZ = room.frontWallZ + baffleDepth;

    // Soft rectangular feathered light spill resting cleanly in front of the matte-black proscenium baffle
    if (ui.screenHalo) {
      const haloTex = createScreenHaloTexture();
      if (haloTex) trackInterior(haloTex);
      const haloGeom = trackInterior(new PlaneGeometry(room.screen.width * 1.38, room.screen.height * 1.48));
      haloMat = trackInterior(
        new MeshBasicMaterial({
          color: screenTintColor.clone(),
          map: haloTex,
          transparent: true,
          opacity: 0.34,
          blending: AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      const haloMesh = new Mesh(haloGeom, haloMat);
      haloMesh.position.set(room.screen.centreX, room.screen.centerY, baffleFrontZ + 0.012);
      interiorGroup.add(haloMesh);
    }

    // Lower acoustic subwoofer baffle skirt connecting screen bottom seamlessly down to stage deck
    const screenLowerY = room.screen.centerY - (frameH / 2) * Math.cos(screenTiltRad);
    const skirtH = screenLowerY - apronH;
    if (skirtH > 0.08) {
      const skirtMesh = new Mesh(
        trackInterior(new BoxGeometry(shellW - 0.04, skirtH + 0.03, baffleDepth)),
        prosceniumBlackMat,
      );
      skirtMesh.position.set(shellCenterX, apronH + skirtH / 2, room.frontWallZ + baffleDepth / 2);
      interiorGroup.add(skirtMesh);
    }

    // Commercial subwoofer enclosures recessed along front stage apron
    if (ui.screenStageApron && ui.stageSubwoofersVisible) {
      const subs = buildStageSubwoofers(room, apronH, baffleFrontZ, trackInterior);
      if (subs) interiorGroup.add(subs);
    }

    // Upper proscenium masking fascia bridging from top of screen frame up to ceiling
    const screenUpperY = room.screen.centerY + (frameH / 2) * Math.cos(screenTiltRad);
    const upperMaskH = room.ceilingY - screenUpperY;
    if (upperMaskH > 0.08) {
      const fasciaMesh = new Mesh(
        trackInterior(new BoxGeometry(shellW - 0.04, upperMaskH + 0.03, baffleDepth)),
        prosceniumBlackMat,
      );
      fasciaMesh.position.set(shellCenterX, screenUpperY + upperMaskH / 2, room.frontWallZ + baffleDepth / 2);
      interiorGroup.add(fasciaMesh);
    }

    // Matte-black proscenium side light-trap return wings shielding the screen zone from bright side wall textures
    const wingDepth = Math.min(0.62, Math.max(0.32, apronD * 0.56));
    const wingH = Math.max(0.5, room.ceilingY - apronH);
    const wingGeom = trackInterior(new PlaneGeometry(wingDepth, wingH));
    const leftWing = new Mesh(wingGeom, prosceniumBlackMat);
    leftWing.rotation.y = Math.PI / 2;
    leftWing.position.set(-leftMargin + 0.014, apronH + wingH / 2, room.frontWallZ + wingDepth / 2);
    const rightWing = new Mesh(wingGeom, prosceniumBlackMat);
    rightWing.rotation.y = -Math.PI / 2;
    rightWing.position.set(room.widthM + rightMargin - 0.014, apronH + wingH / 2, room.frontWallZ + wingDepth / 2);
    interiorGroup.add(leftWing, rightWing);

    // Proscenium pleated velvet curtains with organic fold depth variation, per-fold shading & animated open/close wings
    if (ui.screenCurtainsVisible) {
      const curtainBottomY = apronH;
      const curtainH = Math.max(0.6, room.ceilingY - curtainBottomY);
      const curtainCenterY = curtainBottomY + curtainH / 2;
      const curtainZ = Math.max(room.frontWallZ + 0.13, baffleFrontZ + 0.06);
      const curtainHex = parseHexOrRgb(ui.screenCurtainsColor) ?? 0x2b0c14;
      const curtainBaseColor = new Color(curtainHex);
      const curtainMat = trackInterior(
        new MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0.01 }),
      );
      const curtainBackMat = trackInterior(
        new MeshStandardMaterial({
          color: curtainBaseColor.clone().multiplyScalar(0.46),
          roughness: 0.98,
          metalness: 0.0,
        }),
      );

      const leftStart = -leftMargin + 0.03;
      const leftEnd = room.screen.centreX - frameW / 2 + 0.06;
      const rightStart = room.screen.centreX + frameW / 2 - 0.06;
      const rightEnd = room.widthM + rightMargin - 0.03;
      const pleatGeom = trackInterior(new CylinderGeometry(0.098, 0.116, curtainH, 12));
      const foldColor = new Color();
      const extraDraw = Math.min(room.screen.width * 0.14, 1.35);

      const buildWing = (pivotX: number, edgeX: number, dir: 1 | -1): { wing: Group; closedScale: number } | null => {
        const span = Math.abs(edgeX - pivotX);
        if (span <= 0.16) return null;
        const wing = new Group();
        wing.position.set(pivotX, 0, 0);

        const backPlane = new Mesh(trackInterior(new PlaneGeometry(span, curtainH)), curtainBackMat);
        backPlane.position.set(dir * (span / 2), curtainCenterY, curtainZ - 0.08);
        wing.add(backPlane);

        const count = Math.max(3, Math.min(20, Math.round(span / 0.17)));
        const pleatMesh = trackInterior(new InstancedMesh(pleatGeom, curtainMat, count));
        for (let p = 0; p < count; p++) {
          const t = (p + 0.5) / count;
          const wave = Math.sin(p * 2.15 + span * 1.7);
          const localX = dir * (t * span) + wave * 0.014;
          const isCrest = p % 2 === 0;
          const pz = curtainZ + (isCrest ? 0.032 + wave * 0.01 : -0.022 + wave * 0.008);
          const sx = (isCrest ? 1.06 : 0.9) + wave * 0.08;
          const sz = (isCrest ? 1.28 : 1.04) + Math.cos(p * 1.7) * 0.1;
          const shade = isCrest ? 1.08 + wave * 0.06 : 0.72 + wave * 0.05;
          tmpMat.compose(tmpPos.set(localX, curtainCenterY, pz), tmpQuat.identity(), tmpScale.set(sx, 1, sz));
          pleatMesh.setMatrixAt(p, tmpMat);
          foldColor.copy(curtainBaseColor).multiplyScalar(shade);
          pleatMesh.setColorAt(p, foldColor);
        }
        pleatMesh.instanceMatrix.needsUpdate = true;
        if (pleatMesh.instanceColor) pleatMesh.instanceColor.needsUpdate = true;
        wing.add(pleatMesh);
        interiorGroup.add(wing);
        return { wing, closedScale: Math.min(2.2, 1 + extraDraw / span) };
      };

      const builtLeft = buildWing(leftStart, leftEnd, 1);
      if (builtLeft) {
        leftCurtainWing = builtLeft.wing;
        leftCurtainClosedScale = builtLeft.closedScale;
      }
      const builtRight = buildWing(rightEnd, rightStart, -1);
      if (builtRight) {
        rightCurtainWing = builtRight.wing;
        rightCurtainClosedScale = builtRight.closedScale;
      }
      applyCurtainOpen(curtainOpen);

      if (builtLeft || builtRight) {
        // Sleek matte-black ceiling curtain track rail
        const trackRailMat = trackInterior(new MeshStandardMaterial({ color: 0x09090e, roughness: 0.75, metalness: 0.18 }));
        const trackRail = new Mesh(trackInterior(new BoxGeometry(shellW - 0.06, 0.04, 0.075)), trackRailMat);
        trackRail.position.set(shellCenterX, room.ceilingY - 0.022, curtainZ + 0.01);
        interiorGroup.add(trackRail);
      }

      // Optional upper proscenium pelmet valance when clear space exists above the screen frame
      const topGap = room.ceilingY - (room.screen.centerY + frameH / 2);
      if (topGap >= 0.28) {
        const pelmetH = Math.min(0.32, topGap * 0.72);
        const pelmetMat = trackInterior(new MeshStandardMaterial({ color: curtainHex, roughness: 0.96, metalness: 0.01 }));
        const pelmet = new Mesh(
          trackInterior(new BoxGeometry(shellW - 0.06, pelmetH, 0.22)),
          pelmetMat,
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
    const housingMat = trackInterior(new MeshStandardMaterial({ color: 0x030306, roughness: 0.98, metalness: 0.0 }));
    const housingMesh = new Mesh(housingGeom, housingMat);
    housingMesh.position.set(room.screen.centreX, 0, 0);
    interiorGroup.add(housingMesh);

    const screenGroup = new Group();
    screenGroup.position.set(room.screen.centreX, room.screen.centerY, room.screen.centerZ);
    screenGroup.rotation.x = screenTiltRad;

    // Flush light-absorbing matte-black masking frame seamlessly integrated into the dark proscenium
    const frameGeom = trackInterior(
      buildScreenFrameGeometry(room.screen.width, room.screen.height, ui.screenBorder, room.screen.curveDepth),
    );
    const frameMat = trackInterior(
      ui.screenBorder === "slim"
        ? new MeshStandardMaterial({ color: 0x050508, roughness: 0.88, metalness: 0.08, vertexColors: true })
        : ui.screenBorder === "frameless"
          ? new MeshStandardMaterial({ color: 0x030306, roughness: 0.95, metalness: 0.02, vertexColors: true })
          : new MeshStandardMaterial({ color: 0x020204, roughness: 0.99, metalness: 0.0, vertexColors: true }),
    );
    const frameMesh = new Mesh(frameGeom, frameMat);
    frameMesh.renderOrder = 1;
    screenGroup.add(frameMesh);

    const screenAspect = room.screen.width / Math.max(0.1, room.screen.height);
    const screenGeom = trackInterior(buildScreenGeometry(room.screen.width, room.screen.height, room.screen.curveDepth));
    const effectiveSubtitle = ui.screenSubtitleText.trim() || options.subtitleText || "Sample subtitle · Phụ đề mẫu";
    const youtubeId = ui.screenSource === "youtube" ? parseYoutubeId(ui.screenYoutubeUrl) : null;
    let screenMat: MeshBasicMaterial | ShaderMaterial;

    if (youtubeId) {
      syncYoutubeLayer(youtubeId);
      applyScreenTint(new Color(0xc8dcf8));
      // Depth-tested alpha cutout: punches a transparent window through frontWall/shroud while 3D bevel frame, chairs & audience occlude the video.
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
      const initialResult =
        (cachedImg
          ? createCustomImageScreenTexture(cachedImg, screenAspect, ui.screenShowSubtitle, effectiveSubtitle, ui.screenSubtitleColor)
          : null) ??
        createScreenTexture(
          ui.screenContent,
          screenAspect,
          ui.screenShowSubtitle,
          effectiveSubtitle,
          ui.screenSubtitleColor,
        );
      if (initialResult) {
        trackInterior(initialResult.texture);
        applyScreenTint(initialResult.tint);
        const projMat = trackInterior(
          createProjectionScreenMaterial(
            initialResult.texture,
            room.screen.width,
            room.screen.height,
            ui.screenBorder,
            lightsLevel,
          ),
        );
        screenLightsUniform = projMat.uniforms.uLightsLevel as { value: number };
        screenMat = projMat;
      } else {
        applyScreenTint(new Color(0xc4dcff));
        screenMat = trackInterior(new MeshBasicMaterial({ color: 0xe8e0ff, toneMapped: false }));
      }

      if (customImageUrl && !cachedImg) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onload = () => {
          if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
          putLoadedImageCache(customImageUrl, img);
          if (disposed || buildToken !== interiorBuildToken) return;
          const customRes = createCustomImageScreenTexture(
            img,
            screenAspect,
            ui.screenShowSubtitle,
            effectiveSubtitle,
            ui.screenSubtitleColor,
          );
          if (!customRes) return;
          trackInterior(customRes.texture);
          applyScreenTint(customRes.tint);
          if ("uniforms" in screenMat && screenMat.uniforms.uMap) {
            const prevMap = screenMat.uniforms.uMap.value as CanvasTexture | null;
            screenMat.uniforms.uMap.value = customRes.texture;
            prevMap?.dispose();
          } else if ("map" in screenMat) {
            const prevMap = screenMat.map;
            screenMat.map = customRes.texture;
            screenMat.needsUpdate = true;
            prevMap?.dispose();
          }
          requestRender();
        };
        img.src = customImageUrl;
      }
    }
    const screenMesh = new Mesh(screenGeom, screenMat);
    screenMesh.renderOrder = 0;
    screenGroup.add(screenMesh);

    // Motorized cinema velvet screen masking bars (letterbox 2.39:1 or pillarbox 1.85:1 simulation)
    if (ui.screenMasking !== "none") {
      const targetAspect = ui.screenMasking === "scope" ? 2.39 : 1.85;
      const maskMat = trackInterior(new MeshStandardMaterial({ color: 0x020204, roughness: 0.99, metalness: 0.0 }));
      if (targetAspect > screenAspect * 1.03) {
        const visH = room.screen.width / targetAspect;
        const barH = Math.max(0.05, (room.screen.height - visH) / 2);
        const barGeom = trackInterior(new BoxGeometry(room.screen.width + 0.04, barH, 0.028));
        const topBar = new Mesh(barGeom, maskMat);
        topBar.position.set(0, room.screen.height / 2 - barH / 2, 0.018);
        topBar.renderOrder = 2;
        const botBar = new Mesh(barGeom, maskMat);
        botBar.position.set(0, -room.screen.height / 2 + barH / 2, 0.018);
        botBar.renderOrder = 2;
        screenGroup.add(topBar, botBar);
      } else if (targetAspect < screenAspect * 0.97) {
        const visW = room.screen.height * targetAspect;
        const barW = Math.max(0.05, (room.screen.width - visW) / 2);
        const barGeom = trackInterior(new BoxGeometry(barW, room.screen.height + 0.04, 0.028));
        const leftBar = new Mesh(barGeom, maskMat);
        leftBar.position.set(-room.screen.width / 2 + barW / 2, 0, 0.018);
        leftBar.renderOrder = 2;
        const rightBar = new Mesh(barGeom, maskMat);
        rightBar.position.set(room.screen.width / 2 - barW / 2, 0, 0.018);
        rightBar.renderOrder = 2;
        screenGroup.add(leftBar, rightBar);
      }
    }

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

        if (ui.emergencyLightsVisible) {
          const emY = Math.min(room.ceilingY - e.floorY - 0.14, doorH + (ui.exitSignVisible ? 0.52 : 0.24));
          if (emY > doorH + 0.08) {
            const emUnit = buildEmergencyLightUnit(trackInterior);
            emUnit.position.set(0.02, emY, 0);
            group.add(emUnit);
          }
        }

        if (ui.roomSignVisible) {
          const roomSignTex = createRoomSignTexture(
            options.roomMeta?.roomName || "ROOM 01",
            options.roomMeta?.brandName,
          );
          if (roomSignTex) {
            trackInterior(roomSignTex);
            const plaqueZ = e.position === "front" ? doorW / 2 + 0.34 : -(doorW / 2 + 0.34);
            const plaqueFrame = new Mesh(
              trackInterior(new BoxGeometry(0.03, 0.18, 0.44)),
              doorFrameMat,
            );
            plaqueFrame.position.set(0.015, 1.56, plaqueZ);
            const plaqueFace = new Mesh(
              trackInterior(new PlaneGeometry(0.4, 0.15)),
              trackInterior(new MeshBasicMaterial({ map: roomSignTex, toneMapped: false })),
            );
            plaqueFace.position.set(0.033, 1.56, plaqueZ);
            plaqueFace.rotation.y = Math.PI / 2;
            group.add(plaqueFrame, plaqueFace);
          }
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
  const hardwareMaterial = track(
    new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.48,
      vertexColors: true,
    }),
  );

  for (const { style, span, seats: list } of byBucket.values()) {
    const { fabric, frame, hardware } =
      span === 2
        ? buildCoupleChairGeometries(style, room.reclineDeg, room.seatPitchM, room.rowPitchM)
        : buildChairGeometries(style, room.reclineDeg, room.seatPitchM, room.rowPitchM);
    track(fabric);
    track(frame);
    if (hardware) track(hardware);

    const fabricMesh = track(new InstancedMesh(fabric, fabricMaterial, list.length));
    const frameMesh = track(new InstancedMesh(frame, frameMaterial, list.length));
    const hardwareMesh = hardware ? track(new InstancedMesh(hardware, hardwareMaterial, list.length)) : null;
    list.forEach((seat, i) => {
      tmpQuat.setFromAxisAngle(yAxis, seat.yaw);
      tmpMat.compose(tmpPos.set(seat.x, seat.floorY, seat.z), tmpQuat, tmpScale.set(1, 1, 1));
      fabricMesh.setMatrixAt(i, tmpMat);
      frameMesh.setMatrixAt(i, tmpMat);
      hardwareMesh?.setMatrixAt(i, tmpMat);
    });
    fabricMesh.instanceMatrix.needsUpdate = true;
    frameMesh.instanceMatrix.needsUpdate = true;
    if (hardwareMesh) hardwareMesh.instanceMatrix.needsUpdate = true;
    scene.add(fabricMesh);
    scene.add(frameMesh);
    if (hardwareMesh) scene.add(hardwareMesh);
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

  // Soft grounded contact shadows beneath every chair (1 InstancedMesh draw call across the entire room)
  if (room.seats.length > 0) {
    const shadowTex = createChairShadowTexture();
    if (shadowTex) {
      track(shadowTex);
      const shadowGeom = track(new PlaneGeometry(1, 1));
      shadowGeom.rotateX(-Math.PI / 2);
      const shadowMat = track(
        new MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
        }),
      );
      const chairShadowMesh = track(new InstancedMesh(shadowGeom, shadowMat, room.seats.length));
      room.seats.forEach((seat, i) => {
        const sw = seat.span * room.seatPitchM * 1.08;
        const sd = seat.style === "bed" ? Math.min(room.rowPitchM * 0.92, 1.54) : 0.8;
        tmpQuat.setFromAxisAngle(yAxis, seat.yaw);
        tmpMat.compose(tmpPos.set(seat.x, seat.floorY + 0.005, seat.z + 0.02), tmpQuat, tmpScale.set(sw, 1, sd));
        chairShadowMesh.setMatrixAt(i, tmpMat);
      });
      chairShadowMesh.instanceMatrix.needsUpdate = true;
      chairShadowMesh.renderOrder = 2;
      scene.add(chairShadowMesh);
    }
  }

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
  let reservedCodes = options.reservedCodes;
  let holderLabels = options.holderLabels;
  let highlightedCodes = options.highlightedCodes;
  let sightlineOn = Boolean(options.sightline);

  const snackRig = buildSnackPropRig(track);
  scene.add(snackRig.group);
  const sightlineOverlay = buildSightlineOverlay(room);
  scene.add(sightlineOverlay.group);
  const holderTagsOverlay = buildHolderTagsOverlay(room);
  scene.add(holderTagsOverlay.group);
  const seatFlagsOverlay = buildSeatFlagsOverlay(room);
  scene.add(seatFlagsOverlay.group);
  const highlightRingsOverlay = buildHighlightRingsOverlay(room);
  scene.add(highlightRingsOverlay.group);

  function updateAudience() {
    const selectedSeat = mode === "seat" && selected ? seatByCode.get(selected) : undefined;
    const hasFriends = Boolean(holderLabels && holderLabels.size > 0);
    if ((!selectedSeat || !audienceOn) && !hasFriends) {
      audienceMesh.count = 0;
      audienceMesh.visible = false;
      return;
    }
    if (room.seats.length === 0) {
      audienceMesh.count = 0;
      audienceMesh.visible = false;
      return;
    }
    // `audienceGeom` already bakes `room.eyeDropM` via spine tilt; only apply viewer stature delta from 170 cm.
    const frontStatureDeltaY = sittingEyeHeightM(frontHeightCm) - EYE_HEIGHT_M;
    const halfPitch = room.seatPitchM / 2;
    let activeCount = 0;
    for (const seat of room.seats) {
      if (seat.broken) continue;
      if (mode === "seat" && seat.code === selected) continue;
      const isFrontViewer = Boolean(selectedSeat && audienceOn && seat.rowIndex < selectedSeat.rowIndex);
      const isFriendSeated = Boolean(holderLabels?.has(seat.code));
      if (!isFrontViewer && !isFriendSeated) continue;
      const bedDropY = seat.style === "bed" ? -0.16 : 0;
      const statureY = isFrontViewer ? frontStatureDeltaY : 0;
      tmpQuat.setFromAxisAngle(yAxis, seat.yaw);
      if (seat.span === 2) {
        const dx = Math.cos(seat.yaw) * halfPitch;
        const dz = -Math.sin(seat.yaw) * halfPitch;
        tmpMat.compose(tmpPos.set(seat.x - dx, seat.floorY + statureY + bedDropY, seat.z - dz), tmpQuat, tmpScale.set(1, 1, 1));
        audienceMesh.setMatrixAt(activeCount++, tmpMat);
        tmpMat.compose(tmpPos.set(seat.x + dx, seat.floorY + statureY + bedDropY, seat.z + dz), tmpQuat, tmpScale.set(1, 1, 1));
        audienceMesh.setMatrixAt(activeCount++, tmpMat);
      } else {
        tmpMat.compose(tmpPos.set(seat.x, seat.floorY + statureY + bedDropY, seat.z), tmpQuat, tmpScale.set(1, 1, 1));
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
  const friendColor = new Color(FRIEND_SEAT_COLOR);
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
    // Show cinema snack combo on the selected seat, or preview it on the best center seat in overview so toggling is immediately visible.
    const snackSeat = s ?? (room.bestSeatCode ? seatByCode.get(room.bestSeatCode) : room.seats[0]);
    snackRig.placeOnSeat(snackSeat, currentAppearance.snackPropsVisible, room.seatPitchM);
    sightlineOverlay.update(sightlineOn, mode, s, viewerHeightCm, frontHeightCm);
    holderTagsOverlay.update(holderLabels, selected, mode);
    seatFlagsOverlay.update(selected, mode);
    highlightRingsOverlay.update(highlightedCodes, selected, mode);
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
        const isReserved = Boolean(reservedCodes?.has(seat.code));
        const isFriend = Boolean(holderLabels?.has(seat.code));
        let hex = resolvedTypeColors.get(seat.type) ?? DEFAULT_SEAT_COLOR;
        if (seat.broken) {
          hex = BROKEN_COLOR;
        } else if (isReserved) {
          hex = RESERVED_SEAT_COLOR;
        } else if (isFriend && !heat) {
          hex = FRIEND_SEAT_COLOR;
        } else if (heat) {
          hex = palette[Math.round(heatLevel(seat.score, options.range.min, options.range.max) * (HEAT_STEPS - 1))];
        }
        color.setHex(hex);
        if (isFriend && heat && !seat.broken && !isReserved) {
          color.lerp(friendColor, 0.55);
        }
        // Subtle organic plush velvet micro-variation across normal rows (just like real cinema fabric)
        if (!heat && !seat.broken && !isReserved && !isFriend) {
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

  // --- Dynamic House-Lights Dimmer Application (0 = Movie Dimmed, 1 = House Lights On) ---
  function applyLighting(lvl: number) {
    const heatBoost = heat ? 0.24 : 0;
    const isSeat = mode === "seat";
    const movieScale =
      currentAppearance.movieAmbientLevel === "deep"
        ? 0.45
        : currentAppearance.movieAmbientLevel === "bright"
          ? 2.15
          : 1.0;
    const beamScale =
      currentAppearance.projectorBeamIntensity === "subtle"
        ? 0.55
        : currentAppearance.projectorBeamIntensity === "vivid"
          ? 1.65
          : 1.0;
    // Combine low ambient fill with real spatial tungsten downlight pools so walls, steps & floor read with realistic depth
    ambientLight.intensity = (isSeat ? 0.02 : 0.042) * movieScale + 0.2 * lvl + heatBoost;
    hemiLight.intensity = (isSeat ? 0.025 : 0.055) * movieScale + 0.3 * lvl + heatBoost * 0.5;
    ceilingKey.intensity = 0.44 * lvl + heatBoost * 0.35;
    const poolStrength = currentAppearance.downlightsVisible ? 26 : 16;
    housePoolFront.intensity = poolStrength * lvl;
    housePoolBack.intensity = poolStrength * lvl;
    screenBounce.intensity = isSeat ? (4.8 - 2.6 * lvl) : (7.8 - 3.6 * lvl);
    screenFill.intensity = isSeat ? (0.11 - 0.04 * lvl) : (0.16 - 0.07 * lvl);

    if (bulbMat) bulbMat.color.copy(bulbDimColor).lerp(bulbLitColor, lvl);
    if (sconceSlitMat) sconceSlitMat.color.copy(slitDimColor).multiplyScalar(0.38).lerp(slitLitColor, lvl);
    if (coveStripMat) coveStripMat.color.copy(coveDimColor).multiplyScalar(0.45).lerp(coveLitColor, lvl);
    if (portGlassMat) portGlassMat.color.copy(portDimColor).lerp(portLitColor, lvl);
    if (sconceGlowMat) sconceGlowMat.opacity = 0.04 + 0.64 * lvl;
    if (coveWashMat) coveWashMat.opacity = 0.04 + 0.52 * lvl;
    if (haloMat) haloMat.opacity = 0.36 - 0.2 * lvl;
    if (stageReflectMat) stageReflectMat.opacity = 0.14 - 0.08 * lvl;
    if (ceilingReflectMat) ceilingReflectMat.opacity = 0.11 - 0.07 * lvl;
    if (sideWallReflectMat) sideWallReflectMat.opacity = 0.22 - 0.14 * lvl;
    if (aisleLedSpillMat) aisleLedSpillMat.opacity = 0.32 - 0.16 * lvl;
    if (screenLightsUniform) screenLightsUniform.value = lvl;
    syncYoutubeOpticalGlaze(lvl, currentAppearance.screenBorder);
    if (beamOpacityUniform) beamOpacityUniform.value = (isSeat ? (0.048 - 0.02 * lvl) : (0.165 - 0.045 * lvl)) * beamScale;
    if (stageLedMat) stageLedMat.color.setHex(lvl > 0.5 ? 0x7c5838 : 0xc68242);
    if (stageLedWashMat) stageLedWashMat.opacity = 0.28 - 0.14 * lvl;
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
  controls.minDistance = 1.6;
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
  // Keep a comfortable optical clearance in front of the screen so max zoom frames the screen cleanly without over-zooming.
  const screenClearanceZ = Math.min(
    Math.max(2.5, firstZ * 0.85),
    Math.max(room.screen.height * 1.08, room.screen.width * 0.46),
  );
  const minCamZ = Math.max(2.2, room.screen.topZ + 1.8, screenClearanceZ);
  const maxCamZ = Math.max(minCamZ + 1.2, room.backWallZ - 0.32);

  const minTargetX = Math.max(minCamX + 0.15, -leftMargin + 0.4);
  const maxTargetX = Math.min(maxCamX - 0.15, room.widthM + rightMargin - 0.4);
  const minTargetY = 0.45;
  const maxTargetY = Math.max(1.2, maxCamY - 0.12);
  // Keep orbit target cleanly in front of the screen plane aligned with the front clearance stop.
  const minTargetZ = Math.max(room.screen.centerZ + 0.05, minCamZ - controls.minDistance);
  const maxTargetZ = Math.min(maxCamZ - 0.35, lastZ + 0.4);
  const clampOffset = new Vector3();
  const clampDir = new Vector3();
  const dollyForward = new Vector3();

  function dollyOrbitForward(stepM: number) {
    dollyForward.subVectors(controls.target, camera.position);
    const dist = dollyForward.length();
    if (dist < 0.001) return;
    dollyForward.divideScalar(dist);

    // When zooming forward toward the cinema screen, gently level out onto the screen's optical center
    // and lock cleanly once the camera reaches the front screen clearance `minCamZ`.
    const aimingAtScreen = dollyForward.z < -0.35;
    if (aimingAtScreen && camera.position.z <= minCamZ + 0.02) {
      const screenFocusY = Math.max(minTargetY, Math.min(maxTargetY, room.screen.centerY));
      controls.target.y += (screenFocusY - controls.target.y) * 0.35;
      camera.position.y += (screenFocusY - camera.position.y) * 0.35;
      camera.lookAt(controls.target);
      return;
    }

    const prevTargetX = controls.target.x;
    const prevTargetY = controls.target.y;
    const prevTargetZ = controls.target.z;

    const screenFocusY = Math.max(minTargetY, Math.min(maxTargetY, room.screen.centerY));
    const nextTargetX = Math.max(minTargetX, Math.min(maxTargetX, prevTargetX + dollyForward.x * stepM));
    const nextTargetZ = Math.max(minTargetZ, Math.min(maxTargetZ, prevTargetZ + dollyForward.z * stepM));
    const rawTargetY = Math.max(minTargetY, Math.min(maxTargetY, prevTargetY + dollyForward.y * stepM));
    const nextTargetY = aimingAtScreen
      ? prevTargetY + (screenFocusY - prevTargetY) * Math.min(0.45, stepM * 0.35)
      : rawTargetY;

    controls.target.set(nextTargetX, nextTargetY, nextTargetZ);

    const movedX = controls.target.x - prevTargetX;
    const movedY = controls.target.y - prevTargetY;
    const movedZ = controls.target.z - prevTargetZ;
    const movedLen = Math.hypot(movedX, movedY, movedZ);

    if (movedLen > 0.001) {
      camera.position.x = Math.max(minCamX, Math.min(maxCamX, camera.position.x + movedX));
      camera.position.y = aimingAtScreen
        ? Math.max(minCamY, Math.min(maxCamY, camera.position.y + (screenFocusY - camera.position.y) * Math.min(0.4, stepM * 0.3)))
        : Math.max(minCamY, Math.min(maxCamY, camera.position.y + movedY));
      camera.position.z = Math.max(minCamZ, Math.min(maxCamZ, camera.position.z + movedZ));
    } else if (dist > controls.minDistance + 0.01) {
      // Target already reached its front bound: close only down to `minDistance` & `minCamZ`.
      const closeStep = Math.min(stepM, dist - controls.minDistance);
      camera.position.x = Math.max(minCamX, Math.min(maxCamX, camera.position.x + dollyForward.x * closeStep));
      camera.position.y = aimingAtScreen
        ? Math.max(minCamY, Math.min(maxCamY, camera.position.y + (screenFocusY - camera.position.y) * 0.35))
        : Math.max(minCamY, Math.min(maxCamY, camera.position.y + dollyForward.y * closeStep));
      camera.position.z = Math.max(minCamZ, Math.min(maxCamZ, camera.position.z + dollyForward.z * closeStep));
    }

    const nextDist = camera.position.distanceTo(controls.target);
    desiredOrbitDist = Math.max(controls.minDistance, Math.min(controls.maxDistance, nextDist));
    camera.lookAt(controls.target);
  }

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
  let prevOrbitPinchDist = 0;
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

  const onWheelCapture = (e: WheelEvent) => {
    if (mode === "seat") {
      e.preventDefault();
      if (tween) tween = null;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      camera.zoom = Math.max(1, Math.min(SEAT_MAX_ZOOM, camera.zoom * factor));
      camera.updateProjectionMatrix();
      requestRender();
      return;
    }
    if (mode === "orbit") {
      if (tween) {
        tween = null;
        controls.target.copy(orbitTarget);
        controls.enabled = true;
        controls.update();
      }
      wheelZooming = true;
      const curDist = camera.position.distanceTo(controls.target);
      // Once zoomed close to orbit pivot, keep gliding camera + target forward all the way up to the cinema screen.
      if (e.deltaY < 0 && curDist <= controls.minDistance + 0.45) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const step = Math.min(1.15, Math.max(0.22, Math.abs(e.deltaY) * 0.0085));
        dollyOrbitForward(step);
        clampCameraInsideRoom();
        requestRender();
      } else if (e.deltaY > 0 && controls.target.z < midSeatingZ - 0.08 && camera.position.z >= maxCamZ - 0.25) {
        // When zooming back out against the rear wall, smoothly pull the target back toward the room center.
        e.preventDefault();
        e.stopImmediatePropagation();
        controls.target.lerp(orbitTarget, 0.22);
        desiredOrbitDist = Math.min(controls.maxDistance, camera.position.distanceTo(controls.target));
        clampCameraInsideRoom();
        requestRender();
      }
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
        } else {
          prevOrbitPinchDist = touchPairDist();
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
          camera.zoom = Math.max(1, Math.min(SEAT_MAX_ZOOM, pinchStartZoom * (dist / pinchStartDist)));
          camera.updateProjectionMatrix();
          requestRender();
        } else if (mode === "orbit") {
          const dist = touchPairDist();
          if (prevOrbitPinchDist > 0 && dist > prevOrbitPinchDist && camera.position.distanceTo(controls.target) <= controls.minDistance + 0.45) {
            dollyOrbitForward(Math.min(0.6, (dist - prevOrbitPinchDist) * 0.014));
            clampCameraInsideRoom();
            requestRender();
          }
          prevOrbitPinchDist = dist;
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
      if (activeTouches.size < 2) {
        pinchStartDist = 0;
        prevOrbitPinchDist = 0;
      }
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
  canvas.addEventListener("wheel", onWheelCapture, { capture: true, passive: false });
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

    if (curtainTween) {
      const elapsed = Math.min(1, (now - curtainTween.start) / CURTAIN_MS);
      const ease = elapsed < 0.5 ? 4 * elapsed * elapsed * elapsed : 1 - (-2 * elapsed + 2) ** 3 / 2;
      curtainOpen = curtainTween.from + (curtainTween.to - curtainTween.from) * ease;
      applyCurtainOpen(curtainOpen);
      if (elapsed >= 1) {
        curtainTween = null;
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
    if (activeYoutubeId && youtubeIframe) {
      pausedYoutubeByVisibility = true;
      if (ytPlayer && ytReady) {
        try {
          ytPlayer.pauseVideo();
        } catch {
          postYoutubeCommand("pauseVideo");
        }
      } else {
        postYoutubeCommand("pauseVideo");
      }
    }
  };
  const onVisibility = () => {
    if (document.hidden) {
      pauseRendering();
      return;
    }
    if (pausedYoutubeByVisibility && activeYoutubeId && youtubeIframe) {
      pausedYoutubeByVisibility = false;
      if (ytPlayer && ytReady) {
        try {
          ytPlayer.playVideo();
        } catch {
          postYoutubeCommand("playVideo");
        }
      } else {
        postYoutubeCommand("playVideo");
      }
      if (!youtubeMuted) scheduleYoutubeUnmuteVerify();
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
    curtainTween = null;
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

  function flyToOrbitView(pos: Vector3, target: Vector3) {
    mode = "orbit";
    controls.enabled = false;
    hoveredCode = null;
    options.onHover?.(null);
    canvas.style.cursor = "grab";
    updateAudience();
    updateMarks();
    applyLighting(lightsLevel);
    paintSeats();
    if (camera.zoom !== 1) {
      camera.zoom = 1;
      camera.updateProjectionMatrix();
    }
    const clampedPos = new Vector3(
      Math.max(minCamX, Math.min(maxCamX, pos.x)),
      Math.max(minCamY, Math.min(maxCamY, pos.y)),
      Math.max(minCamZ, Math.min(maxCamZ, pos.z)),
    );
    const clampedTarget = new Vector3(
      Math.max(minTargetX, Math.min(maxTargetX, target.x)),
      Math.max(minTargetY, Math.min(maxTargetY, target.y)),
      Math.max(minTargetZ, Math.min(maxTargetZ, target.z)),
    );
    const quat = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(clampedPos, clampedTarget, yAxis));
    const targetFov = adaptiveFov(ORBIT_FOV, camera.aspect, 64);
    startFlight(clampedPos, quat, targetFov, true, () => {
      controls.target.copy(clampedTarget);
      desiredOrbitDist = clampedPos.distanceTo(clampedTarget);
      controls.enabled = true;
      controls.update();
    });
  }

  // Initial paint & framing (seamlessly restores saved camera state across live editor rebuilds on the same layout)
  applyLighting(lightsLevel);
  paintSeats();
  updateMarks();
  fit();
  const savedCam = options.initialCameraState;
  if (savedCam && savedCam.mode === "seat" && selected && seatByCode.has(selected)) {
    applyMode("seat", false);
    lookYaw = Math.max(-LOOK_LIMIT_YAW, Math.min(LOOK_LIMIT_YAW, savedCam.lookYaw));
    lookPitch = Math.max(-LOOK_LIMIT_PITCH, Math.min(LOOK_LIMIT_PITCH, savedCam.lookPitch));
    camera.zoom = Math.max(1, Math.min(SEAT_MAX_ZOOM, savedCam.zoom || 1));
    camera.rotation.set(basePitch + lookPitch, baseYaw + lookYaw, 0);
    camera.updateProjectionMatrix();
    requestRender();
  } else if (savedCam && savedCam.mode === "orbit" && options.initialMode !== "seat") {
    applyMode("orbit", false);
    camera.position.set(
      Math.max(minCamX, Math.min(maxCamX, savedCam.pos[0])),
      Math.max(minCamY, Math.min(maxCamY, savedCam.pos[1])),
      Math.max(minCamZ, Math.min(maxCamZ, savedCam.pos[2])),
    );
    controls.target.set(
      Math.max(minTargetX, Math.min(maxTargetX, savedCam.target[0])),
      Math.max(minTargetY, Math.min(maxTargetY, savedCam.target[1])),
      Math.max(minTargetZ, Math.min(maxTargetZ, savedCam.target[2])),
    );
    desiredOrbitDist = Math.max(controls.minDistance, Math.min(controls.maxDistance, camera.position.distanceTo(controls.target)));
    controls.update();
    clampCameraInsideRoom();
    requestRender();
  } else {
    applyMode(options.initialMode === "seat" && selected ? "seat" : "orbit", false);
  }

  return {
    setMode: (next) => {
      const targetMode: Room3DMode = next === "seat" && selected ? "seat" : "orbit";
      if (targetMode === mode) return;
      applyMode(targetMode, true);
    },
    setCameraPreset: (preset) => {
      if (preset === "overview") {
        flyToOrbitView(orbitPos, orbitTarget);
        return;
      }
      if (preset === "entrance") {
        const door = room.entrances[0];
        const pos = door
          ? new Vector3(
              door.side === "left"
                ? -leftMargin + 0.65
                : door.side === "right"
                  ? room.widthM + rightMargin - 0.65
                  : door.x,
              Math.min(maxCamY, door.floorY + 1.65),
              Math.max(minCamZ, Math.min(maxCamZ, door.z)),
            )
          : new Vector3(-leftMargin + 0.65, Math.min(maxCamY, 1.65), Math.max(minCamZ, firstZ));
        const target = new Vector3(room.screen.centreX, room.screen.centerY * 0.86, midSeatingZ * 0.72);
        flyToOrbitView(pos, target);
        return;
      }
      if (preset === "frontRow") {
        const pos = new Vector3(
          room.screen.centreX,
          Math.max(minCamY, 1.15),
          Math.max(minCamZ, firstZ + 0.35),
        );
        const target = new Vector3(room.screen.centreX, room.screen.centerY, Math.max(minTargetZ, room.screen.centerZ + 0.4));
        flyToOrbitView(pos, target);
        return;
      }
      // "booth": elevated rear projection booth vantage looking steeply down over the seating stadium
      const pos = new Vector3(
        room.projectionPort.x,
        Math.min(maxCamY, Math.max(room.maxFloorY + 2.1, room.projectionPort.y - 0.15)),
        Math.min(maxCamZ, room.backWallZ - 0.45),
      );
      const target = new Vector3(room.screen.centreX, Math.max(minTargetY, room.screen.bottom + room.screen.height * 0.28), firstZ);
      flyToOrbitView(pos, target);
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
      const nextCurtain = on ? 0 : 1;
      if (nextCurtain !== curtainTarget) {
        curtainTarget = nextCurtain;
        if (prefersReducedMotion() || !currentAppearance.screenCurtainsAnimated) {
          curtainTween = null;
          curtainOpen = nextCurtain;
          applyCurtainOpen(curtainOpen);
        } else {
          curtainTween = { start: performance.now(), from: curtainOpen, to: nextCurtain };
        }
      }
      if (next === lightsTarget) {
        if (curtainTween) requestRender();
        return;
      }
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
      updateSelectionIndicator();
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
    setSightline: (on) => {
      sightlineOn = on;
      updateSelectionIndicator();
      if (on && selected && mode === "orbit") {
        const s = seatByCode.get(selected);
        if (s) {
          // Swing cleanly to a side-elevated architectural cutaway angle so the sightline laser rays read clearly
          const sideX = s.x >= room.shellCenterX ? -leftMargin + 0.9 : room.widthM + rightMargin - 0.9;
          const pos = new Vector3(sideX, Math.min(maxCamY, Math.max(2.2, s.floorY + 2.0)), Math.min(maxCamZ, s.z + 1.4));
          const target = new Vector3((s.x + room.screen.centreX) / 2, (s.floorY + 1.1 + room.screen.centerY) / 2, (s.z + room.screen.centerZ) / 2);
          flyToOrbitView(pos, target);
          return;
        }
      }
      requestRender();
    },
    setOccupancy: (reserved, holders) => {
      reservedCodes = reserved;
      holderLabels = holders;
      updateAudience();
      paintSeats();
      requestRender();
    },
    setHighlightedCodes: (codes) => {
      highlightedCodes = codes;
      updateSelectionIndicator();
      requestRender();
    },
    getCameraState: () => ({
      mode,
      pos: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      lookYaw,
      lookPitch,
      zoom: camera.zoom,
    }),
    setLookOffset: (yawRad, pitchRad) => {
      if (mode !== "seat" || tween) return;
      lookYaw = Math.max(-LOOK_LIMIT_YAW, Math.min(LOOK_LIMIT_YAW, yawRad));
      lookPitch = Math.max(-LOOK_LIMIT_PITCH, Math.min(LOOK_LIMIT_PITCH, pitchRad));
      camera.rotation.set(basePitch + lookPitch, baseYaw + lookYaw, 0);
      requestRender();
    },
    captureSnapshot: (meta) =>
      composeRoomSnapshot(
        canvas,
        () => {
          renderer.render(scene, camera);
        },
        meta,
      ),
    setAppearance: (rawNext) => {
      if (disposed) return;
      const next = normalizeRoom3DAppearance(rawNext);
      const carpetChanged =
        next.carpetStyle !== currentAppearance.carpetStyle ||
        next.carpetColor !== currentAppearance.carpetColor ||
        next.carpetImageUrl !== currentAppearance.carpetImageUrl ||
        next.carpetImageRepeat !== currentAppearance.carpetImageRepeat;
      currentAppearance = next;

      if (carpetChanged) {
        applyCarpetSurface(next, false);
      }

      fabricMaterial.roughness = next.seatFinish === "leather" ? 0.42 : 0.82;
      fabricMaterial.metalness = next.seatFinish === "leather" ? 0.08 : 0.03;
      fabricMaterial.needsUpdate = true;
      frameMaterial.color.setHex(parseHexOrRgb(next.seatFrameColor) ?? 0x15131c);

      buildInterior(next);
      applyLighting(lightsLevel);
      updateSelectionIndicator();
      requestRender();
    },
    setYoutubeMuted: (muted) => {
      applyYoutubeAudio(muted);
    },
    mountTo: (target) => {
      if (disposed || target === currentHost) return;
      // Moving an iframe across DOM ancestors reloads it from `src`; detach first and recreate once with current mute + timestamp.
      const videoIdToRestore = activeYoutubeId && youtubeWrapper ? activeYoutubeId : null;
      let resumeSec = 0;
      if (videoIdToRestore) {
        if (ytPlayer && ytReady) {
          try {
            resumeSec = Math.floor(ytPlayer.getCurrentTime?.() ?? 0);
          } catch {
            resumeSec = 0;
          }
        }
        teardownYoutubePlayer();
        youtubeIframe?.remove();
        youtubeIframe = null;
      }

      observer.unobserve(currentHost);
      currentHost = target;
      currentHost.appendChild(stageEl);
      observer.observe(currentHost);

      if (videoIdToRestore) {
        createAndAttachYoutubeIframe(videoIdToRestore, resumeSec);
      }

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
      curtainTween = null;
      cancelHover();
      sightlineOverlay.dispose();
      holderTagsOverlay.dispose();
      seatFlagsOverlay.dispose();
      highlightRingsOverlay.dispose();
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
      carpetBumpTex?.dispose();
      carpetBumpTex = null;
      carpetRoughTex?.dispose();
      carpetRoughTex = null;
      for (const item of disposables) item.dispose();
      renderer.dispose();
      // Immediately return GPU memory: iOS Safari counts every live context/canvas against the page limit.
      renderer.forceContextLoss();
      stageEl.remove();
    },
  };
}
