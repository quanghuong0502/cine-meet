import { describe, expect, it } from "vitest";
import { vietnamToIso } from "./datetime";

describe("vietnamToIso", () => {
  it("reads the typed time as Vietnam time, whatever the device zone is", () => {
    expect(vietnamToIso("2026-11-20", "19:30")).toBe("2026-11-20T12:30:00.000Z");
  });
  it("rejects missing or impossible values", () => {
    expect(vietnamToIso("", "19:30")).toBeNull();
    expect(vietnamToIso("2026-11-20", "")).toBeNull();
    expect(vietnamToIso("2026-13-40", "19:30")).toBeNull();
  });
});
