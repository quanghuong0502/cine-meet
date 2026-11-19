import { describe, expect, it } from "vitest";
import { describeDevice } from "./device";

describe("describeDevice", () => {
  it("names common devices", () => {
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit")).toBe("iphone");
    expect(describeDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126")).toBe("android");
    expect(describeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("mac");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(describeDevice("")).toBe("other");
  });
});
