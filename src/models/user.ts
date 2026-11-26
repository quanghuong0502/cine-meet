import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";
import { LOCALES } from "@/i18n/config";
import {
  AUTH_PROVIDERS,
  SEAT_PREFERENCES,
  USER_ROLES,
  USER_STATUSES,
} from "@/lib/user-constants";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // At least one of `username` / `email` must exist (checked below). Both are optional, so the
    // unique indexes are sparse: many users may have no username without clashing.
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    // Stored as 84xxxxxxxxx (see src/lib/phone.ts); optional and unique when present.
    phone: { type: String, trim: true },
    avatar: { type: String },
    role: { type: String, enum: USER_ROLES, default: "user", required: true },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "active",
      required: true,
    },
    authProviders: { type: [String], enum: AUTH_PROVIDERS, default: [] },
    // Never returned by default; select it explicitly with `.select("+passwordHash")`.
    passwordHash: { type: String, select: false },
    // Set when an admin creates the account or resets the password with a temporary one.
    mustChangePassword: { type: Boolean, default: false },
    // Interface language chosen in Settings; also used for notifications sent to this user.
    // Left unset until the user chooses, so the browser language still applies on first sign-in.
    locale: { type: String, enum: LOCALES },
    seatPreference: { type: String, enum: SEAT_PREFERENCES },
    // Kinds of notification this person does not want pushed to their devices (in-app messages are always kept). Names are NotificationType.
    pushOff: { type: [String], default: [] },
    // Random code in this person's friend-invite link; made the first time they open "Friends". Unique when present.
    inviteCode: { type: String, unique: true, sparse: true },
    // This person's own monthly budget (design 3.1), whole dong. Unset means no budget is tracked for them.
    monthlyBudget: {
      type: new Schema({ ticket: { type: Number, min: 0 }, fnb: { type: Number, min: 0 } }, { _id: false }),
    },
  },
  { timestamps: true },
);

// Many users have no phone: the index skips them, so only real numbers must be unique.
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1, status: 1, name: 1 });

userSchema.pre("validate", function requireUsernameOrEmail() {
  if (!this.username && !this.email) {
    this.invalidate("username", "Cần ít nhất một trong hai: tên đăng nhập hoặc email.");
  }
});

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  defineModel<UserDoc>("User", userSchema);
