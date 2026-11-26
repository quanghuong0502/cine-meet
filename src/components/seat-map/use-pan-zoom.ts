"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;
/** Finger travel (px) beyond which a touch is a drag, not a tap. */
const TAP_SLOP = 8;
const BUTTON_STEP = 1.5;
/** A touch this close to the screen's left edge is left to iOS's swipe-back gesture (devices.md). */
const EDGE_GUARD = 20;

export interface View {
  s: number;
  x: number;
  y: number;
}

/** Scale within limits, and the content (which is as big as the frame, times `s`) kept covering the frame. */
export function clampView(view: View, width: number, height: number): View {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.s));
  if (s === MIN_SCALE) return { s, x: 0, y: 0 };
  return {
    s,
    x: Math.min(0, Math.max(width - width * s, view.x)),
    y: Math.min(0, Math.max(height - height * s, view.y)),
  };
}

/** Zoom to `scale` so the content point that is under (px, py) stays under it. */
export function zoomAround(view: View, scale: number, px: number, py: number, width: number, height: number): View {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  const cx = (px - view.x) / view.s;
  const cy = (py - view.y) / view.s;
  return clampView({ s, x: px - cx * s, y: py - cy * s }, width, height);
}

/**
 * The view while two fingers pinch: `anchor` is the content point that was under the fingers' midpoint when the pinch started;
 * it stays under the midpoint as the fingers move, so the map zooms where the fingers are and follows them when they travel.
 */
export function pinchView(
  startScale: number,
  anchor: { x: number; y: number },
  startDist: number,
  dist: number,
  mid: { x: number; y: number },
  width: number,
  height: number,
): View {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, startScale * (dist / Math.max(startDist, 1))));
  return clampView({ s, x: mid.x - anchor.x * s, y: mid.y - anchor.y * s }, width, height);
}

/** The map's own coordinates: the SVG viewBox of the whole map at 1x. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The SVG viewBox to show for a `view`. The view is in container pixels (as the gestures work), the viewBox in map units.
 * At 1x the map is fitted into the container ("meet"), possibly with empty bands; the viewBox returned has the container's own
 * proportions, so the browser draws it with no extra fitting and a point under a finger stays under it.
 */
export function viewBoxFor(view: View, base: Box, width: number, height: number): Box {
  const k = Math.min(width / base.w, height / base.h); // map units to container pixels at 1x
  const ox = (width - base.w * k) / 2;
  const oy = (height - base.h * k) / 2;
  return {
    x: base.x + (-view.x / view.s - ox) / k,
    y: base.y + (-view.y / view.s - oy) / k,
    w: width / view.s / k,
    h: height / view.s / k,
  };
}

interface Options {
  onTap?: (target: EventTarget | null) => void;
  /** Scale at which seat code labels appear; only threshold crossings trigger a React render. */
  labelScale?: number;
}

/**
 * Pinch-zoom, drag and tap for an SVG map that fills `containerRef`.
 * Zooming changes the SVG's `viewBox` (not a CSS transform): the browser redraws the vectors at the new size, so the map is
 * always sharp and there is no scaled bitmap or composited layer whose stale pieces could show through (the earlier transform
 * version left a ghost of the 1x map under the zoomed one).
 * The viewBox is coalesced via `requestAnimationFrame` straight to the DOM during gestures (zero `getBoundingClientRect`
 * calls inside `pointermove`), and React state only updates on boolean threshold crossings (`zoomed`, `atMax`, `showLabels`).
 */
export function usePanZoom(containerRef: RefObject<HTMLElement | null>, svgRef: RefObject<SVGSVGElement | null>, base: Box, options: Options) {
  const labelScale = options.labelScale ?? 1.5;
  const view = useRef<View>({ s: 1, x: 0, y: 0 });
  const rectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const rafRef = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startDist: number;
    startScale: number;
    anchor: { x: number; y: number };
    moved: boolean;
    pinched: boolean;
    downTarget: EventTarget | null;
    downAt: { x: number; y: number };
    last: { x: number; y: number };
  } | null>(null);
  const onTap = useRef(options.onTap);
  const [zoomed, setZoomed] = useState(false);
  const [atMax, setAtMax] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const lastBgTap = useRef<{ time: number; x: number; y: number } | null>(null);

  useEffect(() => {
    onTap.current = options.onTap;
  });

  const baseRef = useRef(base);

  const measure = useCallback(() => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    const measured = { left: box.left, top: box.top, width: box.width, height: box.height };
    rectRef.current = measured;
    return measured;
  }, [containerRef]);

  /** Writes the viewBox synchronously for a view (used on mount/resize/base-change). */
  const writeNow = useCallback(
    (v: View, box = rectRef.current ?? measure()) => {
      const svg = svgRef.current;
      if (!box || !svg || box.width === 0 || box.height === 0) return;
      const b = viewBoxFor(v, baseRef.current, box.width, box.height);
      svg.setAttribute("viewBox", `${b.x} ${b.y} ${b.w} ${b.h}`);
    },
    [measure, svgRef],
  );

  /** Coalesces DOM viewBox mutations during high-frequency touch/wheel gestures to 1 write per animation frame. */
  const scheduleWrite = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      writeNow(view.current);
    });
  }, [writeNow]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, []);

  const apply = useCallback(
    (next: View, box = rectRef.current ?? measure(), immediate = false) => {
      const v = box ? clampView(next, box.width, box.height) : next;
      view.current = v;
      if (immediate) writeNow(v, box);
      else scheduleWrite();
      setZoomed(v.s > MIN_SCALE + 0.001);
      setAtMax(v.s >= MAX_SCALE - 0.001);
      setShowLabels(v.s >= labelScale);
    },
    [labelScale, measure, scheduleWrite, writeNow],
  );

  // The map's own size changed (rows, columns or doors edited): React has just set the new base viewBox, so put the current
  // zoom back on top of it. Also covers the first paint.
  const { x: bx, y: by, w: bw, h: bh } = base;
  useLayoutEffect(() => {
    baseRef.current = { x: bx, y: by, w: bw, h: bh };
    writeNow(view.current, measure());
  }, [bx, by, bw, bh, measure, writeNow]);

  // Keep the SVG viewBox calibrated when the viewport rotates or changes height.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => writeNow(view.current, measure()));
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, measure, writeNow]);

  /** Zoom by `factor` keeping the point (px, py), relative to the container, still. */
  const zoomAt = useCallback(
    (factor: number, px: number, py: number, box = measure()) => {
      if (!box) return;
      apply(zoomAround(view.current, view.current.s * factor, px, py, box.width, box.height), box, true);
    },
    [apply, measure],
  );

  const zoomIn = useCallback(() => {
    const box = measure();
    if (box) zoomAt(BUTTON_STEP, box.width / 2, box.height / 2, box);
  }, [measure, zoomAt]);

  const zoomOut = useCallback(() => {
    const box = measure();
    if (box) zoomAt(1 / BUTTON_STEP, box.width / 2, box.height / 2, box);
  }, [measure, zoomAt]);

  const reset = useCallback(() => apply({ s: 1, x: 0, y: 0 }, measure(), true), [apply, measure]);

  // Ctrl/Cmd + wheel zooms (plain wheel keeps scrolling the page). Needs a non-passive listener.
  // Cache container rect briefly during continuous wheel bursts to avoid forcing layout reflow per tick.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let wheelMeasuredAt = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const now = performance.now();
      const box = rectRef.current && now - wheelMeasuredAt < 250 ? rectRef.current : ((wheelMeasuredAt = now), measure());
      if (!box) return;
      apply(zoomAround(view.current, view.current.s * Math.exp(-e.deltaY * 0.01), e.clientX - box.left, e.clientY - box.top, box.width, box.height), box);
    };
    const resetWheelCache = () => {
      wheelMeasuredAt = 0;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", resetWheelCache, { passive: true });
    window.addEventListener("scroll", resetWheelCache, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", resetWheelCache);
      window.removeEventListener("scroll", resetWheelCache);
    };
  }, [apply, containerRef, measure]);

  const localFromRect = (e: React.PointerEvent, box: { left: number; top: number } | null) => ({
    x: e.clientX - (box?.left ?? 0),
    y: e.clientY - (box?.top ?? 0),
  });

  const distanceAndMid = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const releasePointer = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if capture was already dropped.
      }
    }
  };

  const dropPointer = (pointerId: number) => {
    pointers.current.delete(pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
    } else if (gesture.current && pointers.current.size === 1) {
      gesture.current.last = [...pointers.current.values()][0];
    }
  };

  const handlers = {
    onPointerDown(e: React.PointerEvent) {
      if (e.pointerType === "touch" && e.clientX < EDGE_GUARD) return;
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Synthetic or unsupported pointer events.
      }
      // Measure once on pointerdown so pointermove never forces layout reflow.
      const box = measure();
      const p = localFromRect(e, box);
      pointers.current.set(e.pointerId, p);
      if (pointers.current.size === 1) {
        gesture.current = {
          startDist: 0,
          startScale: view.current.s,
          anchor: { x: 0, y: 0 },
          moved: false,
          pinched: false,
          downTarget: e.target,
          downAt: p,
          last: p,
        };
      } else if (pointers.current.size === 2 && gesture.current) {
        const { dist, mid } = distanceAndMid();
        const v = view.current;
        gesture.current.startDist = dist;
        gesture.current.startScale = v.s;
        gesture.current.anchor = { x: (mid.x - v.x) / v.s, y: (mid.y - v.y) / v.s };
        gesture.current.pinched = true;
        gesture.current.moved = true;
      }
    },
    onPointerMove(e: React.PointerEvent) {
      const g = gesture.current;
      if (!g || !pointers.current.has(e.pointerId)) return;
      const box = rectRef.current;
      const p = localFromRect(e, box);
      pointers.current.set(e.pointerId, p);

      if (pointers.current.size >= 2) {
        const { dist, mid } = distanceAndMid();
        if (box) apply(pinchView(g.startScale, g.anchor, g.startDist, dist, mid, box.width, box.height), box);
        return;
      }
      if (!g.moved && Math.hypot(p.x - g.downAt.x, p.y - g.downAt.y) > TAP_SLOP) g.moved = true;
      if (g.moved && view.current.s > 1) {
        apply({ s: view.current.s, x: view.current.x + (p.x - g.last.x), y: view.current.y + (p.y - g.last.y) }, box);
      }
      g.last = p;
    },
    onPointerUp(e: React.PointerEvent) {
      releasePointer(e);
      const g = gesture.current;
      pointers.current.delete(e.pointerId);
      if (!g) return;
      if (pointers.current.size === 0) {
        if (!g.moved && !g.pinched) {
          const target = g.downTarget instanceof Element ? g.downTarget : null;
          const isInteractiveTarget = Boolean(target?.closest("[data-seat],[data-row],[data-col]"));
          if (isInteractiveTarget) {
            lastBgTap.current = null;
            onTap.current?.(g.downTarget);
          } else {
            // Double-tap on the map background toggles 1x <-> 2.5x zoom around the tapped point (one-handed iPhone zoom).
            const now = Date.now();
            const prev = lastBgTap.current;
            if (prev && now - prev.time < 300 && Math.hypot(g.downAt.x - prev.x, g.downAt.y - prev.y) < 32) {
              lastBgTap.current = null;
              const box = rectRef.current ?? measure();
              if (box) {
                const targetScale = view.current.s > MIN_SCALE + 0.1 ? MIN_SCALE : 2.5;
                apply(zoomAround(view.current, targetScale, g.downAt.x, g.downAt.y, box.width, box.height), box, true);
              }
            } else {
              lastBgTap.current = { time: now, x: g.downAt.x, y: g.downAt.y };
            }
          }
        }
        gesture.current = null;
      } else if (pointers.current.size === 1) {
        // One finger of a pinch lifted: the other carries on as a drag from where it is NOW, not from where it was
        // before the pinch (else the map jumps by the distance it travelled meanwhile).
        g.last = [...pointers.current.values()][0];
      }
    },
    onPointerCancel(e: React.PointerEvent) {
      releasePointer(e);
      dropPointer(e.pointerId);
    },
    onLostPointerCapture(e: React.PointerEvent) {
      dropPointer(e.pointerId);
    },
  };

  return { zoomed, atMax, showLabels, handlers, zoomIn, zoomOut, reset };
}
