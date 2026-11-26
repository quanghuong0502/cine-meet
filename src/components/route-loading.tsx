"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/loading-state";

/** `app/loading.tsx`: full-screen fallback while an initial route streams in. */
export function RootLoading() {
  return <LoadingState fullScreen />;
}

interface RouteLoadingProps {
  /** What shows in the content area while a route is loading (default: Bubu). */
  inline?: ReactNode;
}

const LOADER_DELAY_MS = 150;

/**
 * Loader of a route inside an app shell: waits briefly so fast navigations never flash a loader,
 * then shows the inline loading state centred in the content area while keeping header and nav.
 */
export function RouteLoading({ inline }: RouteLoadingProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setReady(true), LOADER_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  if (!ready) return null;
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {inline ?? <LoadingState />}
    </div>
  );
}
