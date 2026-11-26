import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";

export const AUDIT_ACTIONS = ["create", "update", "delete"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Who changed which master-data record, and what it looked like before and after. */
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export const AuditLog: Model<AuditLogDoc> =
  defineModel<AuditLogDoc>("AuditLog", auditLogSchema);
