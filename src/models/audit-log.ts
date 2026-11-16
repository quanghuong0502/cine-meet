import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

export const AUDIT_ACTIONS = ["create", "update", "delete"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Who changed which master-data record, and what it looked like before and after. */
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc> | undefined) ??
  model<AuditLogDoc>("AuditLog", auditLogSchema);
