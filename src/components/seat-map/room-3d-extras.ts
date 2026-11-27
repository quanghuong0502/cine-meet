import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { RoomScene, SceneSeat } from "@/lib/seat-layout/scene";
import { EYE_HEIGHT_M, HEAD_ABOVE_EYE_M, sittingEyeHeightM } from "@/services/seat-score";

export interface Disposable {
  dispose(): void;
}

export interface Room3DMeta {
  roomName?: string;
  brandName?: string;
}

export interface Room3DSnapshotMeta {
  title?: string;
  subtitle?: string;
  badge?: string;
  youtubeThumbnailUrl?: string;
}

function normalizeGeom(geom: BufferGeometry): BufferGeometry {
  const out = geom.index ? geom.toNonIndexed() : geom;
  if (out !== geom) geom.dispose();
  if (!out.getAttribute("normal")) out.computeVertexNormals();
  if (!out.getAttribute("uv")) {
    const count = out.getAttribute("position").count;
    out.setAttribute("uv", new BufferAttribute(new Float32Array(count * 2), 2));
  }
  return out;
}

function paintGeom(geom: BufferGeometry, hex: number): BufferGeometry {
  const g = normalizeGeom(geom);
  const c = new Color(hex);
  const count = g.getAttribute("position").count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new BufferAttribute(arr, 3));
  return g;
}

/** Backlit dark-glass auditorium room plaque beside exit doors (`PHÒNG 01` / brand name). */
export function createRoomSignTexture(roomName: string, brandName?: string): CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#090a12";
  ctx.fillRect(0, 0, 256, 96);

  // Brushed architectural metallic frame + subtle warm rim
  ctx.strokeStyle = "rgba(255, 224, 170, 0.45)";
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 88);

  const safeRoom = (roomName.trim() || "ROOM 01").slice(0, 18);
  const safeBrand = (brandName?.trim() || "").slice(0, 18);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (safeBrand) {
    ctx.fillStyle = "rgba(251, 191, 36, 0.88)";
    ctx.font = "700 18px system-ui, -apple-system, sans-serif";
    ctx.fillText(safeBrand.toUpperCase(), 128, 30, 228);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 30px system-ui, -apple-system, sans-serif";
    ctx.fillText(safeRoom, 128, 66, 228);
  } else {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 34px system-ui, -apple-system, sans-serif";
    ctx.fillText(safeRoom, 128, 50, 228);
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

/**
 * Single-draw-call backlit seat number plates (`A1`, `E6`, …) placed cleanly on the upper rear shell
 * of every chair so viewers can read exact seat codes from both Orbit overview and seated POV.
 */
export function buildSeatNumberMesh(
  seats: SceneSeat[],
  room: RoomScene,
  track: <T extends Disposable>(item: T) => T,
): Mesh | null {
  if (seats.length === 0) return null;
  const uniqueCodes = [...new Set(seats.map((s) => s.code))];
  const cols = Math.ceil(Math.sqrt(uniqueCodes.length));
  const rows = Math.ceil(uniqueCodes.length / cols);
  const cellW = cols <= 8 ? 64 : cols <= 16 ? 48 : 32;
  const cellH = Math.round(cellW * 0.56);
  const atlasW = cols * cellW;
  const atlasH = rows * cellH;

  const canvas = document.createElement("canvas");
  canvas.width = atlasW;
  canvas.height = atlasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#0b0b12";
  ctx.fillRect(0, 0, atlasW, atlasH);

  const slotOf = new Map<string, number>();
  uniqueCodes.forEach((code, idx) => {
    slotOf.set(code, idx);
    const cx = idx % cols;
    const cy = Math.floor(idx / cols);
    const x0 = cx * cellW;
    const y0 = cy * cellH;
    // High-contrast backlit dark-bronze seat number plaque (clearly readable from Overview & POV)
    ctx.fillStyle = "#161624";
    ctx.fillRect(x0 + 2, y0 + 2, cellW - 4, cellH - 4);
    ctx.strokeStyle = "rgba(251, 211, 141, 0.78)";
    ctx.lineWidth = Math.max(1.5, Math.round(cellW / 24));
    ctx.strokeRect(x0 + 3, y0 + 3, cellW - 6, cellH - 6);
    ctx.fillStyle = "#fff7e6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fontPx = Math.round(cellH * (code.length >= 4 ? 0.48 : 0.58));
    ctx.font = `800 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(code, x0 + cellW / 2, y0 + cellH / 2 + 1, cellW - 8);
  });

  const tex = track(new CanvasTexture(canvas));
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;

  const tilt = (room.reclineDeg * Math.PI) / 180;
  const yAxis = new Vector3(0, 1, 0);
  const yawQ = new Quaternion();
  const tiltQ = new Quaternion();
  const mat = new Matrix4();
  const pos = new Vector3();
  const scale = new Vector3(1, 1, 1);

  const plateW = Math.min(0.195, room.seatPitchM * 0.35);
  const plateH = plateW * 0.56;
  const parts: BufferGeometry[] = [];

  for (const seat of seats) {
    const slot = slotOf.get(seat.code);
    if (slot === undefined) continue;
    const cx = slot % cols;
    const cy = Math.floor(slot / cols);
    const u0 = cx / cols;
    const u1 = (cx + 1) / cols;
    const v1 = 1 - cy / rows;
    const v0 = 1 - (cy + 1) / rows;

    let localY: number;
    let localZ: number;
    let plateTilt: number;

    if (seat.style === "bed") {
      // Headboard sits at y = 0.59, z = bedD/2 - 0.15, thick = 0.17, rotX = 0.36 -> push cleanly +2.8 cm past rear surface
      const bedD = Math.min(room.rowPitchM * 0.86, 1.45);
      plateTilt = 0.36;
      const along = 0.12;
      const out = 0.085 + 0.028;
      localY = 0.59 + along * Math.cos(plateTilt) - out * Math.sin(plateTilt);
      localZ = bedD / 2 - 0.15 + along * Math.sin(plateTilt) + out * Math.cos(plateTilt);
    } else if (seat.style === "recliner") {
      // Recliner backrest (thick 0.14) + headrest bulge at top -> mount cleanly on upper mid-back with +3.2 cm clearance
      plateTilt = Math.max(tilt, 0.32);
      const backH = 0.72;
      const seatD = 0.58;
      const along = backH * 0.54;
      const out = 0.07 + 0.032;
      localY = 0.46 + along * Math.cos(plateTilt) - 0.04 - out * Math.sin(plateTilt);
      localZ = seatD / 2 - 0.04 + along * Math.sin(plateTilt) + out * Math.cos(plateTilt);
    } else {
      // Standard / VIP / 4DX: backShell sits at (backThick/2 + 0.01) with 0.02 thickness (outer face = backThick/2 + 0.02)
      // Push outward along backrest rear normal (0, -sin(tilt), +cos(tilt)) by backThick/2 + 0.042 so it always sits proud
      plateTilt = tilt;
      const backH = seat.style === "4dx" ? 0.68 : seat.style === "vip" ? 0.66 : 0.64;
      const seatD = seat.style === "standard" ? 0.48 : 0.52;
      const backThick = seat.style === "standard" ? 0.11 : 0.125;
      const along = backH * (seat.style === "vip" ? 0.64 : 0.74);
      const out = backThick / 2 + 0.044;
      localY = 0.44 + along * Math.cos(plateTilt) - 0.04 - out * Math.sin(plateTilt);
      localZ = seatD / 2 - 0.025 + along * Math.sin(plateTilt) + out * Math.cos(plateTilt);
    }

    const g = new PlaneGeometry(plateW, plateH);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
    }

    yawQ.setFromAxisAngle(yAxis, seat.yaw);
    tiltQ.setFromEuler(new Euler(plateTilt, 0, 0));
    yawQ.multiply(tiltQ);

    const worldX = seat.x + Math.sin(seat.yaw) * localZ;
    const worldZ = seat.z + Math.cos(seat.yaw) * localZ;
    mat.compose(pos.set(worldX, seat.floorY + localY, worldZ), yawQ, scale);
    g.applyMatrix4(mat);
    parts.push(normalizeGeom(g));
  }

  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) return null;
  track(merged);

  const material = track(new MeshBasicMaterial({ map: tex, side: DoubleSide, toneMapped: false }));
  const mesh = new Mesh(merged, material);
  mesh.renderOrder = 3;
  return mesh;
}

/**
 * Commercial cinema subwoofer enclosures recessed along the stage apron (2–4 units, 2 InstancedMesh draw calls).
 */
export function buildStageSubwoofers(
  room: RoomScene,
  apronH: number,
  baffleFrontZ: number,
  track: <T extends Disposable>(item: T) => T,
): Group | null {
  const availH = Math.max(0, room.screen.bottom - apronH - 0.06);
  if (availH < 0.24) return null;

  const group = new Group();
  const subCount = room.screen.width >= 9 ? 4 : 2;
  const subW = Math.min(0.84, (room.screen.width * 0.72) / subCount);
  const subH = Math.min(0.56, availH * 0.84);
  const subD = 0.34;

  const cabGeom = track(new BoxGeometry(subW, subH, subD));
  const cabMat = track(new MeshStandardMaterial({ color: 0x07070c, roughness: 0.88, metalness: 0.14 }));
  const cabMesh = track(new InstancedMesh(cabGeom, cabMat, subCount));

  const grilleGeom = track(new BoxGeometry(subW * 0.86, subH * 0.8, 0.02));
  const grilleMat = track(new MeshStandardMaterial({ color: 0x1b1c26, roughness: 0.52, metalness: 0.42 }));
  const grilleMesh = track(new InstancedMesh(grilleGeom, grilleMat, subCount));

  const portGeom = track(new CylinderGeometry(subH * 0.28, subH * 0.28, 0.025, 16));
  portGeom.rotateX(Math.PI / 2);
  const portMat = track(new MeshStandardMaterial({ color: 0x0e0f16, roughness: 0.4, metalness: 0.5 }));
  const portMesh = track(new InstancedMesh(portGeom, portMat, subCount));

  const span = Math.min(room.screen.width * 0.82, room.shellWidthM - 1.2);
  const m = new Matrix4();
  const subY = apronH + subH / 2 + 0.01;
  const subZ = baffleFrontZ + subD / 2 - 0.04;

  for (let i = 0; i < subCount; i++) {
    const t = (i + 0.5) / subCount;
    const x = room.screen.centreX - span / 2 + t * span;
    m.makeTranslation(x, subY, subZ);
    cabMesh.setMatrixAt(i, m);
    m.makeTranslation(x, subY, subZ + subD / 2 + 0.004);
    grilleMesh.setMatrixAt(i, m);
    m.makeTranslation(x, subY, subZ + subD / 2 + 0.01);
    portMesh.setMatrixAt(i, m);
  }
  cabMesh.instanceMatrix.needsUpdate = true;
  grilleMesh.instanceMatrix.needsUpdate = true;
  portMesh.instanceMatrix.needsUpdate = true;
  group.add(cabMesh, grilleMesh, portMesh);
  return group;
}

/**
 * Matte-black sloped handrails strictly along vertical & side aisle stairs when `stepsPerRow >= 2`.
 * Never placed behind horizontal cross-aisles or across aisle-filled rows.
 */
export function buildAisleHandrails(
  room: RoomScene,
  leftMargin: number,
  rightMargin: number,
  aisleLedVisible: boolean,
  ledHex: number,
  track: <T extends Disposable>(item: T) => T,
): Group | null {
  if (room.aisleSteps.length === 0 || room.rowFloors.length < 2) return null;

  // Group stair steps by walkway X so we only install rails on open stepped runs (never cross-aisles or filled rows).
  const byWalkway = new Map<number, typeof room.aisleSteps>();
  for (const step of room.aisleSteps) {
    const key = Math.round(step.x * 20) / 20;
    const list = byWalkway.get(key);
    if (list) list.push(step);
    else byWalkway.set(key, [step]);
  }

  const railParts: BufferGeometry[] = [];
  const ledParts: BufferGeometry[] = [];
  const leftWallX = -leftMargin;
  const rightWallX = room.widthM + rightMargin;
  const railHeight = 0.88;

  for (const [, steps] of byWalkway) {
    steps.sort((a, b) => a.z - b.z);
    if (steps.length === 0) continue;

    // Split into contiguous sloped runs (breaks cleanly at horizontal cross-aisles or filled rows).
    const runs: (typeof steps)[] = [];
    let current: typeof steps = [steps[0]];
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const cur = steps[i];
      if (cur.z - prev.z > room.rowPitchM * 1.45) {
        runs.push(current);
        current = [cur];
      } else {
        current.push(cur);
      }
    }
    runs.push(current);

    const avgX = steps.reduce((sum, s) => sum + s.x, 0) / steps.length;
    const nearLeftWall = room.sideAisles.includes("left") && avgX - leftWallX < 1.3;
    const nearRightWall = room.sideAisles.includes("right") && rightWallX - avgX < 1.3;
    const railX = nearLeftWall ? leftWallX + 0.085 : nearRightWall ? rightWallX - 0.085 : avgX;
    const wallMounted = nearLeftWall || nearRightWall;
    const wallDir = nearLeftWall ? -1 : 1;

    for (const run of runs) {
      if (run.length < 1) continue;
      const first = run[0];
      const last = run[run.length - 1];
      const z0 = first.z - first.depthM * 0.5;
      const z1 = last.z + last.depthM * 0.5 + room.rowPitchM * 0.35;
      const y0 = Math.max(0, first.y - first.heightM / 2) + railHeight;
      const y1 = last.y + last.heightM / 2 + railHeight;
      const dz = z1 - z0;
      const dy = y1 - y0;
      const len = Math.hypot(dz, dy);
      if (len < 0.35) continue;

      const slope = Math.atan2(dy, dz);
      const midZ = (z0 + z1) / 2;
      const midY = (y0 + y1) / 2;

      const tube = new CylinderGeometry(0.02, 0.02, len, 8);
      tube.rotateX(Math.PI / 2 - slope);
      tube.translate(railX, midY, midZ);
      railParts.push(normalizeGeom(tube));

      if (aisleLedVisible) {
        const ledBar = new BoxGeometry(0.012, 0.01, Math.max(0.2, len - 0.12));
        ledBar.rotateX(-slope);
        ledBar.translate(railX, midY - 0.024, midZ);
        ledParts.push(normalizeGeom(ledBar));
      }

      // Mount posts or wall brackets every ~1.8 m along the run
      const postCount = Math.max(2, Math.round(len / 1.8) + 1);
      for (let p = 0; p < postCount; p++) {
        const t = postCount === 1 ? 0.5 : p / (postCount - 1);
        const pz = z0 + t * dz;
        const py = y0 + t * dy;
        if (wallMounted) {
          const bracket = new BoxGeometry(0.085, 0.022, 0.028);
          bracket.translate(railX + wallDir * 0.042, py - 0.02, pz);
          railParts.push(normalizeGeom(bracket));
        } else {
          const postH = railHeight;
          const post = new CylinderGeometry(0.017, 0.019, postH, 8);
          post.translate(railX, py - postH / 2, pz);
          railParts.push(normalizeGeom(post));
        }
      }
    }
  }

  if (railParts.length === 0) return null;
  const mergedRail = mergeGeometries(railParts, false);
  for (const p of railParts) p.dispose();
  if (!mergedRail) return null;
  track(mergedRail);

  const group = new Group();
  const railMat = track(new MeshStandardMaterial({ color: 0x1b1d26, roughness: 0.36, metalness: 0.72 }));
  group.add(new Mesh(mergedRail, railMat));

  if (ledParts.length > 0) {
    const mergedLed = mergeGeometries(ledParts, false);
    for (const p of ledParts) p.dispose();
    if (mergedLed) {
      track(mergedLed);
      const ledMat = track(new MeshBasicMaterial({ color: ledHex, toneMapped: false }));
      group.add(new Mesh(mergedLed, ledMat));
    }
  }
  return group;
}

/**
 * Recessed dark ceiling HVAC air diffusers + 4 architectural corner acoustic bass-trap columns (2 draw calls).
 */
export function buildCeilingAndCornerDetails(
  room: RoomScene,
  leftMargin: number,
  rightMargin: number,
  track: <T extends Disposable>(item: T) => T,
): Group {
  const group = new Group();
  const shellD = room.backWallZ - room.frontWallZ;
  const shellCenterX = (room.widthM + rightMargin - leftMargin) / 2;

  // Recessed dark louvered HVAC diffusers down the ceiling centerline
  const hvacCount = Math.max(2, Math.min(5, Math.round(shellD / 4.2)));
  const hvacParts: BufferGeometry[] = [];
  hvacParts.push(paintGeom(new BoxGeometry(0.58, 0.024, 0.58), 0x13141d));
  hvacParts.push(paintGeom(new BoxGeometry(0.46, 0.028, 0.46), 0x07080d));
  hvacParts.push(paintGeom(new BoxGeometry(0.32, 0.032, 0.32), 0x171924));
  const hvacGeom = mergeGeometries(hvacParts, false);
  for (const p of hvacParts) p.dispose();
  if (hvacGeom) {
    track(hvacGeom);
    const hvacMat = track(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.2, vertexColors: true }));
    const hvacMesh = track(new InstancedMesh(hvacGeom, hvacMat, hvacCount));
    const m = new Matrix4();
    for (let i = 0; i < hvacCount; i++) {
      const t = (i + 0.5) / hvacCount;
      const z = room.frontWallZ + 1.8 + t * Math.max(1.2, shellD - 3.0);
      m.makeTranslation(shellCenterX, room.ceilingY - 0.014, z);
      hvacMesh.setMatrixAt(i, m);
    }
    hvacMesh.instanceMatrix.needsUpdate = true;
    group.add(hvacMesh);
  }

  // 4 corner vertical acoustic bass-trap columns tucked cleanly into room corners
  const trapH = room.ceilingY;
  const trapGeom = track(new CylinderGeometry(0.24, 0.24, trapH, 3));
  const trapMat = track(new MeshStandardMaterial({ color: 0x0d0d14, roughness: 0.94, metalness: 0.02 }));
  const trapMesh = track(new InstancedMesh(trapGeom, trapMat, 4));
  const corners: [number, number, number][] = [
    [-leftMargin + 0.08, room.frontWallZ + 0.08, Math.PI / 4],
    [room.widthM + rightMargin - 0.08, room.frontWallZ + 0.08, (3 * Math.PI) / 4],
    [-leftMargin + 0.08, room.backWallZ - 0.08, -Math.PI / 4],
    [room.widthM + rightMargin - 0.08, room.backWallZ - 0.08, -(3 * Math.PI) / 4],
  ];
  const m = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const scl = new Vector3(1, 1, 1);
  const yAxis = new Vector3(0, 1, 0);
  corners.forEach(([x, z, rotY], i) => {
    q.setFromAxisAngle(yAxis, rotY);
    m.compose(pos.set(x, trapH / 2, z), q, scl);
    trapMesh.setMatrixAt(i, m);
  });
  trapMesh.instanceMatrix.needsUpdate = true;
  group.add(trapMesh);
  return group;
}

/**
 * Twin-head commercial emergency exit spotlight fixture mounted above an exit door.
 */
export function buildEmergencyLightUnit(track: <T extends Disposable>(item: T) => T): Group {
  const group = new Group();
  const bodyGeom = track(new BoxGeometry(0.06, 0.09, 0.24));
  const bodyMat = track(new MeshStandardMaterial({ color: 0x1b1e28, roughness: 0.55, metalness: 0.28 }));
  const body = new Mesh(bodyGeom, bodyMat);
  group.add(body);

  const lampGeom = track(new CylinderGeometry(0.026, 0.032, 0.06, 10));
  lampGeom.rotateZ(Math.PI / 2);
  const lampMat = track(new MeshStandardMaterial({ color: 0x2c3040, roughness: 0.4, metalness: 0.5 }));
  for (const dz of [-0.085, 0.085]) {
    const lamp = new Mesh(lampGeom, lampMat);
    lamp.position.set(0.035, 0.04, dz);
    lamp.rotation.y = dz < 0 ? 0.22 : -0.22;
    group.add(lamp);
  }
  const ledDotGeom = track(new SphereGeometry(0.009, 6, 6));
  const ledDotMat = track(new MeshBasicMaterial({ color: 0x22c55e, toneMapped: false }));
  const ledDot = new Mesh(ledDotGeom, ledDotMat);
  ledDot.position.set(0.034, 0, 0);
  group.add(ledDot);
  return group;
}

/**
 * Industrial 4DX wall wind-blower fans & upper strobe light pods mounted automatically in rooms containing 4DX chairs.
 */
export function build4dxWallProps(
  room: RoomScene,
  leftMargin: number,
  rightMargin: number,
  track: <T extends Disposable>(item: T) => T,
): Group | null {
  if (!room.seats.some((s) => s.style === "4dx")) return null;

  const shellD = room.backWallZ - room.frontWallZ;
  const fanPairs = Math.max(2, Math.min(4, Math.round(shellD / 4.4)));
  const count = fanPairs * 2;

  const parts: BufferGeometry[] = [];
  // Cylindrical turbine housing + concentric inner hub + protective shroud ring
  const drum = new CylinderGeometry(0.24, 0.24, 0.16, 16);
  drum.rotateZ(Math.PI / 2);
  parts.push(paintGeom(drum, 0x181a24));
  const hub = new CylinderGeometry(0.075, 0.075, 0.18, 12);
  hub.rotateZ(Math.PI / 2);
  parts.push(paintGeom(hub, 0x3b4256));
  // 4 fan blades
  for (let b = 0; b < 4; b++) {
    const blade = new BoxGeometry(0.02, 0.36, 0.065);
    blade.rotateX((b * Math.PI) / 4);
    blade.translate(0.03, 0, 0);
    parts.push(paintGeom(blade, 0x2d3344));
  }
  // Upper xenon strobe bar perched above fan
  const strobe = new BoxGeometry(0.11, 0.075, 0.28);
  strobe.translate(-0.02, 0.33, 0);
  parts.push(paintGeom(strobe, 0x252b3b));

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) return null;
  track(merged);

  const fanMat = track(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.52, vertexColors: true }));
  const fanMesh = track(new InstancedMesh(merged, fanMat, count));

  const strobeLensGeom = track(new BoxGeometry(0.02, 0.045, 0.22));
  const strobeLensMat = track(new MeshBasicMaterial({ color: 0x7dd3fc, toneMapped: false }));
  const strobeMesh = track(new InstancedMesh(strobeLensGeom, strobeLensMat, count));

  const m = new Matrix4();
  const leftQ = new Quaternion().setFromEuler(new Euler(0, 0, -0.22));
  const rightQ = new Quaternion().setFromEuler(new Euler(0, Math.PI, -0.22));
  const pos = new Vector3();
  const scl = new Vector3(1, 1, 1);

  for (let i = 0; i < fanPairs; i++) {
    const t = (i + 0.5) / fanPairs;
    const z = Math.max(2.0, room.frontWallZ + 2.2) + t * Math.max(1.2, room.depthM - 2.6);
    const y = Math.min(room.ceilingY - 0.65, 2.75 + t * room.maxFloorY);

    m.compose(pos.set(-leftMargin + 0.14, y, z), leftQ, scl);
    fanMesh.setMatrixAt(i * 2, m);
    m.compose(pos.set(-leftMargin + 0.2, y + 0.33, z), leftQ, scl);
    strobeMesh.setMatrixAt(i * 2, m);

    m.compose(pos.set(room.widthM + rightMargin - 0.14, y, z), rightQ, scl);
    fanMesh.setMatrixAt(i * 2 + 1, m);
    m.compose(pos.set(room.widthM + rightMargin - 0.2, y + 0.33, z), rightQ, scl);
    strobeMesh.setMatrixAt(i * 2 + 1, m);
  }
  fanMesh.instanceMatrix.needsUpdate = true;
  strobeMesh.instanceMatrix.needsUpdate = true;

  const group = new Group();
  group.add(fanMesh, strobeMesh);
  return group;
}

/**
 * Cinema snack combo (striped popcorn bucket + golden kernels + soda cup with straw) placed at the selected seat.
 */
export interface SnackPropRig {
  group: Group;
  placeOnSeat: (seat: SceneSeat | undefined, visible: boolean, seatPitchM: number) => void;
}

export function buildSnackPropRig(track: <T extends Disposable>(item: T) => T): SnackPropRig {
  const group = new Group();
  group.visible = false;

  // 1. Large cinema popcorn bucket (crimson base + crisp cream collar + generous golden buttered popcorn mound)
  const popParts: BufferGeometry[] = [];
  const tub = new CylinderGeometry(0.074, 0.052, 0.185, 14);
  tub.translate(0, 0.0925, 0);
  popParts.push(paintGeom(tub, 0xdc2626));
  const stripe = new CylinderGeometry(0.07, 0.058, 0.072, 14);
  stripe.translate(0, 0.1, 0);
  popParts.push(paintGeom(stripe, 0xfef3c7));
  const rim = new CylinderGeometry(0.077, 0.074, 0.014, 14);
  rim.translate(0, 0.184, 0);
  popParts.push(paintGeom(rim, 0xfef9c3));
  const kernels: [number, number, number, number][] = [
    [0, 0.21, 0, 0.044],
    [0.038, 0.2, 0.02, 0.034],
    [-0.036, 0.202, 0.024, 0.035],
    [0.024, 0.198, -0.032, 0.033],
    [-0.028, 0.197, -0.026, 0.034],
    [0.046, 0.188, -0.01, 0.028],
    [-0.044, 0.19, -0.008, 0.028],
  ];
  for (const [kx, ky, kz, kr] of kernels) {
    const k = new SphereGeometry(kr, 8, 7);
    k.translate(kx, ky, kz);
    popParts.push(paintGeom(k, 0xfde047));
  }
  const popGeom = mergeGeometries(popParts, false);
  for (const p of popParts) p.dispose();

  // 2. Tall cinema soda cup (bright cobalt cup + white rim & dome lid + crimson straw)
  const cupParts: BufferGeometry[] = [];
  const cup = new CylinderGeometry(0.045, 0.033, 0.185, 14);
  cup.translate(0, 0.0925, 0);
  cupParts.push(paintGeom(cup, 0x2563eb));
  const lid = new CylinderGeometry(0.049, 0.048, 0.02, 14);
  lid.translate(0, 0.19, 0);
  cupParts.push(paintGeom(lid, 0xf8fafc));
  const straw = new CylinderGeometry(0.0055, 0.0055, 0.105, 8);
  straw.rotateZ(-0.18);
  straw.translate(0.01, 0.24, 0);
  cupParts.push(paintGeom(straw, 0xf43f5e));
  const cupGeom = mergeGeometries(cupParts, false);
  for (const p of cupParts) p.dispose();

  const snackMat = track(
    new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x241a10,
      emissiveIntensity: 0.45,
      roughness: 0.5,
      metalness: 0.06,
      vertexColors: true,
    }),
  );
  const popMesh = popGeom ? new Mesh(track(popGeom), snackMat) : null;
  const cupMesh = cupGeom ? new Mesh(track(cupGeom), snackMat) : null;
  if (popMesh) group.add(popMesh);
  if (cupMesh) group.add(cupMesh);

  return {
    group,
    placeOnSeat: (seat, visible, seatPitchM) => {
      if (!seat || !visible || seat.broken) {
        group.visible = false;
        return;
      }
      group.visible = true;
      group.position.set(seat.x, seat.floorY, seat.z);
      group.rotation.y = seat.yaw;

      const w = seat.span * seatPitchM * 0.98;
      if (seat.style === "bed") {
        if (seat.span === 2) {
          const railX = (w - 0.092) / 2;
          cupMesh?.position.set(railX, 0.65, -0.11);
          popMesh?.position.set(-railX, 0.678, 0.05);
        } else {
          const caddyX = w / 2 - 0.048;
          cupMesh?.position.set(caddyX, 0.45, -0.005);
          popMesh?.position.set(caddyX, 0.48, 0.18);
        }
      } else if (seat.style === "recliner") {
        if (seat.span === 2) {
          const innerW = w - 0.15;
          const cupX = innerW / 2 - 0.048;
          cupMesh?.position.set(cupX, 0.535, -0.27);
          popMesh?.position.set(-innerW * 0.28, 0.666, -0.33);
        } else {
          const armX = (w - 0.094) / 2;
          cupMesh?.position.set(armX, 0.535, -0.255);
          popMesh?.position.set(-0.095, 0.658, -0.325);
        }
      } else if (seat.span === 2) {
        const innerW = w - 0.15;
        const cupX = innerW / 2 - 0.048;
        cupMesh?.position.set(cupX, 0.54, -0.24);
        popMesh?.position.set(-cupX, 0.592, -0.12);
      } else {
        const armW = seat.style === "standard" ? 0.058 : 0.072;
        const armX = (w - armW) / 2;
        const seatD = seat.style === "standard" ? 0.48 : 0.52;
        const cupY = seat.style === "4dx" ? 0.555 : seat.style === "vip" ? 0.545 : 0.525;
        const armTopY = seat.style === "4dx" ? 0.625 : seat.style === "vip" ? 0.615 : 0.59;
        cupMesh?.position.set(armX - 0.01, cupY, -seatD / 2 - 0.032);
        popMesh?.position.set(-armX + 0.01, armTopY, -seatD / 2 + 0.06);
      }
    },
  };
}

/**
 * Interactive 3D Sightline Laser & Head-Clearance Overlay:
 * Draws top & bottom rays from the selected seat's eye to the cinema screen and checks clearance over the row ahead.
 */
export interface SightlineOverlay {
  group: Group;
  update: (
    on: boolean,
    mode: "orbit" | "seat",
    selected: SceneSeat | undefined,
    viewerHeightCm: number,
    frontHeightCm: number,
  ) => void;
  dispose: () => void;
}

export function buildSightlineOverlay(room: RoomScene): SightlineOverlay {
  const group = new Group();
  group.visible = false;

  const linePositions = new Float32Array(12 * 3); // 6 segments = 12 vertices
  const lineGeom = new BufferGeometry();
  lineGeom.setAttribute("position", new BufferAttribute(linePositions, 3));
  const lineMat = new LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.92, toneMapped: false });
  const lines = new LineSegments(lineGeom, lineMat);
  lines.renderOrder = 10;

  const fanPositions = new Float32Array(3 * 3); // 1 triangle (eye -> screenTop -> screenBottom)
  const fanGeom = new BufferGeometry();
  fanGeom.setAttribute("position", new BufferAttribute(fanPositions, 3));
  const fanMat = new MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.14,
    side: DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const fanMesh = new Mesh(fanGeom, fanMat);
  fanMesh.renderOrder = 9;

  const eyeDotGeom = new SphereGeometry(0.075, 10, 8);
  const eyeDotMat = new MeshBasicMaterial({ color: 0x22c55e, toneMapped: false });
  const eyeDot = new Mesh(eyeDotGeom, eyeDotMat);
  eyeDot.renderOrder = 11;

  group.add(fanMesh, lines, eyeDot);

  const byRow = new Map<number, SceneSeat[]>();
  for (const s of room.seats) {
    const arr = byRow.get(s.rowIndex);
    if (arr) arr.push(s);
    else byRow.set(s.rowIndex, [s]);
  }

  return {
    group,
    update: (on, mode, selected, viewerHeightCm, frontHeightCm) => {
      if (!on || mode !== "orbit" || !selected) {
        group.visible = false;
        return;
      }
      const eye = room.eyeOf(selected.code, viewerHeightCm);
      const metrics = room.viewMetricsOf(selected.code, viewerHeightCm);
      if (!eye || !metrics) {
        group.visible = false;
        return;
      }

      const topX = room.screen.centreX;
      const topY = room.screen.topY;
      const topZ = room.screen.topZ + 0.04;
      const botX = room.screen.centreX;
      const botY = room.screen.bottom;
      const botZ = room.screen.bottomZ + 0.04;
      const leftX = room.screen.centreX - room.screen.width / 2;
      const rightX = room.screen.centreX + room.screen.width / 2;
      const midY = room.screen.centerY;
      const midZ = room.screen.centerZ + 0.04;

      // Check front-row head obstruction against the lower sightline ray to screen bottom
      let blocked = false;
      const frontSeats = byRow.get(selected.rowIndex - 1);
      if (frontSeats && frontSeats.length > 0) {
        let nearest = frontSeats[0];
        let bestDx = Math.abs(nearest.x - eye.x);
        for (let i = 1; i < frontSeats.length; i++) {
          const dx = Math.abs(frontSeats[i].x - eye.x);
          if (dx < bestDx) {
            bestDx = dx;
            nearest = frontSeats[i];
          }
        }
        if (bestDx < room.seatPitchM * 0.72 && eye.z > nearest.z && nearest.z > botZ) {
          const t = (eye.z - nearest.z) / Math.max(0.1, eye.z - botZ);
          const rayYAtFront = eye.y + (botY - eye.y) * t;
          const frontCrownY =
            nearest.floorY +
            (nearest.style === "bed" ? -0.16 : 0) +
            (sittingEyeHeightM(frontHeightCm) - EYE_HEIGHT_M) +
            EYE_HEIGHT_M +
            HEAD_ABOVE_EYE_M -
            room.eyeDropM;
          if (frontCrownY > rayYAtFront + 0.01) blocked = true;
        }
      }

      const hex = blocked ? 0xef4444 : metrics.neckStrain ? 0xf59e0b : 0x22c55e;
      lineMat.color.setHex(hex);
      fanMat.color.setHex(hex);
      eyeDotMat.color.setHex(hex);

      // 4 rays from eye to screen top/bottom/left/right + vertical screen centerline + horizontal screen centerline
      const segs = [
        eye.x, eye.y, eye.z, topX, topY, topZ,
        eye.x, eye.y, eye.z, botX, botY, botZ,
        eye.x, eye.y, eye.z, leftX, midY, midZ,
        eye.x, eye.y, eye.z, rightX, midY, midZ,
        topX, topY, topZ, botX, botY, botZ,
        leftX, midY, midZ, rightX, midY, midZ,
      ];
      linePositions.set(segs);
      lineGeom.attributes.position.needsUpdate = true;
      lineGeom.computeBoundingSphere();

      fanPositions.set([eye.x, eye.y, eye.z, topX, topY, topZ, botX, botY, botZ]);
      fanGeom.attributes.position.needsUpdate = true;
      fanGeom.computeBoundingSphere();

      eyeDot.position.set(eye.x, eye.y, eye.z);
      group.visible = true;
    },
    dispose: () => {
      lineGeom.dispose();
      lineMat.dispose();
      fanGeom.dispose();
      fanMat.dispose();
      eyeDotGeom.dispose();
      eyeDotMat.dispose();
    },
  };
}

/**
 * Floating friend name-tag badges above assigned seats in group appointment planning (1 atlas draw call).
 */
export interface HolderTagsOverlay {
  group: Group;
  update: (holders: Map<string, string> | undefined, selectedCode: string | null, mode: "orbit" | "seat") => void;
  dispose: () => void;
}

export function buildHolderTagsOverlay(room: RoomScene): HolderTagsOverlay {
  const group = new Group();
  const disposables: Disposable[] = [];
  const seatByCode = new Map(room.seats.map((s) => [s.code, s]));

  const clear = () => {
    group.clear();
    for (const d of disposables) d.dispose();
    disposables.length = 0;
  };

  return {
    group,
    update: (holders, selectedCode, mode) => {
      clear();
      if (!holders || holders.size === 0) return;

      const entries: { seat: SceneSeat; label: string }[] = [];
      for (const [code, label] of holders) {
        if (!label.trim()) continue;
        if (mode === "seat" && code === selectedCode) continue;
        const seat = seatByCode.get(code);
        if (seat) entries.push({ seat, label: label.trim().slice(0, 12) });
      }
      if (entries.length === 0) return;

      const cols = Math.ceil(Math.sqrt(entries.length));
      const rows = Math.ceil(entries.length / cols);
      const cellW = 128;
      const cellH = 48;
      const canvas = document.createElement("canvas");
      canvas.width = cols * cellW;
      canvas.height = rows * cellH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      entries.forEach(({ label }, idx) => {
        const cx = idx % cols;
        const cy = Math.floor(idx / cols);
        const x0 = cx * cellW + 6;
        const y0 = cy * cellH + 6;
        const w = cellW - 12;
        const h = cellH - 12;
        const r = h / 2;

        ctx.beginPath();
        ctx.roundRect(x0, y0, w, h, r);
        ctx.fillStyle = "rgba(14, 165, 233, 0.92)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "700 20px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x0 + w / 2, y0 + h / 2 + 1, w - 16);
      });

      const tex = new CanvasTexture(canvas);
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter;
      tex.magFilter = LinearFilter;
      disposables.push(tex);

      const parts: BufferGeometry[] = [];
      const mat = new Matrix4();
      const q = new Quaternion();
      const pos = new Vector3();
      const scl = new Vector3(1, 1, 1);
      const yAxis = new Vector3(0, 1, 0);

      entries.forEach(({ seat }, idx) => {
        const cx = idx % cols;
        const cy = Math.floor(idx / cols);
        const u0 = cx / cols;
        const u1 = (cx + 1) / cols;
        const v1 = 1 - cy / rows;
        const v0 = 1 - (cy + 1) / rows;

        const g = new PlaneGeometry(0.46, 0.175);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
        }
        q.setFromAxisAngle(yAxis, seat.yaw);
        mat.compose(pos.set(seat.x, seat.floorY + 1.32, seat.z + 0.04), q, scl);
        g.applyMatrix4(mat);
        parts.push(normalizeGeom(g));
      });

      const merged = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      if (!merged) return;
      disposables.push(merged);

      const meshMat = new MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        toneMapped: false,
      });
      disposables.push(meshMat);
      const mesh = new Mesh(merged, meshMat);
      mesh.renderOrder = 12;
      group.add(mesh);
    },
    dispose: clear,
  };
}

export interface SeatFlagsOverlay {
  group: Group;
  update: (selectedCode: string | null, mode: "orbit" | "seat") => void;
  dispose: () => void;
}

function createFlagBadgeAtlas(): CanvasTexture | null {
  const cell = 96;
  const canvas = document.createElement("canvas");
  canvas.width = cell * 3;
  canvas.height = cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Slot 0: Broken (crimson circle + bold white X)
  {
    const cx = cell * 0.5;
    const cy = cell * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy - 15);
    ctx.lineTo(cx + 15, cy + 15);
    ctx.moveTo(cx + 15, cy - 15);
    ctx.lineTo(cx - 15, cy + 15);
    ctx.stroke();
  }

  // Slot 1: Obstructed (amber rounded warning triangle + dark exclamation)
  {
    const cx = cell * 1.5;
    const cy = cell * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 38);
    ctx.lineTo(cx + 38, cy + 32);
    ctx.lineTo(cx - 38, cy + 32);
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.stroke();
    ctx.fillStyle = "#18181b";
    ctx.font = "900 44px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", cx, cy + 9);
  }

  // Slot 2: Recommended (emerald circle + crisp white star/check)
  {
    const cx = cell * 2.5;
    const cy = cell * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fillStyle = "#10b981";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.stroke();
    // Crisp 5-point star matching "recommended"
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 22 : 10;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

/**
 * Renders 3D visual indicators for all three auditorium seat flags (`broken`, `obstructed`, `recommended`):
 * - Crisp icon badges above flagged seats (red X, amber !, emerald star; 1 draw call total).
 * - Physical diagonal red-white "Out of Order" cross ribbons across every `broken` backrest (1 draw call total).
 */
export function buildSeatFlagsOverlay(room: RoomScene): SeatFlagsOverlay {
  const group = new Group();
  const disposables: Disposable[] = [];
  const flaggedSeats = room.seats.filter((s) => s.broken || s.obstructed || s.recommended);

  let badgeMesh: Mesh | null = null;
  let tapeMesh: Mesh | null = null;
  let lastHiddenCode: string | null | undefined = undefined;
  let badgeAtlasTex: CanvasTexture | null = null;
  let badgeMat: MeshBasicMaterial | null = null;
  let tapeMat: MeshStandardMaterial | null = null;

  if (flaggedSeats.length > 0) {
    badgeAtlasTex = createFlagBadgeAtlas();
    if (badgeAtlasTex) {
      disposables.push(badgeAtlasTex);
      badgeMat = new MeshBasicMaterial({
        map: badgeAtlasTex,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        toneMapped: false,
      });
      disposables.push(badgeMat);
    }
    tapeMat = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.08,
      vertexColors: true,
    });
    disposables.push(tapeMat);
  }

  const yAxis = new Vector3(0, 1, 0);
  const tilt = (room.reclineDeg * Math.PI) / 180;

  const rebuildMeshes = (hiddenSeatCode: string | null) => {
    if (badgeMesh) {
      group.remove(badgeMesh);
      badgeMesh.geometry.dispose();
      badgeMesh = null;
    }
    if (tapeMesh) {
      group.remove(tapeMesh);
      tapeMesh.geometry.dispose();
      tapeMesh = null;
    }
    if (flaggedSeats.length === 0) return;

    const badgeParts: BufferGeometry[] = [];
    const tapeParts: BufferGeometry[] = [];
    const mat = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scl = new Vector3(1, 1, 1);

    for (const seat of flaggedSeats) {
      if (hiddenSeatCode && seat.code === hiddenSeatCode) continue;

      const slots: number[] = [];
      if (seat.broken) slots.push(0);
      if (seat.obstructed) slots.push(1);
      if (seat.recommended) slots.push(2);

      const baseY = seat.floorY + (seat.style === "bed" ? 0.96 : 1.2);
      const badgeSize = 0.2;
      const spacing = 0.21;
      q.setFromAxisAngle(yAxis, seat.yaw);

      slots.forEach((slot, idx) => {
        const offsetX = (idx - (slots.length - 1) / 2) * spacing;
        const g = new PlaneGeometry(badgeSize, badgeSize);
        const u0 = slot / 3;
        const u1 = (slot + 1) / 3;
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i));
        }
        const wx = seat.x + Math.cos(seat.yaw) * offsetX;
        const wz = seat.z - Math.sin(seat.yaw) * offsetX;
        mat.compose(pos.set(wx, baseY, wz + 0.06), q, scl);
        g.applyMatrix4(mat);
        badgeParts.push(normalizeGeom(g));
      });

      // Physical diagonal X hazard ribbons laid across the front backrest of broken chairs
      if (seat.broken) {
        const spanW = seat.span * room.seatPitchM * 0.72;
        const ribbonLen = Math.min(0.62, Math.hypot(spanW * 0.78, 0.42));
        const backTilt = seat.style === "bed" ? 0.36 : seat.style === "recliner" ? Math.max(tilt, 0.32) : tilt;
        const ribbonY = seat.style === "bed" ? 0.6 : 0.76;
        const ribbonZ = seat.style === "bed" ? 0.22 : 0.16;
        for (const diag of [-0.62, 0.62]) {
          const strip = new BoxGeometry(ribbonLen, 0.042, 0.018);
          strip.rotateZ(diag);
          strip.rotateX(backTilt);
          strip.translate(0, ribbonY, ribbonZ);
          if (seat.yaw !== 0) strip.rotateY(seat.yaw);
          strip.translate(seat.x, seat.floorY, seat.z);
          tapeParts.push(paintGeom(strip, 0xdc2626));
        }
      }
    }

    if (badgeParts.length > 0 && badgeMat) {
      const merged = mergeGeometries(badgeParts, false);
      for (const p of badgeParts) p.dispose();
      if (merged) {
        badgeMesh = new Mesh(merged, badgeMat);
        badgeMesh.renderOrder = 13;
        group.add(badgeMesh);
      }
    }
    if (tapeParts.length > 0 && tapeMat) {
      const mergedTape = mergeGeometries(tapeParts, false);
      for (const p of tapeParts) p.dispose();
      if (mergedTape) {
        tapeMesh = new Mesh(mergedTape, tapeMat);
        tapeMesh.renderOrder = 4;
        group.add(tapeMesh);
      }
    }
  };

  return {
    group,
    update: (selectedCode, mode) => {
      const hidden = mode === "seat" ? selectedCode : null;
      if (hidden === lastHiddenCode) return;
      lastHiddenCode = hidden;
      rebuildMeshes(hidden);
    },
    dispose: () => {
      if (badgeMesh) badgeMesh.geometry.dispose();
      if (tapeMesh) tapeMesh.geometry.dispose();
      group.clear();
      for (const d of disposables) d.dispose();
      disposables.length = 0;
    },
  };
}

export interface HighlightRingsOverlay {
  group: Group;
  update: (codes: Set<string> | undefined, selectedCode: string | null, mode: "orbit" | "seat") => void;
  dispose: () => void;
}

/** Glowing floor outline rings for multi-selected seats in the Admin Seats tab (1 InstancedMesh draw call). */
export function buildHighlightRingsOverlay(room: RoomScene): HighlightRingsOverlay {
  const group = new Group();
  const ringGeom = new RingGeometry(0.22, 0.285, 22);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new MeshBasicMaterial({
    color: 0xec4899,
    side: DoubleSide,
    transparent: true,
    opacity: 0.92,
    toneMapped: false,
  });
  const mesh = new InstancedMesh(ringGeom, ringMat, Math.max(1, room.seats.length));
  mesh.count = 0;
  mesh.visible = false;
  group.add(mesh);

  const m = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const scl = new Vector3();
  const yAxis = new Vector3(0, 1, 0);

  return {
    group,
    update: (codes, selectedCode, mode) => {
      if (!codes || codes.size === 0 || room.seats.length === 0) {
        mesh.count = 0;
        mesh.visible = false;
        return;
      }
      let count = 0;
      for (const seat of room.seats) {
        if (!codes.has(seat.code)) continue;
        if (mode === "seat" && seat.code === selectedCode) continue;
        q.setFromAxisAngle(yAxis, seat.yaw);
        m.compose(
          pos.set(seat.x, seat.floorY + 0.028, seat.z),
          q,
          scl.set(seat.span === 2 ? 1.72 : 1.05, 1, seat.style === "bed" ? 1.45 : 1.05),
        );
        mesh.setMatrixAt(count++, m);
      }
      mesh.count = count;
      mesh.visible = count > 0;
      if (count > 0) mesh.instanceMatrix.needsUpdate = true;
    },
    dispose: () => {
      ringGeom.dispose();
      ringMat.dispose();
      mesh.dispose();
    },
  };
}

/**
 * Composites a clean shareable cinema POV postcard PNG from the live WebGL canvas + metadata footer.
 * Supports YouTube depth-cutout frames by painting a dark backdrop (and optional thumbnail) behind the WebGL buffer.
 */
export async function composeRoomSnapshot(
  glCanvas: HTMLCanvasElement,
  renderNow: () => void,
  meta?: Room3DSnapshotMeta,
): Promise<Blob | null> {
  renderNow();
  const w = Math.max(640, glCanvas.width || 1280);
  const h = Math.max(480, glCanvas.height || 960);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  // Fill dark theater backdrop (important when WebGL alpha cutouts punch through for YouTube mode)
  ctx.fillStyle = "#08090f";
  ctx.fillRect(0, 0, w, h);

  if (meta?.youtubeThumbnailUrl) {
    try {
      const thumb = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = meta.youtubeThumbnailUrl!;
      });
      if (thumb && thumb.naturalWidth > 0) {
        const scale = Math.max(w / thumb.naturalWidth, h / thumb.naturalHeight);
        const dw = thumb.naturalWidth * scale;
        const dh = thumb.naturalHeight * scale;
        ctx.drawImage(thumb, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }
    } catch {
      // Ignore CORS errors on external thumbnails.
    }
  }

  ctx.drawImage(glCanvas, 0, 0, w, h);

  // Subtle dark-glass cinematic footer bar with room/seat details
  const padX = Math.round(w * 0.032);
  const barH = Math.round(Math.max(66, h * 0.11));
  const grad = ctx.createLinearGradient(0, h - barH * 1.4, 0, h);
  grad.addColorStop(0, "rgba(6, 7, 12, 0)");
  grad.addColorStop(0.45, "rgba(6, 7, 12, 0.78)");
  grad.addColorStop(1, "rgba(6, 7, 12, 0.94)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - barH * 1.4, w, barH * 1.4);

  const title = meta?.title?.trim() || "SeatMate 3D";
  const subtitle = meta?.subtitle?.trim() || "";
  const badge = meta?.badge?.trim() || "";

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  const titlePx = Math.round(Math.max(18, Math.min(34, h * 0.036)));
  ctx.font = `700 ${titlePx}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(title, padX, h - barH * (subtitle ? 0.56 : 0.42), w - padX * 2 - (badge ? 180 : 0));

  if (subtitle) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    const subPx = Math.round(Math.max(13, Math.min(22, h * 0.024)));
    ctx.font = `500 ${subPx}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(subtitle, padX, h - barH * 0.24, w - padX * 2 - (badge ? 180 : 0));
  }

  if (badge) {
    const badgePx = Math.round(Math.max(14, Math.min(22, h * 0.025)));
    ctx.font = `700 ${badgePx}px system-ui, -apple-system, sans-serif`;
    const tw = ctx.measureText(badge).width;
    const pillW = tw + padX * 1.1;
    const pillH = badgePx * 1.9;
    const px = w - padX - pillW;
    const py = h - barH * 0.44 - pillH / 2;
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, pillH / 2);
    ctx.fillStyle = "rgba(244, 63, 94, 0.9)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(badge, px + pillW / 2, py + pillH / 2 + 1);
  }

  return new Promise<Blob | null>((resolve) => out.toBlob((blob) => resolve(blob), "image/png"));
}
