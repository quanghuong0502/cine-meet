"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/loading-state";

// True once a route loader has been replaced by real content in this page load, i.e. the app is already open.
let appHasOpened = false;

/**
 * Loader for a route inside an app shell (header + bottom bar):
 * - the first time the app opens it covers the whole screen (shell included) until the page is ready,
 *   so it looks like one continuous full-screen loader with the one in `app/loading.tsx`;
 * - nested loaders (a page under a segment loader) also cover the shell while the first open is still going on:
 *   the flag only flips when a loader is removed, after the next one has already been rendered;
 * - later, when moving between pages, it only fills the content area and the header and bottom bar stay.
 */
interface RouteLoadingProps {
  /** What shows in the content area once the app is open (default: Bubu). */
  inline?: ReactNode;
}

export function RouteLoading({ inline = <LoadingState /> }: RouteLoadingProps) {
  // Decided once per mount: it must not switch layout while it is showing.
  const [coversShell] = useState(() => !appHasOpened);

  useEffect(() => {
    return () => {
      appHasOpened = true;
    };
  }, []);

  return coversShell ? (
    <LoadingState fullScreen className="fixed inset-0 z-50 bg-background" />
  ) : (
    inline
  );
}
