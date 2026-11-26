"use client";

import dynamic from "next/dynamic";

/** Lazy-loaded confirmation & reason dialogs so Radix Dialog (~50 KB) is only fetched when a dialog actually opens. */
export const LazyConfirmDialog = dynamic(
  () => import("@/components/confirm-dialog").then((m) => m.ConfirmDialog),
  { ssr: false },
);

export const LazyReasonDialog = dynamic(
  () => import("@/components/appointment/reason-dialog").then((m) => m.ReasonDialog),
  { ssr: false },
);
