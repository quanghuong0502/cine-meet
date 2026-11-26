"use client";

import { useEffect } from "react";

const TEXT_INPUT = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]), textarea, select, [contenteditable=true]";

/**
 * Marks `<html data-keyboard="open">` while a text field has focus and syncs `--vv-height` for bottom sheets
 * ONLY while the keyboard is open (skips resize timers when scrolling Safari's browser chrome).
 */
export function KeyboardWatcher() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let heightTimer: ReturnType<typeof setTimeout> | undefined;

    const syncHeight = () => {
      if (root.dataset.keyboard !== "open") return;
      clearTimeout(heightTimer);
      heightTimer = setTimeout(() => {
        if (viewport && root.dataset.keyboard === "open") root.style.setProperty("--vv-height", `${viewport.height}px`);
      }, 120);
    };
    viewport?.addEventListener("resize", syncHeight);

    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element) || !event.target.matches(TEXT_INPUT)) return;
      root.dataset.keyboard = "open";
      syncHeight();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Element && event.relatedTarget.matches(TEXT_INPUT)) return;
      clearTimeout(heightTimer);
      delete root.dataset.keyboard;
      root.style.removeProperty("--vv-height");
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
