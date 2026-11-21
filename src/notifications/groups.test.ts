import { describe, expect, it } from "vitest";
import { NOTIFICATION_GROUPS, NOTIFICATION_TYPES } from "@/notifications/types";

describe("notification groups", () => {
  it("put every kind in exactly one group", () => {
    const listed = NOTIFICATION_GROUPS.flatMap((g) => [...g.types]);
    expect([...listed].sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });
});
