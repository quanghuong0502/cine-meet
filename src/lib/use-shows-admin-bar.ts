"use client";

import { usePathname } from "next/navigation";
import { showsAdminBar } from "@/lib/admin-nav";
import { useHoldingBottomBar } from "@/lib/entry-loading-store";

/** Whether the admin bottom bar is on screen for the current page (see `showsAdminBar`). */
export function useShowsAdminBar(): boolean {
  return showsAdminBar(usePathname(), useHoldingBottomBar());
}
