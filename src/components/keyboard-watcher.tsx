"use client";

import { useEffect } from "react";

const TEXT_INPUT = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]), textarea, select, [contenteditable=true]";

/**
 * Marks `<html data-keyboard="open">` while a text field has focus, i.e. the on-screen keyboard is (about to be) up.
 * On an installed iPhone app the keyboard does not resize the page: it covers the bottom, and anything fixed to the
 * bottom (the floating menu, the "Add" button) is left hidden or floating mid-screen. Those carry `data-bottom-fixed`
 * and are hidden while the keyboard is open (see globals.css). Focus events are used because `visualViewport`
 * is unreliable in iOS standalone mode.
 *
 * It also keeps `--vv-height` and `--vv-page-top` up to date (the part of the screen the keyboard leaves free, and where
 * it starts on the page). Safari does not shrink the page for the keyboard: it pans the view up to the focused field, which
 * pushes the header off the top. While the keyboard is open the app shell (`data-app-shell`) is sized and placed from these
 * two values instead (see globals.css), so it always fills exactly the visible part.
 */
export function KeyboardWatcher() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element) || !event.target.matches(TEXT_INPUT)) return;
      clearTimeout(timer);
      root.dataset.keyboard = "open";
    };
    const onFocusOut = () => {
      // Moving from one field to the next fires focusout then focusin: wait a beat so the menu does not flicker.
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!(document.activeElement instanceof Element) || !document.activeElement.matches(TEXT_INPUT)) {
          delete root.dataset.keyboard;
        }
      }, 100);
    };

    const viewport = window.visualViewport;
    let frame = 0;
    const syncViewport = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!viewport) return;
        root.style.setProperty("--vv-height", `${viewport.height}px`);
        root.style.setProperty("--vv-page-top", `${viewport.pageTop}px`);
      });
    };
    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      root.style.removeProperty("--vv-height");
      root.style.removeProperty("--vv-page-top");
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      delete root.dataset.keyboard;
    };
  }, []);

  return null;
}
