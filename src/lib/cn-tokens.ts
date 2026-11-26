/**
 * Custom spacing, container, shadow, text and type-role tokens from `src/app/globals.css`.
 * Shared between `scripts/generate-cn-tables.ts` (build-time table compiler), `src/lib/utils.ts`,
 * and `src/lib/utils.test.ts` so every custom token resolves Tailwind conflicts accurately without
 * shipping `cn/config`'s runtime compiler (~130 KB raw) to client bundles.
 */
export const CUSTOM_SPACING_TOKENS = [
  "target",
  "control",
  "area",
  "control-lg",
  "row",
  "avatar",
  "nav",
  "field",
  "nav-gap",
  "section",
  "group",
  "item",
  "stack",
  "tight",
  "hair",
  "inset-xs",
  "inset-sm",
  "inset",
  "inset-lg",
  "inset-xl",
  "icon-xs",
  "icon-sm",
  "icon",
  "icon-lg",
  "time-field",
  "stepper",
  "thumb-poster",
  "thumb-poster-lg",
  "thumb",
  "swatch",
  "track",
  "area-lg",
  "area-max",
  "poster",
  "mascot-max",
  "sheet-gap",
  "grabber",
  "menu-min",
  "area-cap",
  "switch",
  "switch-thumb",
  "chart",
  "sidebar",
  "action-clear",
  "save-clear",
] as const;

export const CUSTOM_CONTAINER_TOKENS = ["app", "page", "form", "menu", "media", "hint"] as const;

export const CUSTOM_TYPE_ROLES = [
  "display",
  "title",
  "heading",
  "item-title",
  "body",
  "secondary",
  "label",
  "caption",
  "micro",
  "action",
  "tag",
  "badge",
] as const;

export const CN_CONFIG_EXTENSION = {
  extend: {
    theme: {
      spacing: [...CUSTOM_SPACING_TOKENS],
      container: [...CUSTOM_CONTAINER_TOKENS],
      shadow: ["menu"],
      text: ["footnote"],
    },
    classGroups: {
      "type-role": [{ type: [...CUSTOM_TYPE_ROLES] }],
    },
  },
};
