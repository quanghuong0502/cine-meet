"use client";

import { Radio } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
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

export function DomRecorder() {
  const on = useSyncExternalStore(subscribe, readOn, () => false);
  const [link, setLink] = useState<"ok" | "sending" | "lost">("ok");

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
    // Things that change the look without touching the DOM: the window or visual viewport resizing (keyboard, Safari bars,
    // rotation) and the scrolling area moving. Recorded as a line of their own.
    const note = (line: string) => {
      pending = [...pending, line].slice(-80);
      schedule();
    };
    const onResize = () => note(`~ window resized: ${innerWidth}x${innerHeight}, visual ${visualViewport ? `${Math.round(visualViewport.width)}x${Math.round(visualViewport.height)}` : "n/a"}`);
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.matches("[data-app-scroll]")) note(`~ scrolled main to ${Math.round(target.scrollTop)}`);
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
      window.removeEventListener("resize", onResize);
      visualViewport?.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", onScroll, { capture: true });
      clearTimeout(timer);
    };
  }, [on]);

  function toggle() {
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
      aria-pressed={on}
      aria-label={on ? "Stop recording DOM changes (dev)" : "Record DOM changes (dev)"}
      // pointer-events-auto: an open sheet or dialog turns off touches on everything outside it.
      className={cn(
        "pointer-events-auto fixed top-1/2 right-2 z-[60] rounded-full shadow-lg",
        !on && "opacity-60",
        // On: a ring while a snapshot is being sent; red when the dev server cannot be reached.
        on && link === "sending" && "ring-4 ring-ring",
        on && link === "lost" && "bg-destructive text-destructive-foreground",
      )}
    >
      <Radio aria-hidden />
    </Button>
  );
}
