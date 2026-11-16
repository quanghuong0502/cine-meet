"use client";

import { useEffect } from "react";

/**
 * Stops pinch-to-zoom on touch screens (the app should feel like an app, not a web page).
 * Layers: viewport (`maximumScale`, `userScalable` in layout.tsx), CSS `touch-action` (globals.css) and this component,
 * which covers Safari on iOS: it ignores `user-scalable=no` and sends its own `gesture*` events instead.
 * Text still follows the system font size (everything is in rem). A component that needs its own pinch
 * (the seat map) gets it with `touch-action: none` on itself and pointer events: this only cancels the browser's page zoom.
 */
export function NoZoom() {
  useEffect(() => {
    const cancel = (event: Event) => event.preventDefault();
    const cancelMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };

    const gestureEvents = ["gesturestart", "gesturechange", "gestureend"] as const;
    for (const name of gestureEvents) document.addEventListener(name, cancel, { passive: false });
    document.addEventListener("touchmove", cancelMultiTouch, { passive: false });

    return () => {
      for (const name of gestureEvents) document.removeEventListener(name, cancel);
      document.removeEventListener("touchmove", cancelMultiTouch);
    };
  }, []);

  return null;
}
