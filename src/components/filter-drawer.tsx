"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

export interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Lazy-loaded Vaul + Radix Dialog bottom sheet (~77 KB raw) fetched only when the user opens a filter sheet. */
export const LazyFilterDrawer = dynamic(
  () => import("@/components/filter-drawer-inner").then((m) => m.FilterDrawerInner),
  { ssr: false },
);
