import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cn, CUSTOM_CONTAINER_TOKENS, CUSTOM_SPACING_TOKENS, CUSTOM_TYPE_ROLES } from "./utils";

describe("cn custom design-token merging", () => {
  it("deduplicates custom spacing, sizing, container and type-role tokens", () => {
    expect(cn("min-w-target", "min-w-fit")).toBe("min-w-fit");
    expect(cn("min-w-target", "min-w-0")).toBe("min-w-0");
    expect(cn("px-inset", "px-inset-sm")).toBe("px-inset-sm");
    expect(cn("px-inset-xl", "px-inset")).toBe("px-inset");
    expect(cn("h-control", "h-target")).toBe("h-target");
    expect(cn("size-target", "size-control")).toBe("size-control");
    expect(cn("gap-stack", "gap-tight")).toBe("gap-tight");
    expect(cn("p-inset", "p-inset-sm")).toBe("p-inset-sm");
    expect(cn("max-w-form", "max-w-page")).toBe("max-w-page");
    expect(cn("type-label", "type-item-title")).toBe("type-item-title");
    expect(cn("type-body", "font-medium!")).toBe("type-body font-medium!");
    expect(cn("whitespace-nowrap", "whitespace-normal")).toBe("whitespace-normal");
  });

  it("registers every --spacing-*, --container-* and @utility type-* token defined in globals.css", () => {
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    const spacingInCss = [...css.matchAll(/--spacing-([a-z0-9-]+):/g)].map((m) => m[1] as string);
    const containerInCss = [...css.matchAll(/--container-([a-z0-9-]+):/g)].map((m) => m[1] as string);
    const typeRolesInCss = [...css.matchAll(/@utility type-([a-z-]+)\s*\{/g)].map((m) => m[1] as string);

    expect(spacingInCss.filter((t) => !(CUSTOM_SPACING_TOKENS as readonly string[]).includes(t))).toEqual([]);
    expect(containerInCss.filter((t) => !(CUSTOM_CONTAINER_TOKENS as readonly string[]).includes(t))).toEqual([]);
    expect(typeRolesInCss.filter((t) => !(CUSTOM_TYPE_ROLES as readonly string[]).includes(t))).toEqual([]);
  });
});
