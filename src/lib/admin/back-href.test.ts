import { describe, expect, it } from "vitest";
import { resolveBackHref } from "./back-href";

const FALLBACK = "/admin/master-data?tab=brands";

describe("resolveBackHref", () => {
  it("keeps a list inside the Catalog, with its tab and search", () => {
    expect(resolveBackHref("/admin/master-data?tab=branches&q=cgv", FALLBACK)).toBe("/admin/master-data?tab=branches&q=cgv");
    expect(resolveBackHref("/admin/master-data", FALLBACK)).toBe("/admin/master-data");
  });

  it("falls back when nothing or something else is given", () => {
    expect(resolveBackHref(undefined, FALLBACK)).toBe(FALLBACK);
    expect(resolveBackHref("", FALLBACK)).toBe(FALLBACK);
    expect(resolveBackHref("/admin/users", FALLBACK)).toBe(FALLBACK);
    expect(resolveBackHref("https://evil.example/admin/master-data", FALLBACK)).toBe(FALLBACK);
    expect(resolveBackHref("//evil.example", FALLBACK)).toBe(FALLBACK);
    expect(resolveBackHref("/admin/master-data\\evil", FALLBACK)).toBe(FALLBACK);
  });
});
