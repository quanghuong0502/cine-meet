import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

const friendGroupSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    memberIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
  },
  { timestamps: true },
);

export type FriendGroupDoc = InferSchemaType<typeof friendGroupSchema>;

export const FriendGroup: Model<FriendGroupDoc> =
  defineModel<FriendGroupDoc>("FriendGroup", friendGroupSchema);
