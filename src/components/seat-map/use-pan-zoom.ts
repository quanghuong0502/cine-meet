"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

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

interface Options {
  onTap?: (target: EventTarget | null) => void;
}

/**
 * Pinch-zoom, drag and tap for a map that fills `containerRef`; the content is `contentRef`.
 * The transform is written straight to the DOM during a gesture (no React render per frame);
 * only `scale` (coarse, for hiding/showing labels and disabling buttons) goes through state.
 */
export function usePanZoom(containerRef: RefObject<HTMLElement | null>, contentRef: RefObject<HTMLElement | null>, options: Options) {
  const view = useRef<View>({ s: 1, x: 0, y: 0 });
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
  const [scale, setScale] = useState(1);

  useEffect(() => {
    onTap.current = options.onTap;
  });

  const apply = useCallback(
    (next: View) => {
      const box = containerRef.current?.getBoundingClientRect();
      const v = box ? clampView(next, box.width, box.height) : next;
      view.current = v;
      const el = contentRef.current;
      if (el) el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
      setScale(Math.round(v.s * 20) / 20);
    },
    [containerRef, contentRef],
  );

  /** Zoom by `factor` keeping the point (px, py), relative to the container, still. */
  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) return;
      apply(zoomAround(view.current, view.current.s * factor, px, py, box.width, box.height));
    },
    [apply, containerRef],
  );

  const center = useCallback(() => {
    const box = containerRef.current?.getBoundingClientRect();
    return { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 };
  }, [containerRef]);

  const zoomIn = useCallback(() => zoomAt(BUTTON_STEP, center().x, center().y), [zoomAt, center]);
  const zoomOut = useCallback(() => zoomAt(1 / BUTTON_STEP, center().x, center().y), [zoomAt, center]);
  const reset = useCallback(() => apply({ s: 1, x: 0, y: 0 }), [apply]);

  // Ctrl/Cmd + wheel zooms (plain wheel keeps scrolling the page). Needs a non-passive listener.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const box = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - box.left, e.clientY - box.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef, zoomAt]);

  const local = (e: React.PointerEvent) => {
    const box = containerRef.current?.getBoundingClientRect();
    return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) };
  };

  const distanceAndMid = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const handlers = {
    onPointerDown(e: React.PointerEvent) {
      if (e.pointerType === "touch" && e.clientX < EDGE_GUARD) return;
      const p = local(e);
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
      const p = local(e);
      pointers.current.set(e.pointerId, p);

      if (pointers.current.size >= 2) {
        const { dist, mid } = distanceAndMid();
        const box = containerRef.current?.getBoundingClientRect();
        if (box) apply(pinchView(g.startScale, g.anchor, g.startDist, dist, mid, box.width, box.height));
        return;
      }
      if (!g.moved && Math.hypot(p.x - g.downAt.x, p.y - g.downAt.y) > TAP_SLOP) g.moved = true;
      if (g.moved && view.current.s > 1) {
        apply({ s: view.current.s, x: view.current.x + (p.x - g.last.x), y: view.current.y + (p.y - g.last.y) });
      }
      g.last = p;
    },
    onPointerUp(e: React.PointerEvent) {
      const g = gesture.current;
      pointers.current.delete(e.pointerId);
      if (!g) return;
      if (pointers.current.size === 0) {
        if (!g.moved && !g.pinched) onTap.current?.(g.downTarget);
        gesture.current = null;
      } else if (pointers.current.size === 1) {
        // One finger of a pinch lifted: the other carries on as a drag from where it is NOW, not from where it was
        // before the pinch (else the map jumps by the distance it travelled meanwhile).
        g.last = [...pointers.current.values()][0];
      }
    },
    onPointerCancel(e: React.PointerEvent) {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 0) gesture.current = null;
      else if (gesture.current && pointers.current.size === 1) gesture.current.last = [...pointers.current.values()][0];
    },
  };

  return { scale, handlers, zoomIn, zoomOut, reset };
}
