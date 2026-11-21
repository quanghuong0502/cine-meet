import { describe, expect, it } from "vitest";
import { applyFilters, availableValues, parseFilters, type FacetRecord } from "./filters";

const rec = (status: FacetRecord["status"], isCreator: boolean, needsReply = false): FacetRecord => ({ status, isCreator, needsReply });
const all = [rec("INVITING", false, true), rec("CONFIRMED", true), rec("PLANNING", true), rec("DRAFT", true), rec("COMPLETED", false)];

describe("appointment filters", () => {
  it("filters by status and role", () => {
    expect(applyFilters(all, { status: "planning" })).toHaveLength(1);
    expect(applyFilters(all, { status: "inviting" })).toHaveLength(1);
    expect(applyFilters(all, { status: "reply" })).toHaveLength(1);
    expect(applyFilters(all, { status: "completed" })).toHaveLength(1);
    expect(applyFilters(all, { role: "mine", status: "planning" })).toHaveLength(1);
    expect(applyFilters(all, {})).toHaveLength(5);
  });
  it("ignores unknown values", () => {
    expect(parseFilters({ status: "bogus", role: "mine" })).toEqual({ role: "mine" });
  });
  it("offers only choices that still have a result", () => {
    const available = availableValues([rec("CONFIRMED", true)], {});
    expect([...available.status]).toEqual(["confirmed"]);
    expect([...available.role]).toEqual(["mine"]);
  });
});
