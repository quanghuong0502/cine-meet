"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppOpenedMarker } from "@/components/route-loading";
import { measure, type RouteReport } from "./measure";

const LOAD_TIMEOUT_MS = 20_000;

export function AuditRunner({ routes }: { routes: string[] }) {
  const [index, setIndex] = useState(0);
  // The phone's own window size, read once on the client ("" while rendering on the server).
  const sizeText = useSyncExternalStore(
    () => () => undefined,
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => "",
  );
  const size = sizeText ? { w: Number(sizeText.split("x")[0]), h: Number(sizeText.split("x")[1]) } : null;
  const reports = useRef<RouteReport[]>([]);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!size) return;
    if (index >= routes.length) return;
    const route = routes[index]!;
    let cancelled = false;
    const started = Date.now();

    const send = async (done: boolean) => {
      await fetch("/api/dev/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at: new Date().toISOString(), userAgent: navigator.userAgent, done, reports: reports.current }),
      }).catch(() => undefined);
    };

    const poll = setInterval(async () => {
      const win = frame.current?.contentWindow;
      const ready =
        win &&
        win.document.readyState === "complete" &&
        win.location.pathname !== "about:blank" &&
        !win.document.querySelector('[role="status"]') &&
        win.document.body.children.length > 0;
      const timedOut = Date.now() - started > LOAD_TIMEOUT_MS;
      if (cancelled || (!ready && !timedOut)) return;
      clearInterval(poll);
      // A moment for fonts and images to settle after the loader is gone.
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (cancelled) return;
      const report: RouteReport = win && ready
        ? measure(route, win)
        : { route, viewport: size, loaded: false, standalone: false, devicePixelRatio: 1, visualViewport: null, focusedField: null, scrollArea: null, smallTargets: [], tooClose: [], overlapping: [], smallText: [], smallInputs: [], horizontalOverflow: 0, outsideViewport: [], bottomFixedOverlap: [] };
      reports.current = [...reports.current, report];
      const last = index + 1 >= routes.length;
      await send(last);
      setIndex(index + 1);
    }, 400);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [index, routes, sizeText]); // eslint-disable-line react-hooks/exhaustive-deps

  const status =
    index >= routes.length
      ? "Done. You can close this page."
      : size
        ? `Measuring ${index + 1}/${routes.length}: ${routes[index]}`
        : "Starting...";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <AppOpenedMarker />
      <p className="text-base font-semibold">Dev audit</p>
      <p className="text-sm text-muted-foreground">{status}</p>
      {size && index < routes.length ? (
        // Off screen, but with the phone's own size, so every screen lays out exactly as it would on this phone.
        <iframe
          key={routes[index]}
          ref={frame}
          src={routes[index]}
          title="audit"
          aria-hidden
          tabIndex={-1}
          style={{ position: "fixed", left: -10000, top: 0, width: size.w, height: size.h, border: 0 }}
        />
      ) : null}
    </main>
  );
}
