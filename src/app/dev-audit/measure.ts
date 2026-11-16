// Development tool (see dev-audit-button.tsx and /dev-audit): measures a page against the mobile rules in .claude/rules.

export interface Box {
  tag: string;
  label: string;
  w: number;
  h: number;
  x: number;
  y: number;
}

export interface RouteReport {
  route: string;
  viewport: { w: number; h: number };
  loaded: boolean;
  /** Running as an installed app (home screen) rather than in a Safari tab. */
  standalone: boolean;
  devicePixelRatio: number;
  visualViewport: { w: number; h: number } | null;
  /** The scrolling area (`main`): how much content is beyond what is visible. */
  scrollArea: { clientHeight: number; scrollHeight: number } | null;
  smallTargets: Box[];
  tooClose: { a: string; b: string; gap: number }[];
  overlapping: { a: string; b: string }[];
  smallText: { label: string; px: number }[];
  smallInputs: { label: string; px: number }[];
  horizontalOverflow: number;
  outsideViewport: Box[];
  bottomFixedOverlap: string[];
}

const TARGET_SELECTOR = "a[href],button,[role=button],[role=switch],[role=tab],input:not([type=hidden]),select,textarea";
const MIN_TARGET = 44;
const MIN_GAP = 8;

function describe(el: Element): string {
  const label = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
  return `${el.tagName.toLowerCase()}${label ? `:${label}` : ""}`;
}

export function measure(route: string, win: Window): RouteReport {
  const doc = win.document;
  const vw = win.innerWidth;
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = win.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName.toLowerCase(), label: describe(el), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) };
  };

  const targets = [...doc.querySelectorAll(TARGET_SELECTOR)].filter(visible).filter((el) => !el.closest("[data-dev-audit]"));
  const smallTargets = targets.map(box).filter((b) => b.w < MIN_TARGET || b.h < MIN_TARGET);

  const tooClose: RouteReport["tooClose"] = [];
  const overlapping: RouteReport["overlapping"] = [];
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i]!;
      const b = targets[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      // Tabs of one tab bar and segments of one segmented control sit edge to edge by design (iOS patterns); they are big and clearly grouped.
      const group = a.closest('[role="group"],nav[data-bottom-fixed]');
      if (group && group === b.closest('[role="group"],nav[data-bottom-fixed]')) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const dx = Math.max(ra.left - rb.right, rb.left - ra.right);
      const dy = Math.max(ra.top - rb.bottom, rb.top - ra.bottom);
      if (dx < 0 && dy < 0) overlapping.push({ a: describe(a), b: describe(b) });
      else if (Math.max(dx, dy) < MIN_GAP) tooClose.push({ a: describe(a), b: describe(b), gap: Math.round(Math.max(dx, dy)) });
    }
  }

  const smallText: RouteReport["smallText"] = [];
  const smallInputs: RouteReport["smallInputs"] = [];
  for (const el of doc.body.querySelectorAll("*")) {
    if (!visible(el)) continue;
    const px = parseFloat(win.getComputedStyle(el).fontSize);
    if (el.matches("input,select,textarea")) {
      if (px < 16) smallInputs.push({ label: describe(el), px });
    } else if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()) && px < 12) {
      smallText.push({ label: describe(el), px });
    }
  }

  const outsideViewport = [...doc.body.querySelectorAll("*")]
    .filter(visible)
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > vw + 1 || r.left < -1;
    })
    .slice(0, 10)
    .map(box);

  const fixed = [...doc.querySelectorAll("[data-bottom-fixed]")].filter(visible);
  const bottomFixedOverlap: string[] = [];
  for (let i = 0; i < fixed.length; i++) {
    for (let j = i + 1; j < fixed.length; j++) {
      const a = fixed[i]!.getBoundingClientRect();
      const b = fixed[j]!.getBoundingClientRect();
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
        bottomFixedOverlap.push(`${describe(fixed[i]!)} overlaps ${describe(fixed[j]!)}`);
      }
    }
  }

  return {
    route,
    viewport: { w: vw, h: win.innerHeight },
    loaded: true,
    standalone: win.matchMedia("(display-mode: standalone)").matches || (win.navigator as Navigator & { standalone?: boolean }).standalone === true,
    devicePixelRatio: win.devicePixelRatio,
    visualViewport: win.visualViewport ? { w: Math.round(win.visualViewport.width), h: Math.round(win.visualViewport.height) } : null,
    scrollArea: (() => {
      const area = doc.querySelector("[data-app-scroll]");
      return area ? { clientHeight: area.clientHeight, scrollHeight: area.scrollHeight } : null;
    })(),
    smallTargets: smallTargets.slice(0, 30),
    tooClose: tooClose.slice(0, 30),
    overlapping: overlapping.slice(0, 30),
    smallText: smallText.slice(0, 20),
    smallInputs: smallInputs.slice(0, 20),
    horizontalOverflow: doc.documentElement.scrollWidth - vw,
    outsideViewport,
    bottomFixedOverlap,
  };
}
