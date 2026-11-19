import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, stopTestDatabase } from "@/test/mongo";
import type { LayoutConfig } from "@/lib/seat-layout/types";

type Service = typeof import("./auditorium.service");
let svc: Service;
let Branch: typeof import("@/models/branch").Branch;
let SeatType: typeof import("@/models/seat-type").SeatType;
let Auditorium: typeof import("@/models/auditorium").Auditorium;
let AuditoriumLayout: typeof import("@/models/auditorium-layout").AuditoriumLayout;
let defaultLayoutConfig: typeof import("@/lib/seat-layout/config").defaultLayoutConfig;

const ACTOR = new Types.ObjectId().toString();
let branchId: string;
let stdId: string;
let coupleId: string;

beforeAll(async () => {
  await startTestDatabase();
  svc = await import("./auditorium.service");
  ({ Branch } = await import("@/models/branch"));
  ({ SeatType } = await import("@/models/seat-type"));
  ({ Auditorium } = await import("@/models/auditorium"));
  ({ AuditoriumLayout } = await import("@/models/auditorium-layout"));
  ({ defaultLayoutConfig } = await import("@/lib/seat-layout/config"));
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase();
  await Promise.all([Auditorium.init(), AuditoriumLayout.init()]);
}, 120_000);

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await Promise.all([Auditorium.deleteMany({}), AuditoriumLayout.deleteMany({}), Branch.deleteMany({}), SeatType.deleteMany({})]);
  branchId = (await Branch.create({ brandId: new Types.ObjectId(), name: "CGV Vincom" }))._id.toString();
  stdId = (await SeatType.create({ name: "Thường", capacity: 1 }))._id.toString();
  coupleId = (await SeatType.create({ name: "Đôi", capacity: 2 }))._id.toString();
});

function config(patch: Partial<LayoutConfig> = {}): LayoutConfig {
  return { ...defaultLayoutConfig(stdId), rows: 5, cols: 8, ...patch };
}

describe("auditorium service", () => {
  it("creates a room with version 1 as the current layout, scores and summary", async () => {
    const created = await svc.createAuditorium({ branchId, name: "Phòng 1", config: config() }, ACTOR);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const layout = await svc.getLayout(created.data.id);
    expect(layout?.version).toBe(1);
    expect(layout?.seats).toHaveLength(40);
    expect(layout?.seats.every((s) => s.score >= 0 && s.score <= 100)).toBe(true);
    expect(layout?.summary).toContain("5 hàng");
    const list = await svc.listAuditoriums({ branchId });
    expect(list).toMatchObject([{ name: "Phòng 1", version: 1, seatCount: 40 }]);
  });

  it("saving a changed layout creates a new version and keeps the old one readable", async () => {
    const created = await svc.createAuditorium({ branchId, name: "Phòng 1", config: config() }, ACTOR);
    if (!created.ok) throw new Error("setup");
    const v1Id = created.data.layoutId;

    const saved = await svc.updateAuditorium(
      created.data.id,
      { name: "Phòng 1", config: config({ overrides: [{ row: "A", cols: [1], type: "none" }] }) },
      ACTOR,
    );
    expect(saved).toMatchObject({ ok: true, data: { version: 2, createdVersion: true } });

    const room = await svc.getAuditorium(created.data.id);
    expect(room?.currentLayoutId?.toString()).toBe((saved as { data: { layoutId: string } }).data.layoutId);
    expect((await svc.getLayout(created.data.id))?.seats).toHaveLength(39);
    // The old version still exists, unchanged.
    expect((await svc.getLayout(created.data.id, v1Id))?.seats).toHaveLength(40);
    expect((await svc.listLayoutVersions(created.data.id)).map((v) => v.version)).toEqual([2, 1]);
  });

  it("only renames when the config is unchanged", async () => {
    const created = await svc.createAuditorium({ branchId, name: "Phòng 1", config: config() }, ACTOR);
    if (!created.ok) throw new Error("setup");
    const saved = await svc.updateAuditorium(created.data.id, { name: "Phòng IMAX", config: config() }, ACTOR);
    expect(saved).toMatchObject({ ok: true, data: { version: 1, createdVersion: false } });
    expect((await svc.getAuditorium(created.data.id))?.name).toBe("Phòng IMAX");
    expect(await AuditoriumLayout.countDocuments({})).toBe(1);
  });

  it("rejects duplicate names within a branch, bad config, unknown branch and unknown seat type", async () => {
    await svc.createAuditorium({ branchId, name: "Phòng 1", config: config() }, ACTOR);
    expect(await svc.createAuditorium({ branchId, name: "phong 1", config: config() }, ACTOR)).toEqual({ ok: false, error: "duplicate" });
    expect(await svc.createAuditorium({ branchId, name: "X", config: { rows: 0 } }, ACTOR)).toEqual({ ok: false, error: "invalid_config" });
    expect(
      await svc.createAuditorium({ branchId: new Types.ObjectId().toString(), name: "Y", config: config() }, ACTOR),
    ).toEqual({ ok: false, error: "branch_not_found" });
    expect(
      await svc.createAuditorium({ branchId, name: "Z", config: config({ overrides: [{ row: "A", cols: [1], type: new Types.ObjectId().toString() }] }) }, ACTOR),
    ).toEqual({ ok: false, error: "seat_type_not_found" });
    // A failed create leaves nothing behind.
    expect(await Auditorium.countDocuments({})).toBe(1);
  });

  it("couple seats count once", async () => {
    const created = await svc.createAuditorium(
      { branchId, name: "Phòng đôi", config: config({ overrides: [{ row: "E", cols: [1, 2, 3, 4], type: coupleId }] }) },
      ACTOR,
    );
    if (!created.ok) throw new Error("setup");
    expect((await svc.getLayout(created.data.id))?.seats).toHaveLength(38);
  });

  it("removes the room with all versions", async () => {
    const created = await svc.createAuditorium({ branchId, name: "Phòng 1", config: config() }, ACTOR);
    if (!created.ok) throw new Error("setup");
    expect(await svc.removeAuditorium(created.data.id, ACTOR)).toMatchObject({ ok: true });
    expect(await AuditoriumLayout.countDocuments({})).toBe(0);
    expect(await svc.removeAuditorium(created.data.id, ACTOR)).toEqual({ ok: false, error: "not_found" });
  });

  it("does not return a layout of another room", async () => {
    const a = await svc.createAuditorium({ branchId, name: "A", config: config() }, ACTOR);
    const b = await svc.createAuditorium({ branchId, name: "B", config: config() }, ACTOR);
    if (!a.ok || !b.ok) throw new Error("setup");
    expect(await svc.getLayout(a.data.id, b.data.layoutId)).toBeNull();
  });

  it("blocks deleting a seat type that a layout uses", async () => {
    const { seatTypeService } = await import("./master-data/seat-type.service");
    const created = await svc.createAuditorium({ branchId, name: "Phòng 1", config: config() }, ACTOR);
    if (!created.ok) throw new Error("setup");
    expect(await seatTypeService.remove(stdId, ACTOR)).toEqual({ ok: false, error: "in_use" });
    // The couple type is not used by any layout yet.
    expect(await seatTypeService.remove(coupleId, ACTOR)).toMatchObject({ ok: true });
  });
});
