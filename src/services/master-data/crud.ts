import { isValidObjectId, type Model } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { recordAudit } from "@/services/audit.service";

export type ServiceError = "not_found" | "duplicate" | "in_use";
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

/** Anything that can say how many documents point at a record (a Mongoose model does). */
interface Countable {
  countDocuments(filter: Record<string, unknown>): PromiseLike<number>;
}

interface MasterDataConfig<T extends object> {
  /** Stable name stored in the audit log, e.g. "brand". */
  entity: string;
  model: Model<T>;
  /** Fields matched (case-insensitively) by the search box. */
  searchFields: string[];
  sort: Record<string, 1 | -1>;
  /** Every field an admin can edit: when the form leaves one empty it is removed from the record. */
  editableFields: string[];
  /** Records that reference this one by id; a record still referenced cannot be deleted. Evaluated lazily. */
  dependents?: () => Array<{ model: Countable; field: string }>;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

export type WithId<T> = T & { _id: { toString(): string } };

/**
 * One service for every master-data type: list, create, update, remove, each change written to the audit log.
 * Business rules stay here (not in routes): duplicate names, "still in use" protection, audit trail.
 */
export function createMasterDataService<T extends object>(config: MasterDataConfig<T>) {
  const { entity, model } = config;

  async function list(options: { q?: string; limit?: number } = {}): Promise<WithId<T>[]> {
    await connectToDatabase();
    const filter: Record<string, unknown> = {};
    const q = options.q?.trim();
    if (q) {
      const pattern = new RegExp(escapeRegExp(q), "i");
      filter.$or = config.searchFields.map((field) => ({ [field]: pattern }));
    }
    return (await model
      .find(filter)
      .sort(config.sort)
      .limit(options.limit ?? 200)
      .lean()) as unknown as WithId<T>[];
  }

  async function getById(id: string): Promise<WithId<T> | null> {
    if (!isValidObjectId(id)) return null;
    await connectToDatabase();
    return (await model.findById(id).lean()) as unknown as WithId<T> | null;
  }

  async function create(input: Record<string, unknown>, actorId: string): Promise<ServiceResult<WithId<T>>> {
    await connectToDatabase();
    try {
      const created = await model.create(input as never);
      const plain = created.toObject() as unknown as WithId<T>;
      await recordAudit({ actorId, action: "create", entity, entityId: plain._id.toString(), after: plain });
      return { ok: true, data: plain };
    } catch (error) {
      if (isDuplicateKeyError(error)) return { ok: false, error: "duplicate" };
      throw error;
    }
  }

  async function update(id: string, input: Record<string, unknown>, actorId: string): Promise<ServiceResult<WithId<T>>> {
    const before = await getById(id);
    if (!before) return { ok: false, error: "not_found" };

    const values = input;
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};
    for (const field of config.editableFields) {
      if (values[field] === undefined) $unset[field] = 1;
      else $set[field] = values[field];
    }

    try {
      const after = (await model
        .findByIdAndUpdate(
          id,
          { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) },
          { returnDocument: "after", runValidators: true },
        )
        .lean()) as unknown as WithId<T> | null;
      if (!after) return { ok: false, error: "not_found" };
      await recordAudit({ actorId, action: "update", entity, entityId: id, before, after });
      return { ok: true, data: after };
    } catch (error) {
      if (isDuplicateKeyError(error)) return { ok: false, error: "duplicate" };
      throw error;
    }
  }

  async function remove(id: string, actorId: string): Promise<ServiceResult<null>> {
    const before = await getById(id);
    if (!before) return { ok: false, error: "not_found" };

    for (const { model: dependent, field } of config.dependents?.() ?? []) {
      if ((await dependent.countDocuments({ [field]: id })) > 0) return { ok: false, error: "in_use" };
    }

    await model.deleteOne({ _id: id });
    await recordAudit({ actorId, action: "delete", entity, entityId: id, before });
    return { ok: true, data: null };
  }

  return { list, getById, create, update, remove };
}
