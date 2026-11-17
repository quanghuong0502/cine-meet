import { z } from "zod";

/**
 * Result shapes shared by admin server actions and their forms. Errors are CODES, never sentences:
 * the interface translates them (`admin.common.errors.*`, `admin.validation.*`).
 */
export type SaveError =
  | "validation"
  | "duplicate"
  | "in_use"
  | "item_invalid"
  | "discount_too_high"
  | "not_found"
  | "last_admin"
  | "self"
  | "no_password"
  | "invalid_config"
  | "branch_not_found"
  | "seat_type_not_found"
  | "unknown";

export type SaveState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      error: SaveError;
      fieldErrors?: Record<string, string>;
      /**
       * What the user typed. React clears an uncontrolled form after every action, so the form puts these
       * back as the starting values; without this a validation error would wipe the whole form.
       */
      values?: Record<string, string>;
    };

export type RemoveResult = { ok: true } | { ok: false; error: SaveError };

export const IDLE_STATE: SaveState = { status: "idle" };

/** Codes the forms know how to translate. */
export const VALIDATION_CODES = [
  "required",
  "too_long",
  "invalid_url",
  "invalid_color",
  "no_items",
  "too_gray",
  "too_dark",
  "invalid_number",
  "out_of_range",
  "invalid_date",
  "too_short",
  "taken",
  "invalid",
] as const;
export type ValidationCode = (typeof VALIDATION_CODES)[number];

function toCode(message: string): ValidationCode {
  return VALIDATION_CODES.find((code) => code === message) ?? "invalid";
}

/** Form values as strings; an empty or blank field becomes `undefined`. */
export function formToObject(formData: FormData): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    values[key] = trimmed === "" ? undefined : trimmed;
  }
  return values;
}

/** The error state for a failed save, echoing what was typed so the form keeps it. */
export function errorState(
  formData: FormData,
  error: SaveError,
  fieldErrors?: Record<string, string>,
): SaveState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "id") values[key] = value;
  }
  return { status: "error", error, fieldErrors, values };
}

export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { ok: true; data: z.infer<S> } | { ok: false; fieldErrors: Record<string, string> } {
  const parsed = schema.safeParse(formToObject(formData));
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "form");
    // A missing required value surfaces as a type error; treat it as "required".
    const code = issue.code === "invalid_type" && issue.message.startsWith("Invalid input")
      ? "required"
      : toCode(issue.message);
    fieldErrors[field] ??= code;
  }
  return { ok: false, fieldErrors };
}
