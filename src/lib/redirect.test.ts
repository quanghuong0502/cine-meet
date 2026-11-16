import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./redirect";

describe("getSafeRedirectPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(getSafeRedirectPath("/appointments?tab=upcoming")).toBe("/appointments?tab=upcoming");
  });

  it("falls back when the target is missing", () => {
    expect(getSafeRedirectPath(undefined)).toBe("/");
    expect(getSafeRedirectPath("")).toBe("/");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "rejects unsafe target %s",
    (target) => {
      expect(getSafeRedirectPath(target)).toBe("/");
    },
  );
});
