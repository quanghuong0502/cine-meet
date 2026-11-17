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
 * One more thing, for bottom sheets only: `--vv-height` holds the height of the part of the screen the keyboard leaves free
 * (visualViewport), which a sheet uses as its maximum height (globals.css). Measured on an iPhone 14 Pro (iOS 26, installed app)
 * the keyboard shrinks the page's own height (`innerHeight`) together with the visual viewport, so libraries that detect the
 * keyboard from the difference between the two (vaul's repositionInputs) see none, and a tall sheet ends up with its top
 * above the screen. `dvh` does not follow the keyboard either.
 *
 * Nothing else is done about the keyboard on purpose: Safari scrolls the page to the focused field by itself. Resizing or moving
 * the app shell from JavaScript was tried and measured on an iPhone; Safari draws its own scroll one frame before telling the page,
 * so any correction from here arrives a frame late and shows as judder. The native behaviour is smoother.
 */
export function KeyboardWatcher() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const viewport = window.visualViewport;
    let frame = 0;
    const syncHeight = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (viewport && root.dataset.keyboard === "open") root.style.setProperty("--vv-height", `${viewport.height}px`);
      });
    };
    viewport?.addEventListener("resize", syncHeight);

    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element) || !event.target.matches(TEXT_INPUT)) return;
      clearTimeout(timer);
      root.dataset.keyboard = "open";
      syncHeight();
    };
    const onFocusOut = () => {
      // Moving from one field to the next fires focusout then focusin: wait a beat so the menu does not flicker.
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!(document.activeElement instanceof Element) || !document.activeElement.matches(TEXT_INPUT)) {
          delete root.dataset.keyboard;
          root.style.removeProperty("--vv-height");
        }
      }, 100);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", syncHeight);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      delete root.dataset.keyboard;
      root.style.removeProperty("--vv-height");
    };
  }, []);

  return null;
}
