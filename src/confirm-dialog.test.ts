import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("confirmation popups", () => {
  it("every one goes through ConfirmDialog (no hand-built AlertDialog outside it and components/ui)", () => {
    const offenders = sourceFiles("src")
      .filter((file) => !file.includes(join("components", "ui")) && !file.endsWith("confirm-dialog.tsx") && !file.endsWith("confirm-dialog.test.ts"))
      .filter((file) => readFileSync(file, "utf8").includes("<AlertDialog"));
    expect(offenders).toEqual([]);
  });
});
