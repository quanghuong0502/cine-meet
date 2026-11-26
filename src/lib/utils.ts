import { createCn } from "cn/config";

/**
 * Custom spacing, container, shadow, text and type-role tokens from `src/app/globals.css`.
 * Registering them with `cn` ensures overrides like `cn("min-w-target", "min-w-fit")`,
 * `cn("px-inset", "px-inset-sm")`, `cn("h-control", "h-target")` or `cn("type-label", "type-item-title")`
 * cleanly drop the earlier token instead of emitting both classes and letting stylesheet order win.
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

export const cn = createCn<"type-role">({
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
});
