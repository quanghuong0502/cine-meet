import { describe, expect, it } from "vitest";
import { defaultLayoutConfig } from "./config";
import { cinemaDimensionDefaultsSchema, DEFAULT_CINEMA_DIMENSIONS } from "./dimensions";
import { generateGrid } from "./generate";
import { buildRoomScene, DEFAULT_SEAT_3D_COLOR, REAL_AISLE_WIDTH_M, REAL_HORIZONTAL_AISLE_WIDTH_M } from "./scene";
import {
  buildScoreContext,
  EYE_HEIGHT_M,
  ROW_PITCH_BY_SPACING,
  rowDistanceM,
  SCREEN_ASPECT,
  SCREEN_ASPECT_BY_SHAPE,
  SCREEN_BOTTOM_BY_MOUNT,
  scoreBreakdown,
  SEAT_PITCH_M,
  STEP_HEIGHT_M,
  scoreSeats,
} from "@/services/seat-score";
import type { LayoutConfig, SeatTypeInfo } from "./types";

const TYPES: SeatTypeInfo[] = [
  { id: "std", name: "Standard", capacity: 1, style: "standard" },
  { id: "vip", name: "VIP", capacity: 1, style: "vip" },
  { id: "couple", name: "Couple", capacity: 2, style: "recliner" },
];

function makeRoom(patch: Partial<LayoutConfig> = {}) {
  const cfg: LayoutConfig = { ...defaultLayoutConfig("std"), rows: 5, cols: 8, ...patch };
  const { seats, geometry } = generateGrid(cfg, TYPES);
  const scored = scoreSeats(seats, cfg, geometry);
  const scene = buildRoomScene(
    scored,
    geometry,
    {
      stadiumFromRow: cfg.stadiumFromRow,
      stepsPerRow: cfg.stepsPerRow,
      screenDistance: cfg.screen.distance,
      screenShape: cfg.screen.shape,
      screenMount: cfg.screen.mount,
      screenTilt: cfg.screen.tilt,
      screenCurved: cfg.screen.curved,
      seatRecline: cfg.seatRecline,
      rowCurve: cfg.rowCurve,
      seatStagger: cfg.seatStagger,
      rowPitch: cfg.rowPitch,
      dimensions: cfg.dimensions,
    },
    TYPES.map((t) => ({ id: t.id, color: "#cc5577", style: t.style })),
  );
  return { cfg, scored, geometry, scene };
}

describe("buildRoomScene", () => {
  it("converts seat coordinates and screen size to metres using calibrated cinema constants", () => {
    const { cfg, scored, geometry, scene } = makeRoom();
    const a1 = scored.find((s) => s.code === "A1")!;
    const sA1 = scene.seats.find((s) => s.code === "A1")!;
    const screenW = (geometry.screen.x2 - geometry.screen.x1) * SEAT_PITCH_M;
    expect(sA1.x).toBeCloseTo(a1.x * SEAT_PITCH_M);
    expect(sA1.z).toBeCloseTo(rowDistanceM(a1.y, geometry.firstRowY, cfg.screen.distance, screenW, cfg.rowPitch));
    expect(scene.screen.width).toBeCloseTo(screenW);
    expect(scene.screen.height).toBeCloseTo(scene.screen.width / SCREEN_ASPECT);
  });

  it("uses dedicated 3D seat color (`color3d`) and defaults to cinema red (`#8E1E36`) when unset", () => {
    const cfg: LayoutConfig = {
      ...defaultLayoutConfig("std"),
      rows: 2,
      cols: 4,
      overrides: [{ row: "B", cols: [1, 2, 3, 4], type: "vip" }],
    };
    const { seats, geometry } = generateGrid(cfg, TYPES);
    const scored = scoreSeats(seats, cfg, geometry);
    const scene = buildRoomScene(
      scored,
      geometry,
      { stadiumFromRow: 1, stepsPerRow: 1 },
      [
        { id: "std", color: "#5B6B8C", color3d: null, style: "standard" },
        { id: "vip", color: "#5B6B8C", color3d: "#B45309", style: "vip" },
      ],
    );
    expect(scene.seats.find((s) => s.row === "A")?.typeColor).toBe(DEFAULT_SEAT_3D_COLOR);
    expect(scene.seats.find((s) => s.row === "B")?.typeColor).toBe("#B45309");
  });

  it("propagates broken, obstructed, and recommended seat flags cleanly into SceneSeat", () => {
    const { scene } = makeRoom({
      overrides: [
        { row: "B", cols: [1], flags: ["broken"] },
        { row: "B", cols: [2], flags: ["obstructed"] },
        { row: "B", cols: [3], flags: ["recommended"] },
      ],
    });
    expect(scene.seats.find((s) => s.code === "B1")).toMatchObject({ broken: true, obstructed: false, recommended: false });
    expect(scene.seats.find((s) => s.code === "B2")).toMatchObject({ broken: false, obstructed: true, recommended: false });
    expect(scene.seats.find((s) => s.code === "B3")).toMatchObject({ broken: false, obstructed: false, recommended: true });
  });

  it("raises row floors according to stadiumFromRow and stepsPerRow (15 cm per step)", () => {
    const { scene } = makeRoom({ stadiumFromRow: 3, stepsPerRow: 3 });
    expect(scene.rowFloors[0].height).toBe(0);
    expect(scene.rowFloors[1].height).toBe(0);
    expect(scene.rowFloors[2].height).toBeCloseTo(3 * STEP_HEIGHT_M);
    expect(scene.rowFloors[4].height).toBeCloseTo(9 * STEP_HEIGHT_M);

    // With `stadiumFromRow = 1`, row A stays flush on the front ground floor (0 m) and stepping rises from row B upward.
    const fromRow1 = makeRoom({ stadiumFromRow: 1, stepsPerRow: 2 }).scene;
    expect(fromRow1.rowFloors[0].height).toBe(0);
    expect(fromRow1.rowFloors[1].height).toBeCloseTo(2 * STEP_HEIGHT_M);
    expect(fromRow1.rowFloors[4].height).toBeCloseTo(8 * STEP_HEIGHT_M);
  });

  it("computes eye height by viewer stature and respects scope/square/high/curved screen", () => {
    const { scene } = makeRoom({
      stadiumFromRow: 2,
      stepsPerRow: 2,
      screen: { positionPct: 50, widthPct: 80, distance: "medium", shape: "square", mount: "high", curved: true },
    });
    expect(scene.screen.height).toBeCloseTo(scene.screen.width / SCREEN_ASPECT_BY_SHAPE.square);
    expect(scene.screen.bottom).toBe(SCREEN_BOTTOM_BY_MOUNT.high);
    expect(scene.screen.curved).toBe(true);
    expect(scene.screen.curveDepth).toBeGreaterThan(0);

    const scope = makeRoom({
      screen: { positionPct: 50, widthPct: 80, distance: "medium", shape: "scope" },
    }).scene;
    expect(scope.screen.height).toBeCloseTo(scope.screen.width / SCREEN_ASPECT_BY_SHAPE.scope);

    const c4 = scene.seats.find((s) => s.code === "C4")!;
    const eye170 = scene.eyeOf("C4", 170)!;
    const eye155 = scene.eyeOf("C4", 155)!;
    const eye185 = scene.eyeOf("C4", 185)!;
    expect(eye170.y).toBeCloseTo(c4.floorY + EYE_HEIGHT_M);
    expect(eye155.y).toBeLessThan(eye170.y);
    expect(eye185.y).toBeGreaterThan(eye170.y);
  });

  it("widens vertical aisles to realistic building-code width in 3D", () => {
    const { scene } = makeRoom({
      cols: 8,
      aisles: { verticalAfterCols: [4], horizontalAfterRows: [] },
    });
    const a4 = scene.seats.find((s) => s.code === "A4")!;
    const a5 = scene.seats.find((s) => s.code === "A5")!;
    // Gap between seat centres across an aisle = 1 seat pitch + REAL_AISLE_WIDTH_M
    expect(a5.x - a4.x).toBeCloseTo(SEAT_PITCH_M + REAL_AISLE_WIDTH_M);
  });

  it("offsets alternating rows by half a seat pitch when staggered and respects 4-tier rowPitch", () => {
    const staggered = makeRoom({ seatStagger: "staggered", rowPitch: "vip" });
    const a4 = staggered.scene.seats.find((s) => s.code === "A4")!;
    const b4 = staggered.scene.seats.find((s) => s.code === "B4")!;
    expect(Math.abs(b4.x - a4.x)).toBeCloseTo(SEAT_PITCH_M * 0.5);
    expect(b4.z - a4.z).toBeCloseTo(ROW_PITCH_BY_SPACING.vip);

    const bed = makeRoom({ rowPitch: "bed" });
    expect(bed.scene.rowPitchM).toBe(ROW_PITCH_BY_SPACING.bed);

    // Staggered rows soften sightline loss on a flat floor compared to aligned rows.
    const flatAligned = makeRoom({ rows: 8, cols: 12, stadiumFromRow: null, seatStagger: "aligned" });
    const flatStaggered = makeRoom({ rows: 8, cols: 12, stadiumFromRow: null, seatStagger: "staggered" });
    expect(flatStaggered.scored.find((s) => s.code === "F6")!.score).toBeGreaterThan(
      flatAligned.scored.find((s) => s.code === "F6")!.score,
    );
  });

  it("curves outer seats slightly forward and inward when rowCurve is curved", () => {
    const { scene } = makeRoom({ rowCurve: "curved" });
    const mid = scene.seats.find((s) => s.code === "C4")!;
    const leftEdge = scene.seats.find((s) => s.code === "C1")!;
    const rightEdge = scene.seats.find((s) => s.code === "C8")!;
    expect(leftEdge.z).toBeLessThan(mid.z);
    expect(rightEdge.z).toBeLessThan(mid.z);
    expect(leftEdge.yaw).toBeGreaterThan(0);
    expect(rightEdge.yaw).toBeLessThan(0);
  });

  it("finds visual neighbours in all four directions", () => {
    const { scene } = makeRoom();
    expect(scene.neighbourOf("C4", "left")).toBe("C3");
    expect(scene.neighbourOf("C4", "right")).toBe("C5");
    expect(scene.neighbourOf("C4", "front")).toBe("B4");
    expect(scene.neighbourOf("C4", "back")).toBe("D4");
    expect(scene.neighbourOf("A1", "left")).toBeNull();
    expect(scene.neighbourOf("A1", "front")).toBeNull();
  });

  it("syncs seat-score with screen shape, mount, and seat recline", () => {
    const standard = makeRoom({ rows: 8, cols: 14, stadiumFromRow: 2, stepsPerRow: 2 });
    const highSquare = makeRoom({
      rows: 8,
      cols: 14,
      stadiumFromRow: 2,
      stepsPerRow: 2,
      screen: { positionPct: 50, widthPct: 85, distance: "near", shape: "square", mount: "high" },
    });
    const highSquareReclined = makeRoom({
      rows: 8,
      cols: 14,
      stadiumFromRow: 2,
      stepsPerRow: 2,
      screen: { positionPct: 50, widthPct: 85, distance: "near", shape: "square", mount: "high" },
      seatRecline: "deep",
    });
    const flatLow = makeRoom({
      rows: 8,
      cols: 14,
      stadiumFromRow: null,
      screen: { positionPct: 50, widthPct: 85, distance: "medium", mount: "low" },
    });
    const flatHigh = makeRoom({
      rows: 8,
      cols: 14,
      stadiumFromRow: null,
      screen: { positionPct: 50, widthPct: 85, distance: "medium", mount: "high" },
    });
    const score = (list: typeof standard.scored, code: string) => list.find((s) => s.code === code)!.score;
    // Higher + taller screen hurts front/near-front neck angle in a stadium room.
    expect(score(highSquare.scored, "A7")).toBeLessThan(score(standard.scored, "A7"));
    // Deep recline softens the neck penalty when looking up at the high screen.
    expect(score(highSquareReclined.scored, "A7")).toBeGreaterThan(score(highSquare.scored, "A7"));
    // On a flat floor, a low screen is more easily blocked by heads in front than a high screen.
    expect(score(flatLow.scored, "F7")).toBeLessThan(score(flatHigh.scored, "F7"));
  });

  it("supports both Tier 1 system defaults and Tier 2 per-room dimension overrides", () => {
    const customDefaults = {
      ...DEFAULT_CINEMA_DIMENSIONS,
      seatPitchM: 0.65,
      stepHeightM: 0.2,
      aisleWidthM: 1.5,
      rowPitch: { ...DEFAULT_CINEMA_DIMENSIONS.rowPitch, standard: 1.25 },
    };
    const cfg: LayoutConfig = {
      ...defaultLayoutConfig("std"),
      rows: 5,
      cols: 8,
      stadiumFromRow: 2,
      stepsPerRow: 2,
      aisles: { verticalAfterCols: [4], horizontalAfterRows: [] },
      dimensions: { screenDistanceM: 6.2, screenBottomM: 1.6, screenAspect: 2.2 },
    };
    const { seats, geometry } = generateGrid(cfg, TYPES);
    const scored = scoreSeats(seats, cfg, geometry, customDefaults);
    const scene = buildRoomScene(
      scored,
      geometry,
      {
        stadiumFromRow: cfg.stadiumFromRow,
        stepsPerRow: cfg.stepsPerRow,
        screenDistance: cfg.screen.distance,
        dimensions: cfg.dimensions,
        defaults: customDefaults,
      },
      TYPES.map((t) => ({ id: t.id, color: "#cc5577", style: t.style })),
    );

    const a4 = scene.seats.find((s) => s.code === "A4")!;
    const a5 = scene.seats.find((s) => s.code === "A5")!;
    const b4 = scene.seats.find((s) => s.code === "B4")!;
    // Tier 1 defaults applied: seatPitchM = 0.65, aisleWidthM = 1.5, rowPitch = 1.25, stepHeightM = 0.2
    expect(a5.x - a4.x).toBeCloseTo(0.65 + 1.5);
    expect(b4.z - a4.z).toBeCloseTo(1.25);
    expect(scene.rowFloors[1].height).toBeCloseTo(2 * 0.2);
    // Tier 2 per-room overrides applied: screenDistanceM = 6.2, screenBottomM = 1.6, screenAspect = 2.2
    expect(a4.z).toBeCloseTo(6.2);
    expect(scene.screen.bottom).toBeCloseTo(1.6);
    expect(scene.screen.height).toBeCloseTo(scene.screen.width / 2.2);
  });

  it("computes live viewing metrics and lowers eye height / neck strain when seats deeply recline", () => {
    const upright = makeRoom({
      rows: 8,
      cols: 14,
      screen: { positionPct: 50, widthPct: 85, distance: "near", shape: "square", mount: "high" },
      seatRecline: "upright",
    });
    const deep = makeRoom({
      rows: 8,
      cols: 14,
      screen: { positionPct: 50, widthPct: 85, distance: "near", shape: "square", mount: "high" },
      seatRecline: "deep",
    });
    const eyeUp = upright.scene.eyeOf("B7", 170)!;
    const eyeDeep = deep.scene.eyeOf("B7", 170)!;
    expect(eyeDeep.y).toBeLessThan(eyeUp.y);

    const mUp = upright.scene.viewMetricsOf("B7", 170)!;
    const mDeep = deep.scene.viewMetricsOf("B7", 170)!;
    expect(mUp.horizontalDeg).toBeGreaterThan(50);
    expect(mUp.neckStrain).toBe(true);
    // Deep recline shifts comfortable upward gaze so a moderately high screen stops flagging neck strain.
    const midRowUp = upright.scene.viewMetricsOf("D7", 170)!;
    const midRowDeep = deep.scene.viewMetricsOf("D7", 170)!;
    expect(midRowUp.verticalTopDeg).toBeGreaterThan(35);
    expect(midRowUp.neckStrain).toBe(true);
    expect(midRowDeep.neckStrain).toBe(false);
    expect(mDeep.distanceM).toBeGreaterThan(3);
  });

  it("places side aisles inside full 3D room width so a 1-sided aisle shifts seats off the screen centre", () => {
    const rightOnly = makeRoom({
      cols: 8,
      aisles: { verticalAfterCols: [], horizontalAfterRows: [], sideAisles: ["right"] },
    }).scene;
    expect(rightOnly.widthM).toBeCloseTo(8 * SEAT_PITCH_M + REAL_AISLE_WIDTH_M);
    expect(rightOnly.sideAisles).toEqual(["right"]);
    // Screen stays centred on the full room while seats hug the left wall (seat 5 closer to screen centre than seat 4).
    const c4 = rightOnly.seats.find((s) => s.code === "C4")!;
    const c5 = rightOnly.seats.find((s) => s.code === "C5")!;
    expect(Math.abs(c5.x - rightOnly.screen.centreX)).toBeLessThan(Math.abs(c4.x - rightOnly.screen.centreX));
    // Aisle step lights sit inside the right-wall walkway.
    expect(rightOnly.aisleLightXs).toHaveLength(1);
    expect(rightOnly.aisleLightXs[0]).toBeCloseTo(rightOnly.widthM - REAL_AISLE_WIDTH_M / 2);
  });

  it("keeps seat-score and 3D scene 100% aligned across vertical, side, horizontal, and partially-filled aisles", () => {
    const cfg: LayoutConfig = {
      ...defaultLayoutConfig("std"),
      rows: 8,
      cols: 12,
      stadiumFromRow: 1,
      stepsPerRow: 2,
      aisles: { verticalAfterCols: [4, 8], horizontalAfterRows: [3], sideAisles: ["right"] },
      aisleFills: [{ afterCol: 4, seats: 2, rows: [8] }],
      entrances: [{ side: "right", position: "back" }],
    };
    const { seats, geometry } = generateGrid(cfg, TYPES);
    const ctx = buildScoreContext(seats, cfg, geometry);
    const scored = scoreSeats(seats, cfg, geometry);
    const scene = buildRoomScene(
      scored,
      geometry,
      {
        stadiumFromRow: cfg.stadiumFromRow,
        stepsPerRow: cfg.stepsPerRow,
        screenDistance: cfg.screen.distance,
        screenShape: cfg.screen.shape,
        screenMount: cfg.screen.mount,
        screenTilt: cfg.screen.tilt,
        seatRecline: cfg.seatRecline,
        rowCurve: cfg.rowCurve,
        seatStagger: cfg.seatStagger,
        rowPitch: cfg.rowPitch,
      },
      TYPES.map((t) => ({ id: t.id, color: "#cc5577", style: t.style })),
    );

    // Exact screen width, height, and centre parity between scoring and 3D.
    expect(scene.screen.width).toBeCloseTo(ctx.screenWidthM, 6);
    expect(scene.screen.height).toBeCloseTo(ctx.screenHeightM, 6);
    expect(scene.screen.centreX).toBeCloseTo(ctx.screenCentreX, 6);

    // Exact horizontal cross-aisle depth (rowPitchM + horizontalAisleWidthM) and continuous floor slab bridging.
    const rowC = scene.rowFloors[2];
    const rowD = scene.rowFloors[3];
    expect(rowD.z - rowC.z).toBeCloseTo(scene.rowPitchM + REAL_HORIZONTAL_AISLE_WIDTH_M, 6);
    const slabC = scene.floorSlabs[2];
    const slabD = scene.floorSlabs[3];
    expect(slabC.zEnd).toBeCloseTo(slabD.zStart, 6);
    // Final floor slab extends continuously to the rear wall so the back exit opens on solid elevated floor.
    expect(scene.floorSlabs[scene.floorSlabs.length - 1].zEnd).toBeCloseTo(scene.backWallZ, 6);
    expect(scene.rearMarginM).toBeGreaterThanOrEqual(REAL_AISLE_WIDTH_M);

    // Multi-step stadium rise (`stepsPerRow = 2`) produces real intermediate stair treads,
    // and omits aisle lights/steps on row 8 (index 7) where `aisleFills` places seats across the col-4 aisle.
    expect(scene.aisleSteps.length).toBeGreaterThan(0);
    const col4AisleX = scene.aisleLightXs[0];
    const row8Z = scene.rowFloors[7].z - scene.rowPitchM / 2;
    const lightsOnFilledRow = scene.aisleLights.filter(
      (l) => Math.abs(l.x - col4AisleX) < 0.05 && Math.abs(l.z - row8Z) < 0.1,
    );
    expect(lightsOnFilledRow).toHaveLength(0);

    // Viewing distance & horizontal FOV match closely between `scoreBreakdown` and `scene.viewMetricsOf`
    // (differing only by the tiny 4 cm camera eye-back offset).
    for (const code of ["A1", "D6", "H5", "H12"]) {
      const gridSeat = seats.find((s) => s.code === code)!;
      const b = scoreBreakdown(gridSeat, ctx);
      const m = scene.viewMetricsOf(code, 170)!;
      expect(m.distanceM - b.measures.distanceM).toBeCloseTo(0.04, 3);
      expect(Math.abs(m.horizontalDeg - b.measures.horizontalAngleDeg)).toBeLessThan(0.5);
    }
  });

  it("keeps cinemaDimensionDefaultsSchema backward-compatible when horizontalAisleWidthM is absent", () => {
    const legacy = { ...DEFAULT_CINEMA_DIMENSIONS } as Record<string, unknown>;
    delete legacy.horizontalAisleWidthM;
    const parsed = cinemaDimensionDefaultsSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.horizontalAisleWidthM).toBe(DEFAULT_CINEMA_DIMENSIONS.horizontalAisleWidthM);
    }
  });

  it("identifies the highest-scoring usable seat as bestSeatCode", () => {
    const { scene } = makeRoom({ rows: 8, cols: 12, stadiumFromRow: 1, stepsPerRow: 2 });
    expect(scene.bestSeatCode).not.toBeNull();
    const best = scene.seats.find((s) => s.code === scene.bestSeatCode)!;
    const maxUsable = Math.max(...scene.seats.filter((s) => !s.broken && !s.obstructed).map((s) => s.score));
    expect(best.score).toBe(maxUsable);
  });

  it("tilts high screens downward around z = 0 and eases upward viewing strain for reclined viewers", () => {
    const base: Partial<LayoutConfig> = {
      rows: 6,
      cols: 10,
      stadiumFromRow: 1,
      stepsPerRow: 1,
      rowPitch: "vip",
      seatRecline: "deep",
      screen: { positionPct: 50, widthPct: 85, distance: "near", shape: "standard", mount: "high" },
    };
    const flat = makeRoom(base);
    const tilted = makeRoom({
      ...base,
      screen: { ...base.screen!, tilt: "tilted" },
    });

    // Omitted tilt defaults to 0° vertical with zero Z overhang.
    expect(flat.scene.screen.tiltDeg).toBe(0);
    expect(flat.scene.screen.bottomZ).toBe(0);
    expect(flat.scene.screen.topZ).toBe(0);

    // Tilted (10°) pivots around centre z = 0: top overhangs forward (+z), bottom recesses (-z), front baffle clears it.
    expect(tilted.scene.screen.tiltDeg).toBe(10);
    expect(tilted.scene.screen.centerZ).toBe(0);
    expect(tilted.scene.screen.topZ).toBeGreaterThan(0.15);
    expect(tilted.scene.screen.bottomZ).toBeLessThan(-0.15);
    expect(tilted.scene.frontWallZ).toBeLessThan(tilted.scene.screen.bottomZ - 0.15);
    expect(tilted.scene.screen.bottom).toBe(flat.scene.screen.bottom);

    // Front row looking upward at a high screen benefits ergonomically from downward screen tilt.
    const flatA5 = flat.scored.find((s) => s.code === "A5")!;
    const tiltedA5 = tilted.scored.find((s) => s.code === "A5")!;
    expect(tiltedA5.score).toBeGreaterThan(flatA5.score);

    // `viewMetricsOf` stays in sync with `scoreBreakdown` and keeps reclined viewers comfortable on high tilted screens.
    const ctx = buildScoreContext(tilted.scored, tilted.cfg, tilted.geometry);
    const bA5 = scoreBreakdown(tiltedA5, ctx);
    const mA5 = tilted.scene.viewMetricsOf("A5", 170)!;
    expect(Math.abs(mA5.verticalTopDeg - bA5.measures.verticalAngleDeg)).toBeLessThan(0.8);
    expect(tilted.scene.viewMetricsOf("B5", 170)!.neckStrain).toBe(false);
  });
});
