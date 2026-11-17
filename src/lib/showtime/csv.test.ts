import { describe, expect, it } from "vitest";
import { parseCsv, resolveCsvRows, type CsvLookups } from "./csv";
import { overlaps, showtimeEnd, timeSlotOf, vietnamInstant } from "./time";

const lookups: CsvLookups = {
  movies: [{ id: "m1", title: "Mai", originalTitle: "Mai (2024)", durationMin: 130 }],
  branches: [{ id: "b1", name: "CGV Vincom" }],
  auditoriums: [
    { id: "a1", branchId: "b1", name: "Phòng 1", currentLayoutId: "l1" },
    { id: "a2", branchId: "b1", name: "Phòng 2", currentLayoutId: null },
  ],
  formats: [{ id: "f1", name: "2D" }],
};

describe("parseCsv", () => {
  it("handles quotes, semicolons, tabs and blank lines", () => {
    expect(parseCsv('a,"b, c",d\n\n1,2,3\r\n')).toEqual([["a", "b, c", "d"], ["1", "2", "3"]]);
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', "x"]]);
  });
});

describe("resolveCsvRows", () => {
  const header = "movie,branch,auditorium,start,format,price\n";
  it("resolves names without caring for accents or case, price optional", () => {
    const { rows, errors } = resolveCsvRows(`${header}mai,cgv vincom,phong 1,2026-11-20 19:30,2d,\nMai,CGV Vincom,Phòng 1,2026-11-20 9:05,2D,90.000`, lookups);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ movieId: "m1", auditoriumId: "a1", layoutId: "l1", formatId: "f1", durationMin: 130 });
    expect(rows[0].startAt.toISOString()).toBe("2026-11-20T12:30:00.000Z");
    expect(rows[1].priceOverride).toBe(90000);
  });

  it("reports each bad line with its number and the cell", () => {
    const text = [
      header.trim(),
      "Nope,CGV Vincom,Phòng 1,2026-11-20 19:30,2D,",
      "Mai,Lotte,Phòng 1,2026-11-20 19:30,2D,",
      "Mai,CGV Vincom,Phòng 9,2026-11-20 19:30,2D,",
      "Mai,CGV Vincom,Phòng 2,2026-11-20 19:30,2D,",
      "Mai,CGV Vincom,Phòng 1,2026-13-45 19:30,2D,",
      "Mai,CGV Vincom,Phòng 1,2026-11-20 19:30,IMAX,",
      "Mai,CGV Vincom,Phòng 1,2026-11-20 19:30,2D,abc",
      "Mai,CGV Vincom",
    ].join("\n");
    const { errors } = resolveCsvRows(text, lookups);
    expect(errors.map((e) => [e.line, e.code])).toEqual([
      [2, "movie_not_found"], [3, "branch_not_found"], [4, "auditorium_not_found"], [5, "no_layout"],
      [6, "invalid_start"], [7, "format_not_found"], [8, "invalid_price"], [9, "columns"],
    ]);
    expect(errors[0].value).toBe("Nope");
  });

  it("works without a header row", () => {
    const { rows, errors } = resolveCsvRows("Mai,CGV Vincom,Phòng 1,2026-11-20 19:30,2D", lookups);
    expect(errors).toEqual([]);
    expect(rows[0].line).toBe(1);
  });
});

describe("time helpers", () => {
  it("reads Vietnam wall-clock time and rejects impossible dates", () => {
    expect(vietnamInstant("2026-11-20", "00:30")?.toISOString()).toBe("2026-11-19T17:30:00.000Z");
    expect(vietnamInstant("2026-02-30", "10:00")).toBeNull();
    expect(vietnamInstant("2026-11-20", "24:00")).toBeNull();
  });
  it("adds the movie and the ads to the end time", () => {
    expect(showtimeEnd(new Date("2026-11-20T12:00:00Z"), 120, 15).toISOString()).toBe("2026-11-20T14:15:00.000Z");
  });
  it("overlap: back to back is fine", () => {
    const a = { start: new Date("2026-01-01T10:00Z"), end: new Date("2026-01-01T12:00Z") };
    expect(overlaps(a, { start: new Date("2026-01-01T12:00Z"), end: new Date("2026-01-01T14:00Z") })).toBe(false);
    expect(overlaps(a, { start: new Date("2026-01-01T11:59Z"), end: new Date("2026-01-01T14:00Z") })).toBe(true);
  });
  it("time slots", () => {
    expect([timeSlotOf("09:00"), timeSlotOf("12:00"), timeSlotOf("19:30"), timeSlotOf("23:10")]).toEqual(["morning", "afternoon", "evening", "late"]);
  });
});
