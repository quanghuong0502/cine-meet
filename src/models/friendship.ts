import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

export const FRIENDSHIP_STATUSES = ["pending", "accepted"] as const;

const friendshipSchema = new Schema(
  {
    // The person who sent the request; `userB` has to accept it.
    userA: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userB: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: FRIENDSHIP_STATUSES, default: "pending", required: true },
    // The two ids sorted and joined, so one pair of people can only ever have one row, whoever asked first.
    pairKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export type FriendshipDoc = InferSchemaType<typeof friendshipSchema>;

export const Friendship: Model<FriendshipDoc> =
  defineModel<FriendshipDoc>("Friendship", friendshipSchema);
