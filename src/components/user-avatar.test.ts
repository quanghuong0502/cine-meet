import { describe, expect, it } from "vitest";
import { getInitials } from "./user-avatar";

describe("getInitials", () => {
  it("takes the first letter of the first and last word", () => {
    expect(getInitials("Lan Anh Nguyen")).toBe("LN");
    expect(getInitials("quang")).toBe("Q");
    expect(getInitials("  Quang   Hướng ")).toBe("QH");
  });
  it("leaves out anything in brackets", () => {
    expect(getInitials("An (mẫu)")).toBe("A");
    expect(getInitials("Bình (mẫu)")).toBe("B");
    expect(getInitials("Trần Văn An (mẫu)")).toBe("TA");
  });
  it("skips leading symbols and never returns nothing", () => {
    expect(getInitials("@binh")).toBe("B");
    expect(getInitials("")).toBe("?");
    expect(getInitials("(mẫu)")).toBe("?");
  });
});
