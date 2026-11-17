import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, USER_ROLES, type AuthProviderName, type UserRole, type UserStatus } from "@/lib/user-constants";
import { requiredText } from "@/lib/validation/fields";
import { User } from "@/models/user";
import { recordAudit } from "@/services/audit.service";
import { clearLoginAttempts } from "@/services/user.service";

const HASH_ROUNDS = 12;

export type UserServiceError = "not_found" | "duplicate" | "last_admin" | "self" | "no_password";
export type UserServiceResult<T> = { ok: true; data: T } | { ok: false; error: UserServiceError };

export interface ManagedUser {
  id: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  authProviders: AuthProviderName[];
  mustChangePassword: boolean;
  createdAt: Date;
}

/** The form's temporary password: long enough, no spaces. */
const temporaryPassword = z
  .string({ error: "required" })
  .min(MIN_PASSWORD_LENGTH, { error: "too_short" })
  .max(100, { error: "too_long" })
  .refine((value) => !/\s/.test(value), { error: "invalid" });

export const createUserInputSchema = z
  .object({
    name: requiredText(80),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,30}$/, { error: "invalid" })
      .optional(),
    email: z.email({ error: "invalid" }).max(120, { error: "too_long" }).optional(),
    role: z.enum(USER_ROLES, { error: "required" }),
    temporaryPassword,
  })
  .superRefine((value, ctx) => {
    // Without a public sign-up, a person must be reachable by at least one of the two.
    if (!value.username && !value.email) ctx.addIssue({ code: "custom", path: ["username"], message: "required" });
  });

export const updateUserInputSchema = z.object({
  name: requiredText(80),
  role: z.enum(USER_ROLES, { error: "required" }),
});

export const resetPasswordInputSchema = z.object({ temporaryPassword });

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface UserRecord {
  _id: { toString(): string };
  name: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  authProviders?: AuthProviderName[] | null;
  mustChangePassword?: boolean | null;
  createdAt: Date;
}

function toManaged(doc: UserRecord): ManagedUser {
  return {
    id: doc._id.toString(),
    name: doc.name,
    username: doc.username ?? undefined,
    email: doc.email ?? undefined,
    phone: doc.phone ?? undefined,
    role: doc.role,
    status: doc.status,
    authProviders: doc.authProviders ?? [],
    mustChangePassword: doc.mustChangePassword === true,
    createdAt: doc.createdAt,
  };
}

/** What the audit log keeps about an account: never the password hash. */
function auditView(user: ManagedUser) {
  return { name: user.name, username: user.username, email: user.email, role: user.role, status: user.status };
}

export async function listUsers(options: { q?: string; limit?: number } = {}): Promise<ManagedUser[]> {
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  const q = options.q?.trim();
  if (q) {
    const pattern = new RegExp(escapeRegExp(q), "i");
    filter.$or = ["name", "username", "email", "phone"].map((field) => ({ [field]: pattern }));
  }
  const docs = await User.find(filter).sort({ createdAt: -1 }).limit(options.limit ?? 200).lean();
  return docs.map((doc) => toManaged(doc as UserRecord));
}

export async function getManagedUser(id: string): Promise<ManagedUser | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await User.findById(id).lean();
  return doc ? toManaged(doc as UserRecord) : null;
}

/** Other active admins besides `exceptId`: an admin may only step down or be locked while another one remains. */
async function otherActiveAdmins(exceptId: string): Promise<number> {
  return User.countDocuments({ role: "admin", status: "active", _id: { $ne: exceptId } });
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

/** Creates an account that signs in with the temporary password and must change it first (thiết kế mục 6.1). */
export async function createUser(input: CreateUserInput, actorId: string): Promise<UserServiceResult<ManagedUser>> {
  await connectToDatabase();
  try {
    const created = await User.create({
      name: input.name,
      username: input.username,
      email: input.email,
      role: input.role,
      status: "active",
      authProviders: ["credentials"],
      passwordHash: await bcrypt.hash(input.temporaryPassword, HASH_ROUNDS),
      mustChangePassword: true,
    });
    const user = toManaged(created.toObject() as UserRecord);
    await recordAudit({ actorId, action: "create", entity: "user", entityId: user.id, after: auditView(user) });
    return { ok: true, data: user };
  } catch (error) {
    if (isDuplicateKeyError(error)) return { ok: false, error: "duplicate" };
    throw error;
  }
}

/** Changes the name and role. The last active admin cannot be demoted. */
export async function updateUser(
  id: string,
  input: { name: string; role: UserRole },
  actorId: string,
): Promise<UserServiceResult<ManagedUser>> {
  const before = await getManagedUser(id);
  if (!before) return { ok: false, error: "not_found" };

  if (before.role === "admin" && input.role !== "admin" && before.status === "active" && (await otherActiveAdmins(id)) === 0) {
    return { ok: false, error: "last_admin" };
  }

  const doc = await User.findByIdAndUpdate(id, { $set: { name: input.name, role: input.role } }, { returnDocument: "after" }).lean();
  if (!doc) return { ok: false, error: "not_found" };
  const after = toManaged(doc as UserRecord);
  await recordAudit({ actorId, action: "update", entity: "user", entityId: id, before: auditView(before), after: auditView(after) });
  return { ok: true, data: after };
}

/**
 * Locks or unlocks an account. A locked account signs in no more and its open sessions stop working on the next request
 * (the guards re-read the status from the database). You cannot lock yourself or the last active admin.
 */
export async function setUserStatus(
  id: string,
  status: UserStatus,
  actorId: string,
): Promise<UserServiceResult<ManagedUser>> {
  const before = await getManagedUser(id);
  if (!before) return { ok: false, error: "not_found" };

  if (status === "locked") {
    if (id === actorId) return { ok: false, error: "self" };
    if (before.role === "admin" && before.status === "active" && (await otherActiveAdmins(id)) === 0) {
      return { ok: false, error: "last_admin" };
    }
  }

  const doc = await User.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: "after" }).lean();
  if (!doc) return { ok: false, error: "not_found" };
  const after = toManaged(doc as UserRecord);
  // Unlocking also forgives the failed-login counter, so the person is not locked out by it right after.
  if (status === "active") await clearLoginAttempts([after.username, after.email].filter((key): key is string => Boolean(key)));
  await recordAudit({ actorId, action: "update", entity: "user", entityId: id, before: auditView(before), after: auditView(after) });
  return { ok: true, data: after };
}

/** Sets a temporary password (the person must change it at next sign-in) and clears the failed-login counter. */
export async function resetPassword(
  id: string,
  newTemporaryPassword: string,
  actorId: string,
): Promise<UserServiceResult<null>> {
  if (!isValidObjectId(id)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const user = await User.findById(id).select("+passwordHash");
  if (!user) return { ok: false, error: "not_found" };
  if (!user.passwordHash) return { ok: false, error: "no_password" };

  user.passwordHash = await bcrypt.hash(newTemporaryPassword, HASH_ROUNDS);
  user.mustChangePassword = true;
  await user.save();
  await clearLoginAttempts([user.username, user.email].filter((key): key is string => Boolean(key)));
  // Only the fact is recorded; the password itself never reaches the log.
  await recordAudit({ actorId, action: "update", entity: "user", entityId: id, after: { passwordReset: true } });
  return { ok: true, data: null };
}

