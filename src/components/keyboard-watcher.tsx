"use client";

import { useEffect } from "react";

const TEXT_INPUT =
  "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]):not([type=file]):not([type=color]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled]), [contenteditable=true]";

/**
 * Marks `<html data-keyboard="open">` while a text field has focus and syncs `--vv-height` for bottom sheets
 * ONLY while the keyboard is open (skips resize timers when scrolling Safari's browser chrome).
 * Also clears keyboard state when Android back-dismisses the soft keyboard without firing `focusout`.
 */
export function KeyboardWatcher() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let heightTimer: ReturnType<typeof setTimeout> | undefined;
    let sawShrink = false;

    const clearKeyboard = () => {
      clearTimeout(heightTimer);
      sawShrink = false;
      delete root.dataset.keyboard;
      root.style.removeProperty("--vv-height");
    };

    const syncHeight = () => {
      if (root.dataset.keyboard !== "open") return;
      clearTimeout(heightTimer);
      heightTimer = setTimeout(() => {
        if (!viewport || root.dataset.keyboard !== "open") return;
        const ratio = window.innerHeight > 0 ? viewport.height / window.innerHeight : 1;
        if (ratio < 0.82) sawShrink = true;
        else if (sawShrink && ratio >= 0.92) {
          // Android back gesture dismissed the keyboard while keeping focus on the input.
          clearKeyboard();
          return;
        }
        root.style.setProperty("--vv-height", `${viewport.height}px`);
      }, 120);
    };
    viewport?.addEventListener("resize", syncHeight);

    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element) || !event.target.matches(TEXT_INPUT)) return;
      sawShrink = false;
      root.dataset.keyboard = "open";
      syncHeight();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Element && event.relatedTarget.matches(TEXT_INPUT)) return;
      clearKeyboard();
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      clearTimeout(heightTimer);
      viewport?.removeEventListener("resize", syncHeight);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      delete root.dataset.keyboard;
      root.style.removeProperty("--vv-height");
    };
  }, []);

  return null;
}
