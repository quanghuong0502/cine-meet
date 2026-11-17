import { describe, expect, it } from "vitest";
import { clampView, MAX_SCALE, pinchView, zoomAround } from "./use-pan-zoom";

const W = 400;
const H = 300;
/** Where a content point ends up on screen. */
const onScreen = (v: { s: number; x: number; y: number }, p: { x: number; y: number }) => ({ x: v.x + p.x * v.s, y: v.y + p.y * v.s });

describe("clampView", () => {
  it("returns to the origin at 1x and keeps zoomed content covering the frame", () => {
    expect(clampView({ s: 1, x: -50, y: 20 }, W, H)).toEqual({ s: 1, x: 0, y: 0 });
    expect(clampView({ s: 2, x: 30, y: 30 }, W, H)).toEqual({ s: 2, x: 0, y: 0 });
    expect(clampView({ s: 2, x: -999, y: -999 }, W, H)).toEqual({ s: 2, x: -W, y: -H });
  });

  it("limits the scale", () => {
    expect(clampView({ s: 99, x: 0, y: 0 }, W, H).s).toBe(MAX_SCALE);
    expect(clampView({ s: 0.2, x: 0, y: 0 }, W, H).s).toBe(1);
  });
});

describe("zoomAround", () => {
  it("keeps the point under the fingers where it was", () => {
    const start = { s: 1.5, x: -60, y: -40 };
    const p = { x: 210, y: 140 };
    const content = { x: (p.x - start.x) / start.s, y: (p.y - start.y) / start.s };
    const next = zoomAround(start, 3, p.x, p.y, W, H);
    expect(next.s).toBe(3);
    const after = onScreen(next, content);
    expect(after.x).toBeCloseTo(p.x);
    expect(after.y).toBeCloseTo(p.y);
  });
});

describe("pinchView", () => {
  const anchor = { x: 150, y: 100 };

  it("zooms around the midpoint and follows it when the fingers travel", () => {
    const first = pinchView(1, anchor, 100, 200, { x: 150, y: 100 }, W, H);
    expect(first.s).toBe(2);
    expect(onScreen(first, anchor)).toEqual({ x: 150, y: 100 });
    // Fingers slide right and down by (20, 10) while holding the same spread: the content moves with them.
    const moved = pinchView(1, anchor, 100, 200, { x: 170, y: 110 }, W, H);
    expect(onScreen(moved, anchor).x).toBeCloseTo(170);
    expect(onScreen(moved, anchor).y).toBeCloseTo(110);
  });

  it("does not jump when the fingers start on the same spot (zero distance)", () => {
    const v = pinchView(1, anchor, 0, 30, { x: 150, y: 100 }, W, H);
    expect(Number.isFinite(v.s)).toBe(true);
    expect(v.s).toBeLessThanOrEqual(MAX_SCALE);
  });

  it("is smooth: a small spread change moves the view only a little", () => {
    const a = pinchView(1, anchor, 100, 150, { x: 150, y: 100 }, W, H);
    const b = pinchView(1, anchor, 100, 152, { x: 150, y: 100 }, W, H);
    expect(Math.abs(a.x - b.x)).toBeLessThan(5);
    expect(Math.abs(a.y - b.y)).toBeLessThan(5);
  });
});
