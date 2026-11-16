"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/loading-state";

// State per page load, kept on `globalThis` (not in a module variable) so that a hot reload in dev, or a second copy
// of this module in the bundle, cannot reset it to "not opened" in the middle of a session.
// `opened`: the app shell has been shown and no full-screen loader is left.
const state = ((globalThis as { __routeLoading?: { opened: boolean; covering: number } }).__routeLoading ??= {
  opened: false,
  covering: 0,
});

function markOpenedWhenIdle() {
  // Deferred: when one full-screen loader hands over to the next (nested routes, React strict mode in dev)
  // the new one mounts in the same tick, so the count is not zero yet.
  setTimeout(() => {
    if (state.covering === 0) state.opened = true;
  }, 0);
}

/**
 * Put once in the layout of an app area (user, admin). Covers the case where the first page was ready
 * so fast that no loader ever showed: the app is open, so the next page change must keep the shell.
 */
export function AppOpenedMarker() {
  useEffect(markOpenedWhenIdle, []);
  return null;
}

interface RouteLoadingProps {
  /** What shows in the content area once the app is open (default: Bubu). */
  inline?: ReactNode;
}

/**
 * Loader for a route inside an app shell (header + bottom bar):
 * - the first time the app opens it covers the whole screen (shell included) until the page is ready,
 *   so it looks like one continuous full-screen loader with the one in `app/loading.tsx`;
 * - nested loaders (a page under a segment loader) also cover the shell while the first open is still going on;
 * - later, when moving between pages, it only fills the content area and the header and bottom bar stay.
 */
export function RouteLoading({ inline = <LoadingState /> }: RouteLoadingProps) {
  // Decided once per mount: it must not switch layout while it is showing.
  const [coversShell] = useState(() => !state.opened);

  useEffect(() => {
    if (!coversShell) return;
    state.covering += 1;
    return () => {
      state.covering -= 1;
      markOpenedWhenIdle();
    };
  }, [coversShell]);

  return coversShell ? (
    <LoadingState fullScreen className="fixed inset-0 z-50 bg-background" />
  ) : (
    inline
  );
}
