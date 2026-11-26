import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { normalizeVietnamPhone } from "@/lib/phone";
import { SEAT_PREFERENCES, type SeatPreference } from "@/lib/user-constants";
import { optionalText, requiredText } from "@/lib/validation/fields";
import { User } from "@/models/user";

export interface Profile {
  name: string;
  email?: string;
  username?: string;
  /** Stored form, 84xxxxxxxxx. */
  phone?: string;
  avatar?: string;
  seatPreference?: SeatPreference;
}

/** "any" (or nothing) in the seat select means no preference. */
const seatPreference = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value === "any" ? undefined : value))
  .pipe(z.enum(SEAT_PREFERENCES, { error: "invalid" }).optional());

export const profileInputSchema = z.object({
  name: requiredText(80),
  // Any way of writing a mobile number; saved as 84xxxxxxxxx.
  phone: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      const normalized = normalizeVietnamPhone(value);
      if (!normalized) ctx.addIssue({ code: "custom", message: "invalid" });
      return normalized ?? undefined;
    }),
  seatPreference,
  avatar: optionalText(300),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export async function getProfile(userId: string): Promise<Profile | null> {
  await connectToDatabase();
  const user = await User.findById(userId, "name email username phone avatar seatPreference").lean().catch(() => null);
  if (!user) return null;
  return {
    name: user.name,
    email: user.email ?? undefined,
    username: user.username ?? undefined,
    phone: user.phone ?? undefined,
    avatar: user.avatar ?? undefined,
    seatPreference: user.seatPreference ?? undefined,
  };
}

export type UpdateProfileResult = { ok: true } | { ok: false; error: "not_found" | "phone_taken" };

/** A field the form left empty is removed from the account (phone, avatar, seat preference). */
export async function updateProfile(userId: string, input: ProfileInput): Promise<UpdateProfileResult> {
  await connectToDatabase();
  const $set: Record<string, unknown> = { name: input.name };
  const $unset: Record<string, 1> = {};
  for (const field of ["phone", "avatar", "seatPreference"] as const) {
    if (input[field] === undefined) $unset[field] = 1;
    else $set[field] = input[field];
  }

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
      { returnDocument: "after", runValidators: true },
    ).lean();
    return updated ? { ok: true } : { ok: false, error: "not_found" };
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: number }).code === 11000) {
      return { ok: false, error: "phone_taken" };
    }
    throw error;
  }
}
