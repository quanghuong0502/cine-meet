import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/** Failed-login counter per identifier (username or email). Documents delete themselves via the TTL index. */
const loginAttemptSchema = new Schema({
  key: { type: String, required: true, unique: true },
  failCount: { type: Number, default: 0 },
  lockLevel: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export type LoginAttemptDoc = InferSchemaType<typeof loginAttemptSchema>;

export const LoginAttempt: Model<LoginAttemptDoc> =
  (models.LoginAttempt as Model<LoginAttemptDoc> | undefined) ??
  model<LoginAttemptDoc>("LoginAttempt", loginAttemptSchema);
