"use client";

import { LoaderCircle, Ruler } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { measure, type RouteReport } from "@/app/dev-audit/measure";
import { Button } from "@/components/ui/button";

/**
 * Development only (rendered by the root layout when NODE_ENV is not production; strings are not translated on purpose).
 * Tap it on a phone: it measures the page on screen, against the mobile rules, and sends the numbers to the dev server
 * (`.next/dev-audit.json`) for whoever is developing to read.
 */
export function DevAuditButton() {
  const [busy, setBusy] = useState(false);
  // Measured the moment the finger touches down, before the tap can take focus from a field: the keyboard would close first.
  const snapshot = useRef<RouteReport | null>(null);

  async function send() {
    setBusy(true);
    try {
      const route = `${location.pathname}${location.search}`;
      const report = snapshot.current ?? measure(route, window);
      snapshot.current = null;
      const response = await fetch("/api/dev/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at: new Date().toISOString(), userAgent: navigator.userAgent, done: true, report }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const problems = report.smallTargets.length + report.tooClose.length + report.overlapping.length + report.smallText.length + report.smallInputs.length;
      toast.success(`Sent ${route}: ${problems} things to look at`);
    } catch {
      toast.error("Could not send the measurements");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      data-dev-audit
      type="button"
      size="icon"
      onPointerDown={() => {
        snapshot.current = measure(`${location.pathname}${location.search}`, window);
      }}
      onClick={send}
      disabled={busy}
      aria-label="Send page measurements (dev)"
      // pointer-events-auto: an open sheet or dialog turns off touches on everything outside it.
      className="pointer-events-auto fixed top-1/2 right-2 z-[60] rounded-full opacity-80 shadow-lg"
    >
      {busy ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Ruler aria-hidden />}
    </Button>
  );
}
