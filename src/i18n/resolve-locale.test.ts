import { describe, expect, it } from "vitest";
import { resolveLocale } from "./resolve-locale";

describe("resolveLocale", () => {
  it("prefers a valid cookie over the browser language", () => {
    expect(resolveLocale("en", "vi-VN,vi;q=0.9")).toBe("en");
    expect(resolveLocale("vi", "en-US,en;q=0.9")).toBe("vi");
  });

  it("ignores an unknown cookie value", () => {
    expect(resolveLocale("fr", "en-US")).toBe("en");
    expect(resolveLocale("", null)).toBe("vi");
  });

  it("uses Accept-Language, honoring order and q-values", () => {
    expect(resolveLocale(undefined, "en-US,en;q=0.9,vi;q=0.8")).toBe("en");
    expect(resolveLocale(undefined, "fr;q=0.9,vi;q=0.5,en;q=0.2")).toBe("vi");
    expect(resolveLocale(undefined, "en;q=0.3, vi;q=0.8")).toBe("vi");
  });

  it("falls back to Vietnamese when nothing matches", () => {
    expect(resolveLocale(undefined, "fr-FR,de;q=0.8")).toBe("vi");
    expect(resolveLocale(undefined, null)).toBe("vi");
    expect(resolveLocale(null, "")).toBe("vi");
  });
});
