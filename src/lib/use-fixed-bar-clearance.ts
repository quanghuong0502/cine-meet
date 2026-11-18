"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * For a page with buttons fixed above the bottom menu: how much room the page must keep at its end so the last content can scroll
 * clear of the buttons. It is only what is really needed:
 * - content that ends above the buttons gets 0, so a short page does not scroll at all;
 * - content that runs under them gets just enough to scroll out from under (not a fixed amount).
 * Attach `contentRef` to the page's content block (its bottom padding is the returned `clear`) and `barRef` to the fixed buttons' box.
 * Everything is measured, so it follows the menu, the safe area and the text size of the phone.
 */
export function useFixedBarClearance() {
  const contentRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [clear, setClear] = useState(0);
  const current = useRef(0);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const bar = barRef.current;
    const main = content?.closest<HTMLElement>("[data-app-scroll]");
    if (!content || !bar || !main) return;

    const measure = () => {
      let next = 0;
      if (bar.offsetHeight > 0) {
        const mainTop = main.getBoundingClientRect().top;
        const gap = parseFloat(getComputedStyle(content).rowGap) || 0;
        // Everything below the content block: the page's own bottom padding and the scroll area's (the room kept for the menu).
        const tail = (parseFloat(getComputedStyle(content.parentElement ?? content).paddingBottom) || 0) + (parseFloat(getComputedStyle(main).paddingBottom) || 0);
        // Where the content ends in the scroll area's own coordinates, without the room this hook adds.
        const contentEnd = content.getBoundingClientRect().bottom - current.current - mainTop + main.scrollTop;
        const barTop = bar.getBoundingClientRect().top - mainTop;
        if (contentEnd + gap > barTop) next = Math.max(0, Math.round(main.clientHeight - tail - barTop + gap));
      }
      if (next !== current.current) {
        current.current = next;
        setClear(next);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(bar);
    observer.observe(main);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return { contentRef, barRef, clear };
}
