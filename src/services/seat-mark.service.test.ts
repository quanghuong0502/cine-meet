import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";
import { matchMarks } from "@/lib/seat-layout/marks";

describe("matchMarks (pure)", () => {
  const seat = (code: string, rowIndex: number, colIndex: number, span = 1) => ({ code, rowIndex, colIndex, span });
  const v1 = [seat("A1", 0, 0), seat("A2", 0, 1), seat("B1", 1, 0)];
  const v2 = [seat("A1", 0, 0), seat("A2", 0, 2), seat("C1", 2, 0)];
  const layouts = new Map([["v1", v1], ["v2", v2]]);

  it("keeps marks whose seat did not move, moves the rest to old", () => {
    const marks = [
      { seatCode: "A1", layoutId: "v1" }, // same place in v2
      { seatCode: "A2", layoutId: "v1" }, // moved a column
      { seatCode: "B1", layoutId: "v1" }, // gone in v2
      { seatCode: "C1", layoutId: "v2" }, // made on the viewed version
    ];
    const { active, old } = matchMarks(marks, "v2", v2, layouts);
    expect(active.map((m) => m.seatCode)).toEqual(["A1", "C1"]);
    expect(old.map((m) => m.seatCode)).toEqual(["A2", "B1"]);
  });
  it("a widened seat is not the same seat", () => {
    const wide = [seat("A1", 0, 0, 2)];
    const { old } = matchMarks([{ seatCode: "A1", layoutId: "v1" }], "v3", wide, new Map([["v1", v1], ["v3", wide]]));
    expect(old).toHaveLength(1);
  });
});

describe("seat mark service", () => {
  let svc: typeof import("./seat-mark.service");
  let Layout: typeof import("@/models/auditorium-layout").AuditoriumLayout;
  let Mark: typeof import("@/models/seat-mark").SeatMark;
  const user = new Types.ObjectId().toString();
  const other = new Types.ObjectId().toString();
  const room = new Types.ObjectId().toString();
  let l1: string;
  let l2: string;

  const seats = (items: [string, number, number][]) =>
    items.map(([code, rowIndex, colIndex]) => ({ code, row: code[0], col: colIndex + 1, rowIndex, colIndex, type: "t", span: 1 as const, x: colIndex, y: rowIndex, score: 50, flags: [] }));

  beforeAll(async () => {
    await startTestDatabase();
    svc = await import("./seat-mark.service");
    ({ AuditoriumLayout: Layout } = await import("@/models/auditorium-layout"));
    ({ SeatMark: Mark } = await import("@/models/seat-mark"));
    const { connectToDatabase } = await import("@/lib/db");
    await connectToDatabase();
    await Mark.init();
  }, 120_000);
  afterAll(stopTestDatabase);
  beforeEach(async () => {
    await Promise.all([Layout.deleteMany({}), Mark.deleteMany({})]);
    const config = {};
    l1 = (await Layout.create({ auditoriumId: room, version: 1, config, seats: seats([["A1", 0, 0], ["A2", 0, 1], ["B1", 1, 0]]) }))._id.toString();
    l2 = (await Layout.create({ auditoriumId: room, version: 2, config, seats: seats([["A1", 0, 0], ["A2", 0, 2]]) }))._id.toString();
  });

  it("saves, replaces and removes a mark; a seat has one mark per person", async () => {
    const base = { auditoriumId: room, layoutId: l1, seatCode: "A1", tags: [] as never[] };
    expect((await svc.saveSeatMark(user, { ...base, kind: "favorite", note: "đẹp" })).ok).toBe(true);
    expect((await svc.saveSeatMark(user, { ...base, kind: "avoid", tags: ["loose"], note: undefined })).ok).toBe(true);
    const { active } = await svc.getSeatMarks(user, room, l1);
    expect(active).toEqual([{ seatCode: "A1", kind: "avoid", tags: ["loose"], note: "" }]);
    expect((await svc.getSeatMarks(other, room, l1)).active).toEqual([]);
    expect((await svc.removeSeatMark(user, room, "A1")).ok).toBe(true);
    expect((await svc.removeSeatMark(user, room, "A1")).ok).toBe(false);
  });

  it("rejects a seat that is not in that layout, or a layout of another room", async () => {
    const base = { auditoriumId: room, tags: [] as never[], kind: "favorite" as const };
    expect(await svc.saveSeatMark(user, { ...base, layoutId: l2, seatCode: "B1" })).toEqual({ ok: false, error: "invalid" });
    expect(await svc.saveSeatMark(user, { ...base, layoutId: l1, seatCode: "A1", auditoriumId: new Types.ObjectId().toString() })).toEqual({ ok: false, error: "not_found" });
  });

  it("after a new layout version, unmoved seats keep the mark and moved or removed ones become old", async () => {
    const base = { auditoriumId: room, layoutId: l1, tags: [] as never[], kind: "favorite" as const };
    for (const seatCode of ["A1", "A2", "B1"]) await svc.saveSeatMark(user, { ...base, seatCode });
    const v1 = await svc.getSeatMarks(user, room, l1);
    expect(v1.active.map((m) => m.seatCode)).toEqual(["A1", "A2", "B1"]);
    const v2 = await svc.getSeatMarks(user, room, l2);
    expect(v2.active.map((m) => m.seatCode)).toEqual(["A1"]);
    expect(v2.old.map((m) => m.seatCode)).toEqual(["A2", "B1"]);
  });
});
