import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

// One row per phone lookup, only to count them: the rate limit is "N lookups per hour per person". Rows expire by themselves.
const friendLookupSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  at: { type: Date, required: true, default: () => new Date(), expires: 60 * 60 },
});

export type FriendLookupDoc = InferSchemaType<typeof friendLookupSchema>;

export const FriendLookup: Model<FriendLookupDoc> =
  defineModel<FriendLookupDoc>("FriendLookup", friendLookupSchema);
