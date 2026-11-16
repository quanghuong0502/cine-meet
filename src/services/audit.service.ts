import { connectToDatabase } from "@/lib/db";
import { AuditLog, type AuditAction } from "@/models/audit-log";

interface AuditInput {
  actorId: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/** Makes a Mongoose document safe to store in a Mixed field (plain JSON, no ObjectId or Date objects). */
function toPlain(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export async function recordAudit(input: AuditInput): Promise<void> {
  await connectToDatabase();
  await AuditLog.create({
    actorId: input.actorId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: toPlain(input.before),
    after: toPlain(input.after),
  });
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  actorId: string;
  createdAt: Date;
}

/** Latest changes first, optionally for one entity type. */
export async function listAudit(options: { entity?: string; limit?: number } = {}): Promise<AuditEntry[]> {
  await connectToDatabase();
  const docs = await AuditLog.find(options.entity ? { entity: options.entity } : {})
    .sort({ createdAt: -1 })
    .limit(options.limit ?? 50)
    .lean();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    action: doc.action,
    entity: doc.entity,
    entityId: doc.entityId.toString(),
    actorId: doc.actorId.toString(),
    createdAt: doc.createdAt,
  }));
}
