"use client";

import { Radio } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { measure } from "@/app/dev-audit/measure";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "devAgent";
const RETRY_MS = 2_000;
const MAX_RESULT_CHARS = 200_000;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<unknown>;

// Where the switch lives: localStorage, with a variable as fallback when that is not available (private mode).
// Read through useSyncExternalStore so the server render and the first client render agree (switch off), and the saved value is applied right after.
let memoryEnabled = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return memoryEnabled;
  }
}

function writeEnabled(value: boolean) {
  memoryEnabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  } catch {
    // Not available: the variable above is used instead.
  }
  listeners.forEach((listener) => listener());
}

function serialize(value: unknown): unknown {
  if (value === undefined) return null;
  const text = JSON.stringify(value, (_key, item) => (item instanceof Element ? item.outerHTML.slice(0, 300) : item));
  if (text === undefined) return String(value);
  return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}...(cut)` : JSON.parse(text);
}

/**
 * Development only (see src/lib/dev-agent.ts). While switched on, this page asks the dev server for JavaScript to run,
 * runs it here (on the real phone) and sends the result back, so the developer can navigate, tap and measure
 * without anyone touching the phone. The switch survives page loads, so it keeps working while the agent navigates.
 */
export function DevAgent() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => false);
  // "connected": the last request to the dev server succeeded. "running": a command is being run right now.
  const [link, setLink] = useState<"connecting" | "connected" | "running" | "lost">("connecting");

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let stopped = false;

    async function loop() {
      while (!stopped) {
        try {
          const response = await fetch("/api/dev/agent", { signal: controller.signal });
          if (!response.ok) throw new Error(String(response.status));
          setLink("connected");
          const command = (await response.json()) as { id?: string; code?: string };
          if (!command.id || !command.code) continue;

          setLink("running");
          let outcome: { ok: boolean; result?: unknown; error?: string };
          try {
            const result = await new AsyncFunction("measure", command.code)(measure);
            outcome = { ok: true, result: serialize(result) };
          } catch (error) {
            outcome = { ok: false, error: error instanceof Error ? error.message : String(error) };
          }
          await fetch("/api/dev/agent", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: command.id, ...outcome }),
            signal: controller.signal,
          });
        } catch {
          if (stopped) return;
          setLink("lost");
          await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
        }
      }
    }
    void loop();

    return () => {
      stopped = true;
      controller.abort();
    };
  }, [enabled]);

  function toggle() {
    const next = !enabled;
    writeEnabled(next);
    if (next) setLink("connecting");
    toast(next ? "Dev agent on: waiting for the dev server" : "Dev agent off");
  }

  const label = !enabled ? "off" : link === "running" ? "running a command" : link === "connected" ? "connected" : link === "lost" ? "cannot reach the dev server" : "connecting";

  return (
    <Button
      data-dev-audit
      type="button"
      size="icon"
      variant={enabled ? "default" : "secondary"}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={`Dev agent ${label} (tap to ${enabled ? "stop" : "start"})`}
      className={cn(
        "pointer-events-auto fixed top-[calc(50%+3rem)] right-2 z-[60] rounded-full shadow-lg",
        !enabled && "opacity-60",
        // Connected: solid with a calm pulse. Running: a bright ring. Lost: red, so it is obvious something is wrong.
        enabled && link === "connected" && "motion-safe:animate-pulse",
        enabled && link === "running" && "ring-4 ring-ring",
        enabled && link === "lost" && "bg-destructive text-destructive-foreground",
      )}
    >
      <Radio aria-hidden />
    </Button>
  );
}
