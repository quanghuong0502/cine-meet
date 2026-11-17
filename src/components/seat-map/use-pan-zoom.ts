"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;
/** Finger travel (px) beyond which a touch is a drag, not a tap. */
const TAP_SLOP = 8;
const BUTTON_STEP = 1.5;

interface View {
  s: number;
  x: number;
  y: number;
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
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.s));
      let { x, y } = next;
      if (box) {
        // Keep the content covering the container.
        x = Math.min(0, Math.max(box.width - box.width * s, x));
        y = Math.min(0, Math.max(box.height - box.height * s, y));
      }
      if (s === 1) {
        x = 0;
        y = 0;
      }
      view.current = { s, x, y };
      const el = contentRef.current;
      if (el) el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      setScale(Math.round(s * 20) / 20);
    },
    [containerRef, contentRef],
  );

  /** Zoom by `factor` keeping the point (px, py), relative to the container, still. */
  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      const { s, x, y } = view.current;
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor));
      const cx = (px - x) / s;
      const cy = (py - y) / s;
      apply({ s: ns, x: px - cx * ns, y: py - cy * ns });
    },
    [apply],
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
        const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.startScale * (dist / g.startDist)));
        apply({ s, x: mid.x - g.anchor.x * s, y: mid.y - g.anchor.y * s });
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
      }
    },
    onPointerCancel(e: React.PointerEvent) {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 0) gesture.current = null;
    },
  };

  return { scale, handlers, zoomIn, zoomOut, reset };
}
