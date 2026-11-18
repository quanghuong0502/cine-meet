import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { PX } from "@/lib/ui-sizes";

/** Keeps the design tokens honest (docs: .claude/rules/design-tokens.md). Applies to every component, the shadcn ones in `ui/` too. */
const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (path.endsWith(".tsx")) found.push(path);
  }
  return found;
}

// Every component, shadcn ones in `components/ui` included: nothing is exempt from the tokens.
const appFiles = sourceFiles(SRC);
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
      "--spacing-section", "--spacing-group", "--spacing-item", "--spacing-stack", "--spacing-tight", "--spacing-hair",
      "--spacing-inset-xs", "--spacing-inset-sm", "--spacing-inset", "--spacing-inset-lg", "--spacing-inset-xl",
      "--spacing-icon-xs", "--spacing-icon-sm", "--spacing-icon", "--spacing-icon-lg",
      "--container-app", "--container-page", "--container-form", "--container-menu", "--container-media", "--container-hint",
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
  const ROLES = ["display", "title", "heading", "item-title", "body", "secondary", "label", "caption", "micro", "action", "tag", "badge"];

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
  // Space and size roles (docs: .claude/rules/design-tokens.md, "Khoảng cách và kích thước theo vai trò"): no loose numbers.
  const VARIANTS = String.raw`(?:[^\s"'\x60]+:)*`;
  const SPACING = ["gap", "gap-x", "gap-y", "space-x", "space-y", "p", "px", "py", "pt", "pr", "pb", "pl", "m", "mx", "my", "mt", "mr", "mb", "ml", "inset", "inset-x", "inset-y", "top", "right", "bottom", "left", "translate-x", "translate-y"];
  const SIZING = ["size", "h", "w", "min-h", "min-w", "max-h", "max-w"];
  // `-0`, `0`, fractions (`w-1/2`) and named roles are fine; a plain number (`gap-3`, `px-4`, `size-5`, `w-16`) is not.
  const looseNumber = (utilities: string[]) =>
    new RegExp(String.raw`(?<![\w-])${VARIANTS}-?(?:${utilities.join("|")})-(?!0(?:[\s"'\x60!]|$))\d+(?:\.\d+)?(?![\w./])`);

  it("sets gap, margin and padding only through a spacing role", () => {
    expect(offenders(looseNumber(SPACING))).toEqual([]);
  });

  it("sets size and width only through a size role", () => {
    expect(offenders(looseNumber(SIZING))).toEqual([]);
  });

  it("names the width of a column instead of using max-w-sm, max-w-3xl...", () => {
    expect(offenders(/(?<![\w-])max-w-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)(?![\w-])/)).toEqual([]);
  });

  it("writes no bare px or rem inside an arbitrary value (use a token, or var(--token) inside calc)", () => {
    // Any utility: `p-[13px]`, `grid-cols-[16rem_1fr]`, `shadow-[0_8px_...]`, `rounded-[10px]`. `0px`, `dvh` and `%` are fine.
    const arbitrary = /(?<![\w-])(?:[^\s"'\x60]+:)*-?[a-z][a-z-]*-\[([^\]]+)\]/g;
    const bare = (value: string) => /(?<![A-Za-z0-9.-])(?!0(?:px|rem)(?![a-z]))\d*\.?\d+(?:px|rem)(?![a-z])/.test(value.replace(/var\([^)]*\)|env\([^)]*\)/g, ""));
    const bad = appFiles.flatMap((path) =>
      read(path)
        .split("\n")
        .flatMap((line, index) => [...line.matchAll(arbitrary)].filter((match) => bare(match[1] ?? "")).map(() => `${relative(SRC, path)}:${index + 1}`)),
    );
    expect(bad).toEqual([]);
  });

  it("never gives a spacing token and a container token the same name", () => {
    // `max-w-<name>` looks in both groups: a clash silently picks the wrong one (max-w-menu once became 68px wide).
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const names = (prefix: string) => new Set([...css.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+):`, "g"))].map((match) => match[1] as string));
    const containers = names("container");
    expect([...names("spacing")].filter((name) => containers.has(name))).toEqual([]);
  });
  it("passes sizes to components by name (PX in lib/ui-sizes.ts), never as a number", () => {
    // size={44}, width={80}, size={a ? 44 : 48}, sizes="128px". The one exception is the seat map: its numbers are drawing coordinates
    // inside the SVG's own unit (1 = one seat), not pixels on the screen.
    const literal = /\b(?:size|width|height|iconSize)=\{\s*-?\d+(?:\.\d+)?\s*\}|\b(?:size|width|height)=\{[^}\n]*\?\s*\d+\s*:\s*\d+/;
    const hint = /\bsizes=[^\n]*?\d+(?:\.\d+)?px/;
    const files = appFiles.filter((path) => !path.split(sep).join("/").endsWith("/components/seat-map/seat-map.tsx"));
    const bad = files.flatMap((path) =>
      read(path)
        .split("\n")
        .flatMap((line, index) => (literal.test(line) || hint.test(line) ? [`${relative(SRC, path)}:${index + 1}`] : [])),
    );
    expect(bad).toEqual([]);
  });

  it("keeps the PX constants equal to their twins in globals.css", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const px = (name: string) => Number(new RegExp(`${name}:\\s*([0-9.]+)rem`).exec(css)?.[1]) * 16;
    expect({ avatar: PX.avatar, thumb: PX.thumb, swatch: PX.swatch, poster: PX.poster, column: PX.column }).toEqual({
      avatar: px("--spacing-avatar"),
      thumb: px("--spacing-thumb"),
      swatch: px("--spacing-swatch"),
      poster: px("--spacing-poster"),
      column: px("--container-app"),
    });
  });
});
