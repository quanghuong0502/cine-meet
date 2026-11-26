import { createCn } from "cn/engine";
import tables from "./cn-tables.mjs";

export { CUSTOM_CONTAINER_TOKENS, CUSTOM_SPACING_TOKENS, CUSTOM_TYPE_ROLES } from "./cn-tokens";

/**
 * Tailwind + custom SeatMate design-token class merger backed by precompiled tables (`src/lib/cn-tables.mjs`).
 * Avoids bundling `cn/config`'s runtime compiler (~130 KB raw) into client chunks while preserving exact
 * conflict resolution for every custom spacing, container, shadow, text and type-role token.
 */
export const cn = createCn(tables);
