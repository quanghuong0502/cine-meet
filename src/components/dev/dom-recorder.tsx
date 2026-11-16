"use client";

import { Radio } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { snapshotDom, summarizeMutations } from "./dom-snapshot";
import { measure } from "./measure";

/**
 * Development only (rendered by the root layout when NODE_ENV is not production; strings are not translated on purpose).
 * One button. While it is on, every time the page's DOM changes this sends the developer what changed and an outline of
 * the whole page (elements, classes, text, position and size on screen) to /api/dev/dom, which keeps it in `.next/dev-dom.json`.
 * It only reads the page; it never runs anything sent from outside.
 */

const STORAGE_KEY = "devDomRecorder";
/** Wait for the changes to settle before sending, and never send more often than this. */
const SETTLE_MS = 500;
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
function writeOn(value: boolean) {
  memoryOn = value;
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
      setLink("sending");
      try {
        const path = `${location.pathname}${location.search}`;
        const response = await fetch("/api/dev/dom", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            at: new Date().toISOString(),
            path,
            userAgent: navigator.userAgent,
            window: {
              w: innerWidth,
              h: innerHeight,
              visualViewport: visualViewport ? { w: Math.round(visualViewport.width), h: Math.round(visualViewport.height) } : null,
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
        if (!stopped) setLink("lost");
      }
    }

    function flush() {
      timer = undefined;
      const changes = pending;
      pending = [];
      void send(changes);
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
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true });

    // The picture of the page as it is right now, so the developer is not waiting for the first change.
    pending = ["(recording started: first outline of the page)"];
    schedule();

    return () => {
      stopped = true;
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [on]);

  function toggle() {
    const next = !on;
    writeOn(next);
    toast(next ? "Recording DOM changes" : "Stopped recording");
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
