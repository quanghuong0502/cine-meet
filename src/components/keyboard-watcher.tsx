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
 * Nothing else is done about the keyboard on purpose: Safari scrolls the page to the focused field by itself. Resizing or moving
 * the app shell from JavaScript was tried and measured on an iPhone; Safari draws its own scroll one frame before telling the page,
 * so any correction from here arrives a frame late and shows as judder. The native behaviour is smoother.
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

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      delete root.dataset.keyboard;
    };
  }, []);

  return null;
}
