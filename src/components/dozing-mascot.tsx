"use client";

import { useLayoutEffect, useRef } from "react";
import { Mascot, type MascotPose } from "@/components/mascot";

/** One full sway (there and back), in ms: keep equal to 2x the duration of `--animate-doze` in globals.css. */
const SWAY_CYCLE_MS = 3600;

interface DozingMascotProps {
  pose: MascotPose;
  size?: number;
}

/**
 * A mascot swaying as if dozing off (the loading animation).
 * Loaders get replaced by each other (root loader, full-screen cover, content loader), and a new element would
 * restart the animation from the left. Every instance therefore starts at the phase the shared page clock says,
 * so the sway carries on from where the previous one was.
 */
export function DozingMascot({ pose, size }: DozingMascotProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const phase = Math.round(performance.now()) % SWAY_CYCLE_MS;
    if (ref.current) ref.current.style.animationDelay = `-${phase}ms`;
  }, []);

  return (
    <span ref={ref} className="block origin-bottom motion-safe:animate-doze">
      <Mascot pose={pose} size={size} decorative priority />
    </span>
  );
}
