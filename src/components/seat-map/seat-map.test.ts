import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import vi from "@/messages/vi.json";
import { defaultLayoutConfig } from "@/lib/seat-layout/config";
import { buildLayout } from "@/services/seat-layout-build";
import { heatColor } from "./heat-color";
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

  it("draws removed cells as tappable outlines and keeps the grid size", () => {
    const html = render({ onEmptyTap: () => {}, emptyCells: [{ code: "A1", x: 0.5, y: 2.5 }] }, { overrides: [{ row: "A", cols: [1], type: "none" }] });
    expect(html.match(/data-seat="A1"/g)?.length).toBe(2);
  });

  it("shows the heatmap legend and scores only in heatmap mode", () => {
    expect(render()).not.toContain("Điểm cao");
    expect(render({ showHeatmap: true })).toContain("Điểm cao");
  });
});

describe("heatColor", () => {
  it("runs from dark blue to yellow and copes with equal scores", () => {
    expect(heatColor(0, 0, 10)).toBe("rgb(27 42 107)");
    expect(heatColor(10, 0, 10)).toBe("rgb(242 211 56)");
    expect(heatColor(5, 5, 5)).toBe("rgb(242 211 56)");
    expect(heatColor(0, 0, 10)).not.toBe(heatColor(5, 0, 10));
  });
});
