import { describe, expect, it } from "vitest";
import { rankFrequentBranches, sittingHistoryOf, type ViewingSession } from "./viewing-history.service";

function session(partial: Partial<ViewingSession>): ViewingSession {
  return { at: new Date("2026-01-01"), ...partial };
}

describe("rankFrequentBranches", () => {
  it("orders by how many viewings happened there, most first", () => {
    const sessions = [
      session({ branchId: "a", at: new Date("2026-01-01") }),
      session({ branchId: "b", at: new Date("2026-01-02") }),
      session({ branchId: "b", at: new Date("2026-01-03") }),
      session({ branchId: "c", at: new Date("2026-01-04") }),
      session({ branchId: "c", at: new Date("2026-01-05") }),
      session({ branchId: "c", at: new Date("2026-01-06") }),
    ];
    const result = rankFrequentBranches(sessions);
    expect(result.map((r) => r.branchId)).toEqual(["c", "b", "a"]);
  });

  it("breaks a tie in count by the most recent viewing", () => {
    const sessions = [
      session({ branchId: "old", at: new Date("2026-01-01") }),
      session({ branchId: "recent", at: new Date("2026-02-01") }),
    ];
    const result = rankFrequentBranches(sessions);
    expect(result.map((r) => r.branchId)).toEqual(["recent", "old"]);
  });

  it("ignores sessions with no branch (nothing precise logged)", () => {
    expect(rankFrequentBranches([session({ branchId: undefined })])).toEqual([]);
  });

  it("is empty with no completed viewings", () => {
    expect(rankFrequentBranches([])).toEqual([]);
  });
});

describe("sittingHistoryOf", () => {
  it("counts seats sat in at one room, most-sat first", () => {
    const sessions = [
      session({ auditoriumId: "r1", seatCode: "F7" }),
      session({ auditoriumId: "r1", seatCode: "F7" }),
      session({ auditoriumId: "r1", seatCode: "F8" }),
      session({ auditoriumId: "r2", seatCode: "A1" }), // a different room: not counted here
    ];
    expect(sittingHistoryOf(sessions, "r1")).toEqual([
      { seatCode: "F7", count: 2 },
      { seatCode: "F8", count: 1 },
    ]);
  });
});

describe("sittingHistoryOf with ratings", () => {
  it("attaches the person's own rating to the seats they rated", () => {
    const sessions = [session({ auditoriumId: "r1", seatCode: "F7" }), session({ auditoriumId: "r1", seatCode: "F8" })];
    expect(sittingHistoryOf(sessions, "r1", { F7: 4 })).toEqual([
      { seatCode: "F7", count: 1, rating: 4 },
      { seatCode: "F8", count: 1 },
    ]);
  });
});
