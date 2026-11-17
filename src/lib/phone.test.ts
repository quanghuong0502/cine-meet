import { describe, expect, it } from "vitest";
import { formatVietnamPhone, normalizeVietnamPhone } from "./phone";

describe("normalizeVietnamPhone", () => {
  it("turns the usual ways of writing a number into 84xxxxxxxxx", () => {
    for (const input of ["0912345678", "0912 345 678", "+84 912 345 678", "84912345678", "(0912) 345-678", "0912.345.678"]) {
      expect(normalizeVietnamPhone(input)).toBe("84912345678");
    }
  });

  it("rejects what is not a Vietnamese mobile number", () => {
    for (const input of ["", "abc", "091234567", "09123456789", "0212345678", "12345678901", "+1 415 555 0100", "0912-abc-678", "84 12 345 678"]) {
      expect(normalizeVietnamPhone(input)).toBeNull();
    }
  });

  it("formats a stored number for display", () => {
    expect(formatVietnamPhone("84912345678")).toBe("0912 345 678");
    expect(formatVietnamPhone("weird")).toBe("weird");
  });
});
