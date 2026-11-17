import { describe, expect, it } from "vitest";
import { clampView, MAX_SCALE, pinchView, viewBoxFor, zoomAround, type Box, type View } from "./use-pan-zoom";

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

describe("viewBoxFor", () => {
  /** Map point (map units) that a container pixel shows, for a viewBox drawn into the container with no fitting (same proportions). */
  const mapPointAt = (box: Box, px: number, py: number, width: number, height: number) => ({
    x: box.x + (px / width) * box.w,
    y: box.y + (py / height) * box.h,
  });

  it("at 1x shows the whole map; when the frame is wider than the map it adds empty bands at the sides", () => {
    const base = { x: -1, y: -1, w: 20, h: 15 };
    const exact = viewBoxFor({ s: 1, x: 0, y: 0 }, base, 400, 300); // same proportions as the map
    expect(exact).toEqual(base);
    const wide = viewBoxFor({ s: 1, x: 0, y: 0 }, base, 600, 300); // a frame wider than the map
    expect(wide.h).toBeCloseTo(base.h);
    expect(wide.w).toBeGreaterThan(base.w);
    expect(wide.x + wide.w / 2).toBeCloseTo(base.x + base.w / 2); // still centred
  });

  it("always has the container's proportions, so the browser adds no fitting of its own", () => {
    const base = { x: -1, y: -1, w: 20, h: 15 };
    for (const view of [{ s: 1, x: 0, y: 0 }, { s: 2.5, x: -120, y: -40 }, { s: 6, x: -999, y: -999 }]) {
      const v = clampView(view, 600, 300);
      const b = viewBoxFor(v, base, 600, 300);
      expect(b.w / b.h).toBeCloseTo(600 / 300);
    }
  });

  it("keeps the map point under the fingers where it was while zooming, even with empty bands", () => {
    const W = 600;
    const H = 300;
    const base = { x: -1, y: -1, w: 20, h: 15 };
    const before: View = { s: 1.5, x: -90, y: -30 };
    const p = { x: 340, y: 120 };
    const under = mapPointAt(viewBoxFor(before, base, W, H), p.x, p.y, W, H);
    const after = zoomAround(before, 4, p.x, p.y, W, H);
    const now = mapPointAt(viewBoxFor(after, base, W, H), p.x, p.y, W, H);
    expect(now.x).toBeCloseTo(under.x, 6);
    expect(now.y).toBeCloseTo(under.y, 6);
  });

  it("pans: dragging the content right by 50px moves the viewBox left by 50px worth of map units", () => {
    const base = { x: 0, y: 0, w: 40, h: 30 };
    const a = viewBoxFor({ s: 2, x: -200, y: -100 }, base, 400, 300);
    const b = viewBoxFor({ s: 2, x: -150, y: -100 }, base, 400, 300);
    const unitsPerPx = a.w / 400;
    expect(a.x - b.x).toBeCloseTo(50 * unitsPerPx, 6);
    expect(a.y).toBeCloseTo(b.y);
  });
});
