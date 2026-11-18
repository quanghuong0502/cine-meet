import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/** Keeps the design tokens honest (docs: .claude/rules/design-tokens.md). Components in `ui/` come from shadcn and are exempt. */
const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (path.endsWith(".tsx")) found.push(path);
  }
  return found;
}

const appFiles = sourceFiles(SRC).filter((path) => !path.split(sep).join("/").includes("/components/ui/"));
const read = (path: string) => readFileSync(path, "utf8");

function offenders(pattern: RegExp): string[] {
  return appFiles.flatMap((path) =>
    read(path)
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => pattern.test(line))
      .map(({ number }) => `${relative(SRC, path)}:${number}`),
  );
}

describe("design tokens", () => {
  it("defines every type and size token in globals.css", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const required = [
      "--text-xs", "--text-footnote", "--text-sm", "--text-base", "--text-xl", "--text-2xl", "--text-3xl",
      "--spacing-target", "--spacing-control", "--spacing-control-lg", "--spacing-area", "--spacing-row", "--spacing-nav", "--spacing-field",
    ];
    expect(required.filter((token) => !css.includes(`${token}:`))).toEqual([]);
  });

  it("keeps the body text at 16px and nothing readable under 12px", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const size = (name: string) => Number(new RegExp(`${name}:\\s*([0-9.]+)rem`).exec(css)?.[1]) * 16;
    expect(size("--text-base")).toBe(16);
    expect(size("--text-xs")).toBeGreaterThanOrEqual(12);
    expect(size("--text-footnote")).toBeGreaterThanOrEqual(13);
    expect(size("--text-sm")).toBeGreaterThanOrEqual(15);
  });

  it("keeps touch targets at 44px or more", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const size = (name: string) => Number(new RegExp(`${name}:\\s*([0-9.]+)rem`).exec(css)?.[1]) * 16;
    expect(size("--spacing-target")).toBeGreaterThanOrEqual(44);
    expect(size("--spacing-control")).toBeGreaterThanOrEqual(48);
  });

  it("uses no arbitrary font size", () => {
    expect(offenders(/\btext-\[/)).toEqual([]);
  });

  it("uses only font sizes that are in the scale", () => {
    expect(offenders(/\btext-(2xs|lg|4xl|5xl|6xl|7xl|8xl|9xl)\b/)).toEqual([]);
  });

  // Type roles (docs: .claude/rules/design-tokens.md, "Cỡ chữ theo vai trò"): text takes a role, never a loose size.
  const ROLES = ["display", "title", "heading", "item-title", "body", "secondary", "label", "caption", "micro", "tag"];

  it("defines every type role in globals.css", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    expect(ROLES.filter((role) => !css.includes(`@utility type-${role} {`))).toEqual([]);
  });

  it("sets text size only through a type role, outside the shadcn components", () => {
    expect(offenders(/(^|[\s"'`:])text-(3xl|2xl|xl|base|sm|footnote|xs)(?![\w-])/)).toEqual([]);
  });

  it("only uses type roles that exist", () => {
    const used = appFiles.flatMap((path) => [...read(path).matchAll(/(?<![\w-])type-([a-z]+(?:-[a-z]+)*)/g)].map((match) => `${relative(SRC, path)}: type-${match[1]}`));
    expect(used.filter((entry) => !ROLES.includes(entry.split("type-")[1] ?? ""))).toEqual([]);
  });

  it("gives every heading and every title component a type role", () => {
    const pattern = /<(h[1-4]|CardTitle|DrawerTitle|SheetTitle|DialogTitle|AlertDialogTitle)\b[^>]*>/g;
    const bad = appFiles.flatMap((path) =>
      [...read(path).matchAll(pattern)].filter((match) => !/type-|sr-only/.test(match[0])).map((match) => `${relative(SRC, path)}: ${match[0].slice(0, 60)}`),
    );
    expect(bad).toEqual([]);
  });

  it("uses size tokens, not loose numbers, for things you touch", () => {
    expect(offenders(/\b(?:h-11|h-12|size-11|min-h-11|min-h-14|min-h-16)\b/)).toEqual([]);
  });
});
