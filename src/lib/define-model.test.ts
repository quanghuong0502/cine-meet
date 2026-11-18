import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose, { Schema } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineModel } from "./define-model";

afterEach(() => {
  vi.unstubAllEnvs();
  if (mongoose.models.DefineModelProbe) mongoose.deleteModel("DefineModelProbe");
});

describe("defineModel", () => {
  it("uses the new schema when a file is evaluated again outside production (the stale-model bug)", () => {
    defineModel("DefineModelProbe", new Schema({ name: String }));
    const reloaded = defineModel("DefineModelProbe", new Schema({ name: String, addedLater: Number }));
    // Before this helper the second call returned the first model, so `addedLater` was dropped silently on save.
    expect(reloaded.schema.path("addedLater")).toBeDefined();
    expect(mongoose.models.DefineModelProbe).toBe(reloaded);
  });

  it("keeps the first model in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const first = defineModel("DefineModelProbe", new Schema({ name: String }));
    const second = defineModel("DefineModelProbe", new Schema({ name: String, other: Number }));
    expect(second).toBe(first);
    expect(second.schema.path("other")).toBeUndefined();
  });
});

describe("every model goes through defineModel", () => {
  const dir = join(process.cwd(), "src/models");
  const files = readdirSync(dir).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));

  it("no model file registers itself with `models.X ?? model(...)`", () => {
    const offenders = files.filter((name) => {
      const text = readFileSync(join(dir, name), "utf8");
      return /models\.\w+\s+as\s+Model/.test(text) || /\?\?\s*model</.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it("every file that defines a Schema registers it with defineModel", () => {
    const missing = files.filter((name) => {
      const text = readFileSync(join(dir, name), "utf8");
      return /new Schema[<(]/.test(text) && !text.includes("defineModel<");
    });
    expect(missing).toEqual([]);
  });
});
