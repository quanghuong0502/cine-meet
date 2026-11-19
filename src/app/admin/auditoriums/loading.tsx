"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { LoadingState } from "@/components/loading-state";
import { RouteLoading } from "@/components/route-loading";
import { setHoldingBottomBar } from "@/lib/entry-loading-store";

/**
 * Opening the room list or one of its entry screens: the shell stays and only the content area is the loader.
 * An entry screen's path already hides the bottom bar, but the person still looks at the list they tapped in, so the bar is held until the screen arrives.
 */
export default function AuditoriumsLoading() {
  const holdBar = /^\/admin\/auditoriums\/.+/.test(usePathname());
  useLayoutEffect(() => {
    if (!holdBar) return;
    setHoldingBottomBar(true);
    return () => setHoldingBottomBar(false);
  }, [holdBar]);
  return <RouteLoading inline={<LoadingState compact />} />;
}
