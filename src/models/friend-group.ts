import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

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
  (models.FriendGroup as Model<FriendGroupDoc> | undefined) ?? model<FriendGroupDoc>("FriendGroup", friendGroupSchema);
