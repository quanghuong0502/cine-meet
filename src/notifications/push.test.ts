import { describe, expect, it } from "vitest";
import { normalizeVapidSubject } from "./push";

describe("normalizeVapidSubject", () => {
  it("adds mailto: to a bare email", () => {
    expect(normalizeVapidSubject("a@example.com")).toBe("mailto:a@example.com");
    expect(normalizeVapidSubject("  a@example.com ")).toBe("mailto:a@example.com");
  });
  it("leaves mailto: and https addresses alone", () => {
    expect(normalizeVapidSubject("mailto:a@example.com")).toBe("mailto:a@example.com");
    expect(normalizeVapidSubject("https://app.example.com")).toBe("https://app.example.com");
  });
});
