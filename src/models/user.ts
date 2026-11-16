import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { LOCALES } from "@/i18n/config";
import {
  AUTH_PROVIDERS,
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
  },
  { timestamps: true },
);

userSchema.pre("validate", function requireUsernameOrEmail() {
  if (!this.username && !this.email) {
    this.invalidate("username", "Cần ít nhất một trong hai: tên đăng nhập hoặc email.");
  }
});

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc> | undefined) ??
  model<UserDoc>("User", userSchema);
