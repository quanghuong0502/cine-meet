import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import vi from "@/messages/vi.json";
import { defaultLayoutConfig } from "@/lib/seat-layout/config";
import { buildLayout } from "@/services/seat-layout-build";
import { heatColor, heatLevel, heatRange, heatTextColor } from "./heat-color";
import { SeatMap } from "./seat-map";

const TYPES = [
  { id: "std", name: "Thường", capacity: 1, color: "#5b6b8c" },
  { id: "couple", name: "Đôi", capacity: 2, color: "#c61583" },
];

// Typed loosely: createElement's children argument and the provider's required `children` prop do not agree.
const Provider = NextIntlClientProvider as unknown as React.FC<{ locale: string; messages: typeof vi; children?: React.ReactNode }>;

function render(props: Partial<React.ComponentProps<typeof SeatMap>> = {}, patch = {}) {
  const config = { ...defaultLayoutConfig("std"), rows: 4, cols: 6, ...patch };
  const built = buildLayout(config, TYPES);
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale: "vi", messages: vi },
      createElement(SeatMap, { geometry: built.geometry, seats: built.seats, seatTypes: TYPES, ...props }),
    ),
  );
}

describe("SeatMap", () => {
  it("draws every seat, the screen label and the zoom buttons", () => {
    const html = render();
    expect(html.match(/data-seat="/g)?.length).toBe(24 * 2); // group and rect carry it
    expect(html).toContain("MÀN HÌNH");
    expect(html).toContain('aria-label="Phóng to"');
  });

  it("makes seats buttons only when they can be tapped, with a spoken label", () => {
    expect(render()).not.toContain('role="button"');
    const html = render({ onSeatTap: () => {}, selectedCodes: new Set(["A1"]) });
    expect(html).toContain('aria-label="Ghế A1, Thường, điểm ');
    expect(html).toContain('aria-pressed="true"');
  });

  it("draws the selection ring with a fixed screen width, so it does not thicken when zoomed", () => {
    const html = render({ onSeatTap: () => {}, selectedCodes: new Set(["A1"]) });
    const ring = html.match(/<rect[^>]*stroke="var\(--foreground\)"[^>]*>/g)?.find((r) => r.includes('stroke-width="1.5"'));
    expect(ring).toBeDefined();
    expect(ring).toContain('vector-effect="non-scaling-stroke"');
  });

  it("draws removed cells as tappable outlines and keeps the grid size", () => {
    const html = render({ onEmptyTap: () => {}, emptyCells: [{ code: "A1", x: 0.5, y: 2.5 }] }, { overrides: [{ row: "A", cols: [1], type: "none" }] });
    expect(html.match(/data-seat="A1"/g)?.length).toBe(2);
  });

  it("shows the heatmap legend and scores only in heatmap mode", () => {
    expect(render()).not.toContain("Điểm cao");
    expect(render({ showHeatmap: true })).toContain("Điểm cao");
  });
});

describe("SeatMap entrances", () => {
  /** y and height of the outlined door bars, and the baseline of the column numbers. */
  function doors(html: string) {
    return [...html.matchAll(/<rect x="[^"]+" y="([^"]+)" width="[^"]+" height="[^"]+" rx="0.08" fill="none" stroke="var\(--primary\)"/g)].map((m) => Number(m[1]));
  }

  it("draws a back-centre door below the column numbers, labelled, not over them", () => {
    const config = { ...defaultLayoutConfig("std"), rows: 4, cols: 6, entrances: [{ side: "center" as const, position: "back" as const }] };
    const html = render({}, config);
    const { lastRowY } = buildLayout({ ...defaultLayoutConfig("std"), rows: 4, cols: 6 }, TYPES).geometry;
    const [top] = doors(html);
    // Column numbers are drawn at lastRowY + 1.2 (baseline); the bar must start below that.
    expect(top).toBeGreaterThan(lastRowY + 1.2 + 0.15);
    expect(html).toContain(">Cửa<");
    expect(html).toContain("<title>Cửa ra vào</title>");
  });

  it("outlines the door instead of filling it, so it cannot be mistaken for a selected seat", () => {
    const html = render({}, { entrances: [{ side: "right", position: "back" }] });
    expect(doors(html)).toHaveLength(1);
    expect(html).not.toMatch(/<rect[^>]*fill="var\(--primary\)" opacity="0.75"/);
  });

  it("makes room only on the side that has a door", () => {
    const viewBox = (patch: object) => /viewBox="([^"]+)"/.exec(render({}, patch))![1].split(" ").map(Number);
    const none = viewBox({ entrances: [] });
    const left = viewBox({ entrances: [{ side: "left", position: "back" }] });
    expect(left[0]).toBeLessThan(none[0]);
    expect(left[2]).toBeGreaterThan(none[2]);
  });
});

describe("heatColor", () => {
  it("runs dark shade, brand colour, pale tint across the scale and copes with equal scores", () => {
    expect(heatColor(0, 0, 10)).toBe("color-mix(in oklch, oklch(0.34 0.08 var(--brand-h)), var(--primary) 0%)");
    expect(heatColor(5, 0, 10)).toBe("color-mix(in oklch, oklch(0.34 0.08 var(--brand-h)), var(--primary) 100%)");
    expect(heatColor(10, 0, 10)).toBe("color-mix(in oklch, var(--primary), oklch(0.94 0.07 var(--brand-h)) 100%)");
    expect(heatColor(7.5, 0, 10)).toContain("oklch(0.94 0.07 var(--brand-h)) 50%)");
    expect(heatColor(5, 5, 5)).toBe(heatColor(10, 0, 10));
    // Scores outside the range stay on the scale.
    expect(heatColor(-5, 0, 10)).toBe(heatColor(0, 0, 10));
    expect(heatColor(99, 0, 10)).toBe(heatColor(10, 0, 10));
  });

  it("follows the brand: it names the brand hue and the primary token, no fixed colour", () => {
    for (const score of [0, 3, 8, 10]) {
      const colour = heatColor(score, 0, 10);
      expect(colour).toContain("var(--brand-h)");
      expect(colour).toContain("var(--primary)");
      expect(colour).not.toMatch(/rgb|hsl|#/);
    }
  });

  it("gives every step its own colour, so neighbouring scores can be told apart", () => {
    const colours = new Set(Array.from({ length: 11 }, (_, i) => heatColor(i, 0, 10)));
    expect(colours.size).toBe(11);
  });

  it("uses white text on the dark and middle part and dark text on the pale end", () => {
    expect(heatTextColor(0, 0, 10)).toBe("#fff");
    expect(heatTextColor(5, 0, 10)).toBe("#fff");
    expect(heatTextColor(10, 0, 10)).not.toBe("#fff");
    expect(heatLevel(6.2, 0, 10)).toBeCloseTo(0.62);
  });
});

describe("heatRange", () => {
  it("ignores broken and blocked seats so one bad seat does not flatten the scale", () => {
    const seats = [
      { score: 0, flags: ["broken"] },
      { score: 25, flags: ["obstructed"] },
      { score: 60, flags: [] },
      { score: 90, flags: [] },
    ];
    expect(heatRange(seats)).toEqual({ min: 60, max: 90 });
    // The broken seat still gets a colour: the low end.
    expect(heatColor(0, 60, 90)).toBe(heatColor(60, 60, 90));
  });

  it("uses every seat when none is normal, and copes with no seats", () => {
    expect(heatRange([{ score: 10, flags: ["broken"] }, { score: 30, flags: ["broken"] }])).toEqual({ min: 10, max: 30 });
    expect(heatRange([])).toEqual({ min: 0, max: 0 });
  });
});
