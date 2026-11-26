"use client";

import { RadioMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { safeAreaInsets, snapshotDom, summarizeMutations } from "./dom-snapshot";
import { measure } from "./measure";

/**
 * Development only (rendered by the root layout when NODE_ENV is not production; strings are not translated on purpose).
 * One button. While it is on, every time the page's DOM changes this sends the developer what changed and an outline of
 * the whole page (elements, classes, text, position and size on screen) to /api/dev/dom, which keeps it in `.next/dev-dom.json`.
 * It only reads the page; it never runs anything sent from outside.
 */

const STORAGE_KEY = "devDomRecorder";
/** Wait for the changes to settle before sending, and never send more often than this. */
const SETTLE_MS = 700; // a bottom sheet takes about half a second to slide in; measure after it has stopped
const MIN_GAP_MS = 1_500;

// The switch lives in localStorage (so it survives page loads), read through useSyncExternalStore so the server render
// and the first client render agree (switch off) and the saved value is applied right after.
let memoryOn = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function readOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return memoryOn;
  }
}
/** True after the switch was turned on: the first thing sent replaces whatever the dev server still has from an earlier run. */
let startFresh = false;
/** The send that is on its way, so that clearing waits for it (it would otherwise write the file again right after). */
let inFlight: Promise<unknown> = Promise.resolve();

function writeOn(value: boolean) {
  memoryOn = value;
  if (value) startFresh = true;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  } catch {
    // Private mode: the variable above is used instead.
  }
  listeners.forEach((listener) => listener());
}

// Where the person dragged the button to ("x,y" in px from the top-left of the screen), kept the same way as the switch.
// Empty = the default spot (middle of the right edge).
const POSITION_KEY = "devDomRecorderPosition";
let memoryPosition = "";
function readPosition(): string {
  try {
    return localStorage.getItem(POSITION_KEY) ?? "";
  } catch {
    return memoryPosition;
  }
}
function writePosition(value: string, persist: boolean) {
  memoryPosition = value;
  if (persist) {
    try {
      localStorage.setItem(POSITION_KEY, value);
    } catch {
      // Private mode: the variable above is used instead.
    }
  }
  listeners.forEach((listener) => listener());
}
/** Button size (44px) plus a margin, so a saved spot still shows after the window got smaller. */
const BUTTON_PX = 44;
const EDGE_PX = 8;
/** Finger or mouse travel beyond which a press is a drag, not a click. */
const DRAG_SLOP_PX = 6;

const TRACE_MS = 1_800;

interface TraceSample {
  t: number;
  vvHeight: number;
  vvOffsetTop: number;
  vvPageTop: number;
  innerHeight: number;
  scrollY: number;
  shellTop: number | null;
  shellHeight: number | null;
  headerTop: number | null;
  focusTop: number | null;
  /** The shell's computed `position`: tells which version of the keyboard CSS the phone is really running. */
  shellPosition: string | null;
}

/** Every animation frame for TRACE_MS: where the visual viewport, the app shell and the header are. This is how a judder is seen. */
function traceFrames(label: string): Promise<{ label: string; samples: TraceSample[] }> {
  return new Promise((resolve) => {
    const samples: TraceSample[] = [];
    const started = performance.now();
    const round = (n: number) => Math.round(n * 10) / 10;
    const tick = () => {
      const t = performance.now() - started;
      const shell = document.querySelector("[data-app-shell]");
      const header = shell?.querySelector("header");
      const vv = window.visualViewport;
      const sample: TraceSample = {
        t: Math.round(t),
        vvHeight: round(vv?.height ?? innerHeight),
        vvOffsetTop: round(vv?.offsetTop ?? 0),
        vvPageTop: round(vv?.pageTop ?? 0),
        innerHeight,
        scrollY: round(scrollY),
        shellTop: shell ? round(shell.getBoundingClientRect().top) : null,
        shellHeight: shell ? round(shell.getBoundingClientRect().height) : null,
        headerTop: header ? round(header.getBoundingClientRect().top) : null,
        shellPosition: shell ? getComputedStyle(shell).position : null,
        focusTop: document.activeElement && document.activeElement !== document.body ? round(document.activeElement.getBoundingClientRect().top) : null,
      };
      const last = samples[samples.length - 1];
      // Keep a frame only when something moved, so a calm second costs almost nothing.
      if (!last || JSON.stringify({ ...last, t: 0 }) !== JSON.stringify({ ...sample, t: 0 })) samples.push(sample);
      if (t < TRACE_MS) requestAnimationFrame(tick);
      else resolve({ label, samples });
    };
    requestAnimationFrame(tick);
  });
}

interface ScrollSample {
  t: number;
  scrollTop: number;
  /** Top and height of the element marked `data-scroll-probe` (a sticky block). If it is really sticky `probeTop` stays put. */
  probeTop: number | null;
  probeHeight: number | null;
  /** Bottom of the sticky page header; `probeTop - headerBottom` is the gap between the two (0 when they meet exactly, negative if they overlap). */
  headerBottom: number | null;
  gap: number | null;
}

/** Stop this long after the last scroll event (momentum scrolling keeps firing), and never run past the cap. */
const SCROLL_QUIET_MS = 400;
const SCROLL_TRACE_CAP_MS = 5_000;

/**
 * Every animation frame while the app scrolls: where the sticky block and the sticky header are. A sticky block that judders
 * shows up as `probeTop` or `gap` changing from frame to frame while it should not change at all.
 */
function traceScroll(lastScrollAt: { current: number }): Promise<{ label: string; samples: ScrollSample[] }> {
  return new Promise((resolve) => {
    const samples: ScrollSample[] = [];
    const started = performance.now();
    const round = (n: number) => Math.round(n * 10) / 10;
    const tick = () => {
      const now = performance.now();
      const t = now - started;
      const main = document.querySelector<HTMLElement>("[data-app-scroll]");
      const probe = document.querySelector("[data-scroll-probe]");
      const header = main?.querySelector("header.sticky");
      const probeBox = probe?.getBoundingClientRect();
      const headerBottom = header ? header.getBoundingClientRect().bottom : null;
      const sample: ScrollSample = {
        t: Math.round(t),
        scrollTop: round(main?.scrollTop ?? 0),
        probeTop: probeBox ? round(probeBox.top) : null,
        probeHeight: probeBox ? round(probeBox.height) : null,
        headerBottom: headerBottom === null ? null : round(headerBottom),
        gap: probeBox && headerBottom !== null ? round(probeBox.top - headerBottom) : null,
      };
      const last = samples[samples.length - 1];
      if (!last || JSON.stringify({ ...last, t: 0 }) !== JSON.stringify({ ...sample, t: 0 })) samples.push(sample);
      if (now - lastScrollAt.current < SCROLL_QUIET_MS && t < SCROLL_TRACE_CAP_MS) requestAnimationFrame(tick);
      else resolve({ label: "scroll", samples });
    };
    requestAnimationFrame(tick);
  });
}

export function DomRecorder() {
  const on = useSyncExternalStore(subscribe, readOn, () => false);
  const [link, setLink] = useState<"ok" | "sending" | "lost">("ok");
  const position = useSyncExternalStore(subscribe, readPosition, () => "");
  const drag = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);
  /** A drag ends with a click event on the button; this swallows it so dropping the button does not toggle recording. */
  const swallowClick = useRef(false);

  useEffect(() => {
    if (!on) return;
    let pending: string[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSent = 0;
    let stopped = false;

    async function send(changes: string[]) {
      lastSent = Date.now();
      const reset = startFresh;
      startFresh = false;
      setLink("sending");
      try {
        const path = `${location.pathname}${location.search}`;
        const response = await fetch("/api/dev/dom", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            at: new Date().toISOString(),
            reset,
            path,
            userAgent: navigator.userAgent,
            window: {
              w: innerWidth,
              h: innerHeight,
              visualViewport: visualViewport ? { w: Math.round(visualViewport.width), h: Math.round(visualViewport.height), offsetTop: Math.round(visualViewport.offsetTop), scale: visualViewport.scale } : null,
              safeArea: safeAreaInsets(),
              dpr: devicePixelRatio,
              standalone: matchMedia("(display-mode: standalone)").matches,
              focused: document.activeElement ? document.activeElement.tagName.toLowerCase() : null,
            },
            audit: (({ smallTargets, tooClose, overlapping, smallText, smallInputs, horizontalOverflow, outsideViewport, bottomFixedOverlap, scrollArea, focusedField }) => ({
              smallTargets, tooClose, overlapping, smallText, smallInputs, horizontalOverflow, outsideViewport, bottomFixedOverlap, scrollArea, focusedField,
            }))(measure(path, window)),
            snapshot: snapshotDom(),
            changes,
          }),
        });
        if (!response.ok) throw new Error(String(response.status));
        if (!stopped) setLink("ok");
      } catch {
        // Not delivered: the next send still has to clear the old data.
        if (reset) startFresh = true;
        if (!stopped) setLink("lost");
      }
    }

    function flush() {
      timer = undefined;
      const changes = pending;
      pending = [];
      inFlight = send(changes);
    }

    function schedule() {
      clearTimeout(timer);
      const wait = Math.max(SETTLE_MS, lastSent + MIN_GAP_MS - Date.now());
      timer = setTimeout(flush, wait);
    }

    const observer = new MutationObserver((records) => {
      const lines = summarizeMutations(records);
      if (lines.length === 0) return;
      pending = [...pending, ...lines].slice(-80);
      schedule();
    });
    // The keyboard opening or closing: follow it frame by frame (see traceFrames).
    const sendTrace = async (label: string) => {
      const trace = await traceFrames(label);
      await fetch("/api/dev/dom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trace: { at: new Date().toISOString(), path: `${location.pathname}${location.search}`, ...trace } }),
      }).catch(() => undefined);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches("input,textarea,select")) void sendTrace(`focus ${event.target.tagName.toLowerCase()}`);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches("input,textarea,select")) void sendTrace("blur");
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    // Things that change the look without touching the DOM: the window or visual viewport resizing (keyboard, Safari bars,
    // rotation) and the scrolling area moving. Recorded as a line of their own.
    const note = (line: string) => {
      pending = [...pending, line].slice(-80);
      schedule();
    };
    const onResize = () => note(`~ window resized: ${innerWidth}x${innerHeight}, visual ${visualViewport ? `${Math.round(visualViewport.width)}x${Math.round(visualViewport.height)}` : "n/a"}`);
    const lastScrollAt = { current: 0 };
    let scrollTracing = false;
    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.matches("[data-app-scroll]")) return;
      note(`~ scrolled main to ${Math.round(target.scrollTop)}`);
      // A page with a sticky block to watch (`data-scroll-probe`): follow it frame by frame for as long as the scroll lasts.
      lastScrollAt.current = performance.now();
      if (scrollTracing || !document.querySelector("[data-scroll-probe]")) return;
      scrollTracing = true;
      void traceScroll(lastScrollAt)
        .then((trace) =>
          fetch("/api/dev/dom", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ trace: { at: new Date().toISOString(), path: `${location.pathname}${location.search}`, ...trace } }),
          }),
        )
        .catch(() => undefined)
        .finally(() => {
          scrollTracing = false;
        });
    };
    window.addEventListener("resize", onResize);
    visualViewport?.addEventListener("resize", onResize);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });

    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true });

    // The picture of the page as it is right now, so the developer is not waiting for the first change.
    pending = ["(recording started: first outline of the page)"];
    schedule();

    return () => {
      stopped = true;
      observer.disconnect();
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", onResize);
      visualViewport?.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", onScroll, { capture: true });
      clearTimeout(timer);
    };
  }, [on]);

  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    swallowClick.current = false; // a click left over from an earlier drag must not eat this press
    const box = event.currentTarget.getBoundingClientRect();
    drag.current = { dx: event.clientX - box.left, dy: event.clientY - box.top, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(event.clientX - d.startX, event.clientY - d.startY) < DRAG_SLOP_PX) return;
    d.moved = true;
    const x = Math.min(window.innerWidth - BUTTON_PX - EDGE_PX, Math.max(EDGE_PX, event.clientX - d.dx));
    const y = Math.min(window.innerHeight - BUTTON_PX - EDGE_PX, Math.max(EDGE_PX, event.clientY - d.dy));
    writePosition(`${Math.round(x)},${Math.round(y)}`, false);
  }

  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (d?.moved) {
      swallowClick.current = true;
      writePosition(memoryPosition, true);
    }
  }

  function toggle() {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    const next = !on;
    writeOn(next);
    if (!next) {
      // Switched off: everything measured so far is deleted on the dev server.
      inFlight.then(() => fetch("/api/dev/dom", { method: "DELETE" })).then(
        (response) => toast(response.ok ? "Stopped recording. Measurements cleared" : "Stopped recording, but could not clear the measurements"),
        () => toast("Stopped recording, but could not clear the measurements"),
      );
      return;
    }
    toast("Recording DOM changes");
  }

  return (
    <Button
      data-dev-dom
      type="button"
      size="icon"
      variant={on ? "default" : "secondary"}
      onClick={toggle}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-pressed={on}
      aria-label={on ? "Stop recording DOM changes (dev)" : "Record DOM changes (dev)"}
      // pointer-events-auto: an open sheet or dialog turns off touches on everything outside it.
      // The saved spot is clamped by CSS, so it stays on screen when the window is smaller than when it was saved.
      style={
        position
          ? {
              left: `min(${position.split(",")[0]}px, calc(100vw - ${BUTTON_PX + EDGE_PX}px))`,
              top: `min(${position.split(",")[1]}px, calc(100dvh - ${BUTTON_PX + EDGE_PX}px))`,
            }
          : undefined
      }
      className={cn(
        // touch-none: dragging the button must not scroll the page. Hold and drag to move it; a tap still toggles.
        "pointer-events-auto fixed z-[60] touch-none rounded-full shadow-lg",
        !position && "top-1/2 right-inset-xs",
        !on && "opacity-60",
        // On: a ring while a snapshot is being sent; red when the dev server cannot be reached.
        on && link === "sending" && "ring-4 ring-ring",
        on && link === "lost" && "bg-destructive text-destructive-foreground",
      )}
    >
      <RadioMinimalisticIcon aria-hidden />
    </Button>
  );
}
