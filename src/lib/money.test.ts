import { describe, expect, it } from "vitest";
import { formatVnd, formatVndRange } from "./money";

const normal = (text: string) => text.replace(/ /g, " ");

describe("formatVndRange", () => {
  it("writes the Vietnamese symbol once, after the upper amount", () => {
    expect(normal(formatVndRange(60000, 120000, "vi"))).toBe("60.000 – 120.000 ₫");
  });

  it("writes the symbol on both amounts in English", () => {
    expect(formatVndRange(60000, 120000, "en")).toBe(`${formatVnd(60000, "en")} – ${formatVnd(120000, "en")}`);
  });
});
